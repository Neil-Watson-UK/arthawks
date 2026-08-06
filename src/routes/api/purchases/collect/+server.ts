import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	collectPurchaseByCode,
	collectPurchaseById,
	PurchaseError
} from '$lib/server/purchases';
import { hasPublicSupabaseEnv } from '$lib/server/supabase';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Database is not configured' });
	}

	if (!event.locals.session || !event.locals.profile) {
		throw error(401, { message: 'Sign in as a venue to confirm collection' });
	}
	if (event.locals.profile.user_type !== 'venue') {
		throw error(403, { message: 'Only venue accounts can confirm collection' });
	}

	let body: { code?: string; purchase_id?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	try {
		const purchase =
			body.purchase_id && UUID_RE.test(body.purchase_id)
				? await collectPurchaseById({
						purchaseId: body.purchase_id,
						venueOwnerId: event.locals.profile.id
					})
				: await collectPurchaseByCode({
						code: body.code ?? '',
						venueOwnerId: event.locals.profile.id
					});

		return json({
			ok: true,
			purchase: {
				id: purchase.id,
				artwork_id: purchase.artwork_id,
				status: purchase.status,
				collected_at: purchase.collected_at,
				amount_pence: purchase.amount_pence
			}
		});
	} catch (err) {
		if (err instanceof PurchaseError) {
			throw error(err.status, { message: err.message });
		}
		console.error('Collect failed:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Could not confirm collection'
		});
	}
};
