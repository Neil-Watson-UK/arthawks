import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	const { data, error } = await supabase
		.from('matches')
		.select('id, venue_id, artwork_id, status, created_at')
		.order('created_at', { ascending: false })
		.limit(150);

	if (error) {
		console.error(error);
		return { matches: [] };
	}

	const venueIds = [...new Set((data ?? []).map((m) => m.venue_id))];
	const artworkIds = [...new Set((data ?? []).map((m) => m.artwork_id))];

	const [{ data: venues }, { data: artworks }] = await Promise.all([
		venueIds.length
			? supabase.from('venues').select('id, name').in('id', venueIds)
			: Promise.resolve({ data: [] }),
		artworkIds.length
			? supabase.from('artworks').select('id, title').in('id', artworkIds)
			: Promise.resolve({ data: [] })
	]);

	const venueMap = new Map((venues ?? []).map((v) => [v.id, v.name]));
	const artMap = new Map((artworks ?? []).map((a) => [a.id, a.title]));

	return {
		matches: (data ?? []).map((match) => ({
			...match,
			venue_name: venueMap.get(match.venue_id) ?? match.venue_id.slice(0, 8),
			artwork_title: artMap.get(match.artwork_id) ?? match.artwork_id.slice(0, 8)
		}))
	};
};
