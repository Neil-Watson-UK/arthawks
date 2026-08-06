import { applyPurchaseLedger, computeSaleSplit } from '$lib/server/ledger';
import { notifyPickupReady } from '$lib/server/pickup-email';
import {
	defaultCodeExpiry,
	generatePickupCode,
	generatePickupVerifyToken,
	getStripe,
	hashPickupCode
} from '$lib/server/stripe';
import { createServiceClient } from '$lib/server/supabase';
import {
	isEligibleFinderHang,
	placementForHang
} from '$lib/scheduling';
import type { Database } from '$lib/types/database';
import type { AwaitingCollectionRow } from '$lib/types/purchases';

export type { AwaitingCollectionRow };
export type PurchaseRow = Database['public']['Tables']['purchases']['Row'];

export class PurchaseError extends Error {
	status: number;
	constructor(message: string, status = 400) {
		super(message);
		this.name = 'PurchaseError';
		this.status = status;
	}
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
	if (!error) return false;
	if (error.code === '42703' || error.code === 'PGRST204') return true;
	const msg = error.message?.toLowerCase() ?? '';
	return msg.includes('schema cache') || msg.includes('could not find');
}

async function hangsForArtwork(artworkId: string) {
	const supabase = createServiceClient();
	const withHung = await supabase
		.from('matches')
		.select('id, venue_id, status, approved_at, hung_at, starts_on, ends_on')
		.eq('artwork_id', artworkId)
		.in('status', ['pending', 'accepted']);

	let rows = withHung.data ?? [];
	if (withHung.error?.code === '42703') {
		const legacy = await supabase
			.from('matches')
			.select('id, venue_id, status, approved_at, starts_on, ends_on')
			.eq('artwork_id', artworkId)
			.in('status', ['pending', 'accepted']);
		if (legacy.error) throw new Error(legacy.error.message);
		rows = (legacy.data ?? []).map((row) => ({
			...row,
			hung_at: row.approved_at
		}));
	} else if (withHung.error) {
		throw new Error(withHung.error.message);
	}

	return rows;
}

function showingHang(
	rows: Awaited<ReturnType<typeof hangsForArtwork>>
): (typeof rows)[number] | null {
	return rows.find((row) => placementForHang(row) === 'showing') ?? null;
}

/**
 * Resolve a 5% finder venue: hung within 30 days, not showing elsewhere,
 * and not accepted at another venue.
 */
function resolveFinderVenueId(
	rows: Awaited<ReturnType<typeof hangsForArtwork>>,
	requestedVenueId?: string | null
): string | null {
	if (showingHang(rows)) return null;

	if (requestedVenueId) {
		const candidate = rows.find((row) => row.venue_id === requestedVenueId);
		if (candidate && isEligibleFinderHang(candidate, rows)) {
			return requestedVenueId;
		}
	}

	const eligible = rows
		.filter((row) => isEligibleFinderHang(row, rows))
		.sort((a, b) => {
			const aMs = a.hung_at ? new Date(a.hung_at).getTime() : 0;
			const bMs = b.hung_at ? new Date(b.hung_at).getTime() : 0;
			return bMs - aMs;
		});

	return eligible[0]?.venue_id ?? null;
}

