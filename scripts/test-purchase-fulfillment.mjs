/**
 * Purchase fulfilment unit checks (no DB / Stripe).
 *
 * Run: node --experimental-strip-types scripts/test-purchase-fulfillment.mjs
 * (or after build: import from compiled — this file is plain JS for zero deps)
 *
 * Manual DB / Stripe scenarios are documented at the bottom.
 */
import assert from 'node:assert/strict';

/** Mirror of purchases.ts helpers — keep in sync when changing fulfilment policy. */
class PurchaseError extends Error {
	status;
	constructor(message, status = 400) {
		super(message);
		this.name = 'PurchaseError';
		this.status = status;
	}
}

function assertStripePaymentPaid(session) {
	if (session.payment_status !== 'paid') {
		throw new PurchaseError('Payment is not complete yet', 402);
	}
}

function assertStripeSessionMatchesPurchase(session, purchase) {
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

function webhookFulfillDisposition(err) {
	if (err.status === 402 || err.status === 409) return 'ack';
	return 'retry';
}

/**
 * Mirror of finalizeCollection zero-row resolution after
 * UPDATE … WHERE id=? AND status='paid' affects 0 rows.
 */
function resolveCollectionClaimMiss(fresh) {
	if (!fresh) {
		throw new PurchaseError('Purchase not found', 404);
	}
	if (fresh.status === 'collected') {
		throw new PurchaseError('This purchase was already collected', 409);
	}
	if (fresh.status !== 'paid') {
		throw new PurchaseError('Payment is not confirmed for this code yet', 402);
	}
	throw new PurchaseError('Could not confirm collection', 409);
}

/** Mirror of checkout/+server.ts unexpected-error client mapping. */
function checkoutClientError(err) {
	if (err instanceof PurchaseError) {
		return { status: err.status, message: err.message };
	}
	return { status: 500, message: 'Could not start checkout' };
}

const purchase = {
	id: 'p1',
	artwork_id: 'a1',
	amount_pence: 5000,
	currency: 'gbp'
};

/* payment status */
assert.throws(() => assertStripePaymentPaid({ payment_status: 'unpaid' }), (e) => e.status === 402);
assert.throws(() => assertStripePaymentPaid({ payment_status: 'no_payment_required' }), (e) => e.status === 402);
assert.doesNotThrow(() => assertStripePaymentPaid({ payment_status: 'paid' }));
/* complete alone is NOT enough — helper ignores session.status */
assert.throws(
	() => assertStripePaymentPaid({ payment_status: 'unpaid' /* status would be complete */ }),
	(e) => e.status === 402
);

/* amount / currency / metadata */
assert.doesNotThrow(() =>
	assertStripeSessionMatchesPurchase(
		{
			id: 'cs_1',
			payment_status: 'paid',
			amount_total: 5000,
			currency: 'gbp',
			metadata: { purchase_id: 'p1', artwork_id: 'a1' }
		},
		purchase
	)
);
assert.throws(
	() =>
		assertStripeSessionMatchesPurchase(
			{
				id: 'cs_1',
				payment_status: 'paid',
				amount_total: 4999,
				currency: 'gbp',
				metadata: { purchase_id: 'p1', artwork_id: 'a1' }
			},
			purchase
		),
	(e) => e.status === 422
);
assert.throws(
	() =>
		assertStripeSessionMatchesPurchase(
			{
				id: 'cs_1',
				payment_status: 'paid',
				amount_total: 5000,
				currency: 'usd',
				metadata: { purchase_id: 'p1', artwork_id: 'a1' }
			},
			purchase
		),
	(e) => e.status === 422
);
assert.throws(
	() =>
		assertStripeSessionMatchesPurchase(
			{
				id: 'cs_1',
				payment_status: 'paid',
				amount_total: 5000,
				currency: 'gbp',
				metadata: { purchase_id: 'other', artwork_id: 'a1' }
			},
			purchase
		),
	(e) => e.status === 422
);

/* webhook disposition */
assert.equal(webhookFulfillDisposition(new PurchaseError('wait', 402)), 'ack');
assert.equal(webhookFulfillDisposition(new PurchaseError('dup', 409)), 'ack');
assert.equal(webhookFulfillDisposition(new PurchaseError('missing', 404)), 'retry');
assert.equal(webhookFulfillDisposition(new PurchaseError('boom', 500)), 'retry');

/* collection claim miss (after conditional paid→collected update) */
assert.throws(() => resolveCollectionClaimMiss(null), (e) => e.status === 404);
assert.throws(
	() => resolveCollectionClaimMiss({ id: 'p1', status: 'collected' }),
	(e) => e.status === 409 && /already collected/i.test(e.message)
);
assert.throws(
	() => resolveCollectionClaimMiss({ id: 'p1', status: 'pending' }),
	(e) => e.status === 402
);
assert.throws(
	() => resolveCollectionClaimMiss({ id: 'p1', status: 'needs_refund' }),
	(e) => e.status === 402
);
/* still paid but 0-row update — safe conflict, not a success */
assert.throws(
	() => resolveCollectionClaimMiss({ id: 'p1', status: 'paid' }),
	(e) => e.status === 409
);

/* checkout unexpected 500 must not leak Error.message */
{
	const leaked = checkoutClientError(new Error('relation purchases does not exist'));
	assert.equal(leaked.status, 500);
	assert.equal(leaked.message, 'Could not start checkout');
	assert.equal(leaked.message.includes('relation'), false);
}
{
	const intentional = checkoutClientError(new PurchaseError('This work has already been sold', 409));
	assert.equal(intentional.status, 409);
	assert.equal(intentional.message, 'This work has already been sold');
}

console.log('PASS: purchase fulfilment unit checks');

console.log(`
--- Manual / DB scenarios (after applying migration 20260804230000) ---

1) Duplicate webhook
   - Pay once; note purchase id
   - Resend checkout.session.completed in Stripe (or reload success URL)
   - Expect: still one paid row; ledger_posted_at set; no second ledger rows

2) Concurrent checkouts
   - Two browsers start checkout on same artwork (two pending rows)
   - Complete both payments with test cards
   - Expect: one status=paid + artwork sold; other status=needs_refund with
     reconciliation_reason artwork_already_sold|duplicate_paid_sale;
     loser pickup_code = ------; only winner has ledger credits

3) Fulfil twice (same session)
   - Call fulfill path twice (success page + webhook)
   - Expect: idempotent paid + single ledger post

4) Artwork already sold before fulfil
   - Create pending purchase; manually set artworks.status=sold (or via winner)
   - Fulfil loser session
   - Expect: needs_refund; no ledger for loser

5) Missing purchase (404)
   - Webhook for unknown session / deleted pending
   - Expect: HTTP 5xx (not 200) so Stripe retries

6) payment_status not paid
   - Expect: soft ack 200 with warning (402 path)

7) Collection (paid → collected)
   - Venue A owns purchase.venue_id; POST /api/purchases/collect with code
   - Expect: 200, status=collected
   - Second collect (same code or purchase_id): 409 already collected
   - Collect while status=pending: 402 (or 404 if code not visible as paid)
   - Venue B (different owner): 404 no matching purchase at your venue
`);
