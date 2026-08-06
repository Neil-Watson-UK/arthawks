import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasStripeEnv } from '$lib/server/stripe';
import { createCheckoutForArtwork, PurchaseError } from '$lib/server/purchases';
import { hasPublicSupabaseEnv } from '$lib/server/supabase';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Database is not configured' });
	}
	if (!hasStripeEnv()) {
		throw error(503, {
			message: 'Stripe is not configured - add STRIPE_SECRET_KEY to .env'
		});
	}

	let body: { artwork_id?: string; finder_venue_id?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.artwork_id || !UUID_RE.test(body.artwork_id)) {
		throw error(400, { message: 'artwork_id must be a valid UUID' });
	}

	const finderVenueId =
		body.finder_venue_id && UUID_RE.test(body.finder_venue_id) ? body.finder_venue_id : null;

	const origin = event.url.origin;
	const buyerUserId = event.locals.profile?.id ?? event.locals.session?.user?.id ?? null;

	try {
		const checkout = await createCheckoutForArtwork({
			artworkId: body.artwork_id,
			origin,
			buyerUserId,
			finderVenueId
		});
		return json({ url: checkout.url, session_id: checkout.sessionId });
	} catch (err) {
		if (err instanceof PurchaseError) {
			throw error(err.status, { message: err.message });
		}
		console.error('Checkout create failed:', {
			artworkId: body.artwork_id,
			finderVenueId,
			error: err instanceof Error ? err.message : 'unknown'
		});
		throw error(500, { message: 'Could not start checkout' });
	}
};