export async function createCheckoutForArtwork(input: {
	artworkId: string;
	origin: string;
	buyerUserId?: string | null;
	/** Past-exhibit room referral - 5% finders fee when eligible (30-day window). */
	finderVenueId?: string | null;
}): Promise<{ url: string; sessionId: string }> {
	const supabase = createServiceClient();
	const { data: artwork, error } = await supabase
		.from('artworks')
		.select('id, title, artist_id, price_pence, status, image_url')
		.eq('id', input.artworkId)
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!artwork) throw new PurchaseError('Artwork not found', 404);
	if (artwork.status === 'sold') {
		throw new PurchaseError('This work has already been sold', 409);
	}
	if (!artwork.price_pence || artwork.price_pence < 100) {
		throw new PurchaseError('This work is not priced for purchase yet', 400);
	}

	const { data: existingPaid } = await supabase
		.from('purchases')
		.select('id')
		.eq('artwork_id', artwork.id)
		.in('status', ['paid', 'collected'])
		.limit(1)
		.maybeSingle();

	if (existingPaid) {
		throw new PurchaseError('This work has already been sold', 409);
	}

	const hangs = await hangsForArtwork(artwork.id);
	const showing = showingHang(hangs);
	const wallVenueId = showing?.venue_id ?? null;
	const finderVenueId = wallVenueId
		? null
		: resolveFinderVenueId(hangs, input.finderVenueId);

	const attribution = wallVenueId ? 'wall' : finderVenueId ? 'finder' : 'none';
	const split = computeSaleSplit(artwork.price_pence, attribution);
	const hang =
		showing ??
		hangs.find((row) => row.venue_id === finderVenueId) ??
		hangs.find((row) => row.status === 'accepted') ??
		hangs[0] ??
		null;

	/* Pickup venue for collect - may differ from fee attribution (wall 15% / finder 5%). */
	const pickupVenueId = wallVenueId ?? finderVenueId ?? hang?.venue_id ?? null;

	const code = generatePickupCode();
	const codeHash = hashPickupCode(code);
	const verifyToken = generatePickupVerifyToken();
	const expires = defaultCodeExpiry();

	const basePurchase = {
		artwork_id: artwork.id,
		artist_id: artwork.artist_id,
		match_id: hang?.id ?? null,
		venue_id: pickupVenueId,
		finder_venue_id: finderVenueId,
		buyer_user_id: input.buyerUserId ?? null,
		amount_pence: artwork.price_pence,
		currency: 'gbp',
		pickup_code: code,
		pickup_code_hash: codeHash,
		pickup_verify_token: verifyToken,
		status: 'pending' as const,
		code_expires_at: expires
	};

	let purchaseInsert = await supabase
		.from('purchases')
		.insert({
			...basePurchase,
			artist_share_pence: split.artistSharePence,
			venue_share_pence: split.venueSharePence,
			finder_share_pence: split.finderSharePence,
			platform_share_pence: split.platformSharePence
		})
		.select('id')
		.single();

	/* Share / finder columns may be missing until migrations are applied.
	 * PostgREST uses PGRST204 ("schema cache"); Postgres uses 42703. */
	if (isMissingColumnError(purchaseInsert.error)) {
		const withoutFinder = {
			artwork_id: basePurchase.artwork_id,
			artist_id: basePurchase.artist_id,
			match_id: basePurchase.match_id,
			venue_id: basePurchase.venue_id,
			buyer_user_id: basePurchase.buyer_user_id,
			amount_pence: basePurchase.amount_pence,
			currency: basePurchase.currency,
			pickup_code: basePurchase.pickup_code,
			pickup_code_hash: basePurchase.pickup_code_hash,
			pickup_verify_token: basePurchase.pickup_verify_token,
			status: basePurchase.status,
			code_expires_at: basePurchase.code_expires_at
		};
		purchaseInsert = await supabase
			.from('purchases')
			.insert({
				...withoutFinder,
				artist_share_pence: split.artistSharePence,
				venue_share_pence: split.venueSharePence,
				platform_share_pence: split.platformSharePence
			})
			.select('id')
			.single();
		if (isMissingColumnError(purchaseInsert.error)) {
			purchaseInsert = await supabase
				.from('purchases')
				.insert(withoutFinder)
				.select('id')
				.single();
		}
		if (isMissingColumnError(purchaseInsert.error)) {
			const { pickup_verify_token: _token, ...legacy } = withoutFinder;
			purchaseInsert = await supabase.from('purchases').insert(legacy).select('id').single();
		}
	}

	const { data: purchase, error: insertError } = purchaseInsert;

	if (insertError || !purchase) {
		if (insertError?.code === '42P01') {
			throw new PurchaseError(
				'Purchases table missing - run migration 20260730150000_purchases_pickup_codes.sql',
				503
			);
		}
		throw new Error(insertError?.message ?? 'Could not start purchase');
	}

	const stripe = getStripe();
	const successUrl = `${input.origin}/art/${artwork.id}/purchased?session_id={CHECKOUT_SESSION_ID}`;
	const cancelParams = new URLSearchParams({ cancelled: '1' });
	if (input.finderVenueId) cancelParams.set('from', 'past');
	if (input.finderVenueId) cancelParams.set('venue', input.finderVenueId);
	const cancelUrl = `${input.origin}/art/${artwork.id}?${cancelParams.toString()}`;

	/*
	 * Pilot: card-only Checkout so payment_status=paid is immediate.
	 * Async methods (e.g. bank debits) are out of scope until we handle
	 * async_payment_succeeded / async_payment_failed in the webhook.
	 */
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		payment_method_types: ['card'],
		success_url: successUrl,
		cancel_url: cancelUrl,
		customer_email: undefined,
		line_items: [
			{
				quantity: 1,
				price_data: {
					currency: 'gbp',
					unit_amount: artwork.price_pence,
					product_data: {
						name: artwork.title,
						images:
							artwork.image_url?.startsWith('https://') ? [artwork.image_url] : undefined,
						metadata: {
							artwork_id: artwork.id
						}
					}
				}
			}
		],
		metadata: {
			purchase_id: purchase.id,
			artwork_id: artwork.id,
			match_id: hang?.id ?? '',
			venue_id: pickupVenueId ?? '',
			finder_venue_id: finderVenueId ?? '',
			artist_id: artwork.artist_id,
			attribution
		},
		payment_intent_data: {
			metadata: {
				purchase_id: purchase.id,
				artwork_id: artwork.id
			}
		}
	});

	if (!session.url) {
		throw new Error('Stripe did not return a checkout URL');
	}

	await supabase
		.from('purchases')
		.update({
			stripe_checkout_session_id: session.id,
			updated_at: new Date().toISOString()
		})
		.eq('id', purchase.id);

	return { url: session.url, sessionId: session.id };
}

