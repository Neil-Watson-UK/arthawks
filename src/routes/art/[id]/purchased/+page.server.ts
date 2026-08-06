import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	ensurePickupVerifyToken,
	fulfillCheckoutSession,
	getPurchaseByCheckoutSession,
	PurchaseError
} from '$lib/server/purchases';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { hasStripeEnv } from '$lib/server/stripe';
import { pickupVerifyRoute } from '$lib/constants/routes';
import { formatArtistName, formatPrice } from '$lib/utils/format';

export const load: PageServerLoad = async ({ params, url }) => {
	const sessionId = url.searchParams.get('session_id');
	if (!sessionId) {
		throw error(400, { message: 'Missing checkout session' });
	}
	if (!hasPublicSupabaseEnv() || !hasStripeEnv()) {
		throw error(503, { message: 'Purchases are not configured yet' });
	}

	try {
		let purchase = await getPurchaseByCheckoutSession(sessionId);
		if (!purchase || purchase.status === 'pending') {
			purchase = await fulfillCheckoutSession(sessionId);
		}

		if (purchase.status === 'needs_refund') {
			throw error(409, {
				message:
					'Payment was received but this sale could not be completed. Art Hawks will arrange a refund - contact support with your receipt email.'
			});
		}

		if (purchase.status !== 'paid' && purchase.status !== 'collected') {
			throw error(402, { message: 'Payment is not confirmed yet' });
		}

		purchase = await ensurePickupVerifyToken(purchase);

		const supabase = createServiceClient();
		const { data: artwork } = await supabase
			.from('artworks')
			.select('id, title, image_url, artist_id')
			.eq('id', purchase.artwork_id)
			.maybeSingle();

		let artistName = 'Artist';
		if (artwork?.artist_id) {
			const { data: artist } = await supabase
				.from('profiles')
				.select('username, full_name')
				.eq('id', artwork.artist_id)
				.maybeSingle();
			artistName = formatArtistName(artist?.full_name ?? null, artist?.username ?? 'artist');
		}

		let venueName: string | null = null;
		if (purchase.venue_id) {
			const { data: venue } = await supabase
				.from('venues')
				.select('name')
				.eq('id', purchase.venue_id)
				.maybeSingle();
			venueName = venue?.name ?? null;
		}

		const verifyPath = purchase.pickup_verify_token
			? pickupVerifyRoute(purchase.pickup_verify_token)
			: null;

		return {
			purchase: {
				id: purchase.id,
				status: purchase.status,
				pickup_code: purchase.pickup_code,
				amount_label: formatPrice(purchase.amount_pence),
				paid_at: purchase.paid_at,
				code_expires_at: purchase.code_expires_at,
				buyer_email: purchase.buyer_email,
				verify_path: verifyPath
			},
			artwork: {
				id: artwork?.id ?? params.id,
				title: artwork?.title ?? 'Artwork',
				image_url: artwork?.image_url ?? null,
				artist_name: artistName
			},
			venue_name: venueName
		};
	} catch (err) {
		if (err instanceof PurchaseError) {
			throw error(err.status, { message: err.message });
		}
		console.error('Purchase success load failed:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Could not load purchase'
		});
	}
};
