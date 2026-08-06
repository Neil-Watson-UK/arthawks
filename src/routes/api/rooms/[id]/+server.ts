import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { loadRoomPage } from '$lib/server/room';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ params }) => {
	const venueId = params.id;

	if (!venueId || !UUID_RE.test(venueId)) {
		throw error(400, { message: 'A valid venue id is required' });
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

		const room = await loadRoomPage(supabase, venueId);
		if (!room) throw error(404, { message: 'Venue not found' });

		return json(room);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) throw err;
		console.error('Room load failed:', err);
		throw error(500, { message: 'Failed to load venue room' });
	}
};