/** Stripe session fields required for fulfilment consistency checks. */
export type StripeFulfillSession = {
	id: string;
	payment_status: string | null;
	amount_total: number | null;
	currency: string | null;
	metadata: Record<string, string> | null;
	customer_details?: { email?: string | null } | null;
	customer_email?: string | null;
	payment_intent?: string | { id: string } | null;
};

/**
 * Pilot policy: only `payment_status === 'paid'` proves funds.
 * `session.status === 'complete'` alone is not enough (async methods).
 */
export function assertStripePaymentPaid(session: Pick<StripeFulfillSession, 'payment_status'>): void {
	if (session.payment_status !== 'paid') {
		throw new PurchaseError('Payment is not complete yet', 402);
	}
}

/**
 * Fail closed if Stripe totals / metadata disagree with the purchase row.
 */
export function assertStripeSessionMatchesPurchase(
	session: StripeFulfillSession,
	purchase: Pick<PurchaseRow, 'id' | 'artwork_id' | 'amount_pence' | 'currency'>
): void {
	const metaPurchaseId = session.metadata?.purchase_id ?? '';
	const metaArtworkId = session.metadata?.artwork_id ?? '';

	if (metaPurchaseId && metaPurchaseId !== purchase.id) {
		throw new PurchaseError('Stripe session purchase_id does not match purchase', 422);
	}
	if (metaArtworkId && metaArtworkId !== purchase.artwork_id) {
		throw new PurchaseError('Stripe session artwork_id does not match purchase', 422);
	}
	if (session.amount_total == null || session.amount_total !== purchase.amount_pence) {
		throw new PurchaseError('Stripe session amount does not match purchase', 422);
	}
	const sessionCurrency = (session.currency ?? '').toLowerCase();
	const purchaseCurrency = (purchase.currency ?? '').toLowerCase();
	if (!sessionCurrency || sessionCurrency !== purchaseCurrency) {
		throw new PurchaseError('Stripe session currency does not match purchase', 422);
	}
}

/**
 * Webhook ack policy (Phase 3):
 * - 402 not-yet-paid → ack (Stripe may send again when paid)
 * - 409 needs_refund / already reconciled → ack (state recorded)
 * - 404 missing purchase → retry (5xx)
 * - other errors → retry
 */
export function webhookFulfillDisposition(
	err: PurchaseError
): 'ack' | 'retry' {
	if (err.status === 402 || err.status === 409) return 'ack';
	return 'retry';
}

