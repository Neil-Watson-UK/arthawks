import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiProfile } from '$lib/server/api-auth';
import { loadRotationsBundleForActor, SchemaNotReadyError } from '$lib/server/rotations-db';

export const GET: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, ['artist', 'venue', 'admin']);

	try {
		const bundle = await loadRotationsBundleForActor({
			id: profile.id,
			user_type: profile.user_type
		});
		return json(bundle);
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		console.error('Rotations hydrate failed:', err);
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to load rotations'
		});
	}
};
