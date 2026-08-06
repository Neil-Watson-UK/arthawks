import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { ArtistPage } from '$lib/server/artist-page';

export const load: PageLoad = async ({ params, fetch }) => {
	const response = await fetch(`/api/artists/${encodeURIComponent(params.id)}`);

	if (response.status === 404) {
		throw error(404, 'This artist could not be found');
	}

	if (!response.ok) {
		throw error(500, 'Could not open this artist');
	}

	const artist = (await response.json()) as ArtistPage;
	return { artist };
};
