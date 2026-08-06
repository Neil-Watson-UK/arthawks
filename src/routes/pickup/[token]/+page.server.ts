import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getPurchaseByVerifyToken } from '$lib/server/purchases';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { formatArtistName } from '$lib/utils/format';

function formatWhen(iso: string | null): string | null {
	if (!iso) return null;
	return new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	}).format(new Date(iso));
}

export const load: PageServerLoad = async ({ params }) => {
	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Purchases are not configured yet' });
	}

	const purchase = await getPurchaseByVerifyToken(params.token);
	if (!purchase) {
		throw error(404, { message: 'This pickup link is not valid' });
	}

	const expired =
		Boolean(purchase.code_expires_at) &&
		new Date(purchase.code_expires_at as string).getTime() < Date.now() &&
		purchase.status === 'paid';

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

	let state: 'paid' | 'collected' | 'expired' | 'unavailable' = 'unavailable';
	if (purchase.status === 'collected') state = 'collected';
	else if (purchase.status === 'paid' && expired) state = 'expired';
	else if (purchase.status === 'paid') state = 'paid';

	return {
		state,
		artwork: {
			title: artwork?.title ?? 'Artwork',
			image_url: artwork?.image_url ?? null,
			artist_name: artistName
		},
		venue_name: venueName,
		paid_at_label: formatWhen(purchase.paid_at),
		collected_at_label: formatWhen(purchase.collected_at),
		expires_at_label: formatWhen(purchase.code_expires_at)
	};
};