async function markPurchaseNeedsRefund(input: {
	purchaseId: string;
	reason: string;
	sessionId?: string | null;
	paymentIntentId?: string | null;
	buyerEmail?: string | null;
}): Promise<PurchaseRow> {
	const supabase = createServiceClient();
	const now = new Date().toISOString();
	const { data, error } = await supabase
		.from('purchases')
		.update({
			status: 'needs_refund',
			reconciliation_reason: input.reason,
			pickup_code: '------',
			pickup_code_hash: `invalidated:${input.purchaseId}`,
			pickup_verify_token: `invalidated:${input.purchaseId}`,
			code_expires_at: new Date(Date.now() - 1000).toISOString(),
			stripe_checkout_session_id: input.sessionId ?? undefined,
			stripe_payment_intent_id: input.paymentIntentId ?? undefined,
			buyer_email: input.buyerEmail ?? undefined,
			updated_at: now
		})
		.eq('id', input.purchaseId)
		.in('status', ['pending', 'needs_refund'])
		.select('*')
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!data) {
		const { data: again, error: againError } = await supabase
			.from('purchases')
			.select('*')
			.eq('id', input.purchaseId)
			.single();
		if (againError || !again) {
			throw new Error(againError?.message ?? 'Could not mark purchase needs_refund');
		}
		return again;
	}
	return data;
}

async function requireLedgerPosted(purchaseId: string): Promise<PurchaseRow> {
	const withLedger = await applyPurchaseLedger(purchaseId);
	if (!withLedger) {
		throw new Error('Ledger posting unavailable after paid claim');
	}
	if (!withLedger.ledger_posted_at) {
		throw new Error('Ledger not posted after paid claim');
	}
	return withLedger;
}

export async function fulfillCheckoutSession(sessionId: string): Promise<PurchaseRow> {
	const stripe = getStripe();
	const session = (await stripe.checkout.sessions.retrieve(sessionId)) as StripeFulfillSession;

	assertStripePaymentPaid(session);

	const purchaseId = session.metadata?.purchase_id;
	const supabase = createServiceClient();

	/* Prefer lookup by session id so retries stay idempotent even if metadata drifts */
	let purchase: PurchaseRow | null = null;
	{
		const bySession = await supabase
			.from('purchases')
			.select('*')
			.eq('stripe_checkout_session_id', sessionId)
			.maybeSingle();
		if (bySession.error) throw new Error(bySession.error.message);
		purchase = bySession.data;
	}

	if (!purchase && purchaseId) {
		const byId = await supabase.from('purchases').select('*').eq('id', purchaseId).maybeSingle();
		if (byId.error) throw new Error(byId.error.message);
		purchase = byId.data;
	}

	if (!purchase) throw new PurchaseError('Purchase not found', 404);

	if (purchase.status === 'needs_refund') {
		throw new PurchaseError(
			`Purchase requires refund reconciliation (${purchase.reconciliation_reason ?? 'needs_refund'})`,
			409
		);
	}

	if (purchase.status === 'paid' || purchase.status === 'collected') {
		return requireLedgerPosted(purchase.id);
	}

	try {
		assertStripeSessionMatchesPurchase(session, purchase);
	} catch (err) {
		if (err instanceof PurchaseError && err.status === 422 && purchase.status === 'pending') {
			await markPurchaseNeedsRefund({
				purchaseId: purchase.id,
				reason: `stripe_mismatch:${err.message}`,
				sessionId: session.id,
				paymentIntentId:
					typeof session.payment_intent === 'string'
						? session.payment_intent
						: session.payment_intent?.id ?? null,
				buyerEmail: session.customer_details?.email ?? session.customer_email ?? null
			});
			throw new PurchaseError(
				`Stripe mismatch - purchase marked needs_refund (${err.message})`,
				409
			);
		}
		throw err;
	}

	const paymentIntentId =
		typeof session.payment_intent === 'string'
			? session.payment_intent
			: session.payment_intent?.id ?? null;

	const paidAt = new Date().toISOString();
	const buyerEmail =
		session.customer_details?.email ?? session.customer_email ?? purchase.buyer_email;

	const { data: claimed, error: claimError } = await supabase.rpc('claim_purchase_sale', {
		p_purchase_id: purchase.id,
		p_paid_at: paidAt,
		p_buyer_email: buyerEmail,
		p_stripe_session_id: session.id,
		p_stripe_payment_intent_id: paymentIntentId
	});

	if (claimError) {
		if (claimError.message?.includes('purchase_not_found')) {
			throw new PurchaseError('Purchase not found', 404);
		}
		throw new Error(claimError.message);
	}

	if (!claimed) {
		throw new Error('claim_purchase_sale returned no row');
	}

	if (claimed.status === 'needs_refund') {
		console.warn('Purchase fulfill needs_refund', {
			purchaseId: claimed.id,
			artworkId: claimed.artwork_id,
			reason: claimed.reconciliation_reason,
			winningPurchaseId: claimed.winning_purchase_id,
			sessionId: session.id
		});
		throw new PurchaseError(
			`Duplicate or lost race - marked needs_refund (${claimed.reconciliation_reason ?? 'unknown'})`,
			409
		);
	}

	if (claimed.status !== 'paid' && claimed.status !== 'collected') {
		throw new Error(`Unexpected purchase status after claim: ${claimed.status}`);
	}

	const withLedger = await requireLedgerPosted(claimed.id);
	const withToken = await ensurePickupVerifyToken(withLedger);
	void notifyPickupReady(withToken);
	return withToken;
}

