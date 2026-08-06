import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	const { data, error } = await supabase
		.from('artworks')
		.select(
			'id, title, artist_id, status, price_pence, medium, style, substrate_tier, is_plug_and_play, image_url, created_at'
		)
		.order('created_at', { ascending: false })
		.limit(150);

	if (error) {
		console.error(error);
		return { artworks: [] };
	}

	const artistIds = [...new Set((data ?? []).map((a) => a.artist_id))];
	const { data: artists } = artistIds.length
		? await supabase.from('profiles').select('id, full_name, username').in('id', artistIds)
		: { data: [] };

	const artistMap = new Map((artists ?? []).map((a) => [a.id, a]));

	return {
		artworks: (data ?? []).map((artwork) => ({
			...artwork,
			artist_name: artistMap.get(artwork.artist_id)?.full_name ?? artistMap.get(artwork.artist_id)?.username ?? '-'
		}))
	};
};
