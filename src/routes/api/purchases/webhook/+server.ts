import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getStripe, hasStripeEnv, stripeWebhookSecret } from '$lib/server/stripe';
import {
	fulfillCheckoutSession,
	PurchaseError,
	webhookFulfillDisposition
} from '$lib/server/purchases';

export const POST: RequestHandler = async ({ request }) => {
	if (!hasStripeEnv()) {
		throw error(503, { message: 'Stripe is not configured' });
	}

	const signature = request.headers.get('stripe-signature');
	if (!signature) {
		throw error(400, { message: 'Missing stripe-signature header' });
	}

	const rawBody = await request.text();
	const stripe = getStripe();

	let event;
	try {
		event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret());
	} catch (err) {
		console.error('Stripe webhook signature failed:', err);
		throw error(400, { message: 'Invalid webhook signature' });
	}

	const sessionId =
		event.type === 'checkout.session.completed' &&
		event.data.object &&
		typeof event.data.object === 'object' &&
		'id' in event.data.object
			? String((event.data.object as { id?: string }).id ?? '')
			: '';

	const metaPurchaseId =
		event.type === 'checkout.session.completed' &&
		event.data.object &&
		typeof event.data.object === 'object' &&
		'metadata' in event.data.object
			? String(
					((event.data.object as { metadata?: Record<string, string> | null }).metadata
						?.purchase_id as string | undefined) ?? ''
				)
			: '';

	console.info('Stripe webhook received', {
		eventType: event.type,
		eventId: event.id,
		sessionId: sessionId || undefined,
		purchaseId: metaPurchaseId || undefined
	});

	try {
		if (event.type === 'checkout.session.completed') {
			const session = event.data.object;
			if (session.id) {
				const purchase = await fulfillCheckoutSession(session.id);
				console.info('Stripe webhook fulfilled', {
					eventType: event.type,
					eventId: event.id,
					sessionId: session.id,
					purchaseId: purchase.id,
					status: purchase.status
				});
			}
		}
	} catch (err) {
		if (err instanceof PurchaseError) {
			const disposition = webhookFulfillDisposition(err);
			console.warn('Stripe webhook fulfill PurchaseError', {
				eventType: event.type,
				eventId: event.id,
				sessionId: sessionId || undefined,
				purchaseId: metaPurchaseId || undefined,
				status: err.status,
				message: err.message,
				disposition
			});
			if (disposition === 'ack') {
				return json({ received: true, warning: err.message });
			}
			/* 404 and other fulfill errors - retryable */
			throw error(err.status === 404 ? 500 : err.status >= 500 ? err.status : 500, {
				message: err.message
			});
		}
		console.error('Stripe webhook fulfill failed', {
			eventType: event.type,
			eventId: event.id,
			sessionId: sessionId || undefined,
			purchaseId: metaPurchaseId || undefined,
			error: err instanceof Error ? err.message : 'unknown'
		});
		throw error(500, {
			message: err instanceof Error ? err.message : 'Webhook handler failed'
		});
	}

	return json({ received: true });
};
