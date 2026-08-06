import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadPublicArtwork } from '$lib/server/public-artwork';

export const load: PageServerLoad = async ({ params }) => {
	const artwork = await loadPublicArtwork(params.id);

	if (!artwork) {
		throw error(404, { message: 'This artwork could not be found - it may have left the walls.' });
	}

	return { artwork };
};
