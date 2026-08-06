import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadArtistPage } from '$lib/server/artist-page';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ params }) => {
	const key = params.id?.trim();
	if (!key) {
		throw error(400, { message: 'Artist username or id is required' });
	}

	try {
		const supabase = hasPublicSupabaseEnv()
			? (() => {
					try {
						return createServiceClient();
					} catch {
						return null;
					}
				})()
			: null;

		const artist = await loadArtistPage(supabase, key);
		if (!artist) throw error(404, { message: 'Artist not found' });

		return json(artist);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Artist page load failed:', err);
		throw error(500, { message: 'Failed to load artist' });
	}
};