/** Ensure paid purchases have a public verify token (backfill + migration lag). */
export async function ensurePickupVerifyToken(purchase: PurchaseRow): Promise<PurchaseRow> {
	if (purchase.pickup_verify_token) return purchase;
	if (purchase.status !== 'paid' && purchase.status !== 'collected') return purchase;

	const token = generatePickupVerifyToken();
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('purchases')
		.update({
			pickup_verify_token: token,
			updated_at: new Date().toISOString()
		})
		.eq('id', purchase.id)
		.is('pickup_verify_token', null)
		.select('*')
		.maybeSingle();

	if (error) {
		if (isMissingColumnError(error)) return purchase;
		console.warn('ensurePickupVerifyToken failed:', error.message);
		return purchase;
	}
	return data ?? { ...purchase, pickup_verify_token: token };
}

export async function getPurchaseByVerifyToken(token: string): Promise<PurchaseRow | null> {
	const cleaned = token.trim();
	if (!cleaned || cleaned.length < 16 || cleaned.startsWith('invalidated:')) return null;

	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('purchases')
		.select('*')
		.eq('pickup_verify_token', cleaned)
		.maybeSingle();

	if (error) {
		if (isMissingColumnError(error)) return null;
		throw new Error(error.message);
	}
	return data;
}

export async function getPurchaseByCheckoutSession(sessionId: string): Promise<PurchaseRow | null> {
	const supabase = createServiceClient();
	const { data, error } = await supabase
		.from('purchases')
		.select('*')
		.eq('stripe_checkout_session_id', sessionId)
		.maybeSingle();

	if (error) {
		if (error.code === '42P01' || error.code === '42703') return null;
		throw new Error(error.message);
	}
	return data;
}

export async function collectPurchaseByCode(input: {
	code: string;
	venueOwnerId: string;
}): Promise<PurchaseRow> {
	const code = input.code.replace(/\s+/g, '').trim();
	if (!/^\d{6}$/.test(code)) {
		throw new PurchaseError('Enter the 6-digit pickup code', 400);
	}

	const supabase = createServiceClient();
	const venue = await venueForOwner(supabase, input.venueOwnerId);

	const codeHash = hashPickupCode(code);
	const venueId = venue.id;

	const { data: byHash, error } = await supabase
		.from('purchases')
		.select('*')
		.eq('pickup_code_hash', codeHash)
		.or(`venue_id.eq.${venueId},finder_venue_id.eq.${venueId}`)
		.maybeSingle();

	let row = byHash;
	if (!row && !error) {
		const byPlain = await supabase
			.from('purchases')
			.select('*')
			.eq('pickup_code', code)
			.or(`venue_id.eq.${venueId},finder_venue_id.eq.${venueId}`)
			.maybeSingle();
		if (byPlain.error) throw new Error(byPlain.error.message);
		row = byPlain.data;
	}

	if (error) throw new Error(error.message);
	if (!row) throw new PurchaseError('No matching paid purchase for this code at your venue', 404);

	return finalizeCollection(supabase, row, input.venueOwnerId);
}

export async function collectPurchaseById(input: {
	purchaseId: string;
	venueOwnerId: string;
}): Promise<PurchaseRow> {
	const supabase = createServiceClient();
	const venue = await venueForOwner(supabase, input.venueOwnerId);

	const { data: row, error } = await supabase
		.from('purchases')
		.select('*')
		.eq('id', input.purchaseId)
		.or(`venue_id.eq.${venue.id},finder_venue_id.eq.${venue.id}`)
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!row) throw new PurchaseError('No matching paid purchase at your venue', 404);

	return finalizeCollection(supabase, row, input.venueOwnerId);
}

async function venueForOwner(
	supabase: ReturnType<typeof createServiceClient>,
	venueOwnerId: string
) {
	const venue = await supabase
		.from('venues')
		.select('id, owner_id, name')
		.eq('owner_id', venueOwnerId)
		.eq('is_active', true)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (venue.error) throw new Error(venue.error.message);
	if (!venue.data) throw new PurchaseError('No venue found for this account', 403);
	return venue.data;
}

async function finalizeCollection(
	supabase: ReturnType<typeof createServiceClient>,
	row: PurchaseRow,
	venueOwnerId: string
): Promise<PurchaseRow> {
	if (row.code_expires_at && row.code_expires_at < new Date().toISOString()) {
		throw new PurchaseError('This pickup code has expired', 410);
	}

	/*
	 * Atomic paid → collected. Concurrent collectors: one wins; loser gets 0 rows
	 * and is classified from a fresh read (already collected / not paid / missing).
	 */
	const collectedAt = new Date().toISOString();
	const { data: updated, error: updateError } = await supabase
		.from('purchases')
		.update({
			status: 'collected',
			collected_at: collectedAt,
			collected_by: venueOwnerId,
			updated_at: collectedAt
		})
		.eq('id', row.id)
		.eq('status', 'paid')
		.select('*')
		.maybeSingle();

	if (updateError) {
		throw new Error(updateError.message);
	}
	if (updated) {
		return updated;
	}

	const { data: again, error: againError } = await supabase
		.from('purchases')
		.select('*')
		.eq('id', row.id)
		.maybeSingle();

	if (againError) {
		throw new Error(againError.message);
	}
	if (!again) {
		throw new PurchaseError('Purchase not found', 404);
	}
	if (again.status === 'collected') {
		throw new PurchaseError('This purchase was already collected', 409);
	}
	if (again.status !== 'paid') {
		throw new PurchaseError('Payment is not confirmed for this code yet', 402);
	}

	throw new PurchaseError('Could not confirm collection', 409);
}

export async function listVenueAwaitingCollection(
	venueOwnerId: string
): Promise<AwaitingCollectionRow[]> {
	const supabase = createServiceClient();
	const venue = await supabase
		.from('venues')
		.select('id')
		.eq('owner_id', venueOwnerId)
		.eq('is_active', true)
		.limit(1)
		.maybeSingle();

	if (venue.error || !venue.data) return [];

	const { data, error } = await supabase
		.from('purchases')
		.select(
			'id, artwork_id, amount_pence, paid_at, code_expires_at, status, buyer_email, pickup_code'
		)
		.eq('status', 'paid')
		.or(`venue_id.eq.${venue.data.id},finder_venue_id.eq.${venue.data.id}`)
		.order('paid_at', { ascending: false });

	if (error) {
		if (error.code === '42P01' || error.code === '42703') return [];
		throw new Error(error.message);
	}

	const rows = data ?? [];
	if (rows.length === 0) return [];

	const artworkIds = [...new Set(rows.map((row) => row.artwork_id))];
	const { data: artworks } = await supabase
		.from('artworks')
		.select('id, title, image_url, artist_id')
		.in('id', artworkIds);

	const artistIds = [...new Set((artworks ?? []).map((row) => row.artist_id))];
	const { data: artists } =
		artistIds.length > 0
			? await supabase.from('profiles').select('id, full_name, username').in('id', artistIds)
			: { data: [] as { id: string; full_name: string | null; username: string }[] };

	const artworkById = new Map((artworks ?? []).map((row) => [row.id, row]));
	const artistById = new Map((artists ?? []).map((row) => [row.id, row]));

	return rows.map((row) => {
		const artwork = artworkById.get(row.artwork_id);
		const artist = artwork ? artistById.get(artwork.artist_id) : null;
		return {
			id: row.id,
			artwork_id: row.artwork_id,
			amount_pence: row.amount_pence,
			paid_at: row.paid_at,
			code_expires_at: row.code_expires_at,
			status: row.status,
			buyer_email: row.buyer_email,
			pickup_code: row.pickup_code,
			artwork_title: artwork?.title ?? 'Artwork',
			artwork_image_url: artwork?.image_url || null,
			artist_name: artist?.full_name ?? (artist ? `@${artist.username}` : 'Artist')
		};
	});
}
