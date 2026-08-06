import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireApiProfile } from '$lib/server/api-auth';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { activateVenuePartner, getVenueOwnedBy } from '$lib/server/venues';

/** POST /api/venue/activate - owner opt-in to partner_status=active */
export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');

	if (!hasPublicSupabaseEnv()) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let supabase;
	try {
		supabase = createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured' });
	}

	const venue = await getVenueOwnedBy(supabase, profile.id);
	if (!venue) throw error(404, { message: 'Venue not found' });

	try {
		const updated = await activateVenuePartner(supabase, venue.id, profile.id);
		return json({
			venue_id: updated.id,
			partner_status: updated.partner_status,
			is_active: updated.is_active
		});
	} catch (err) {
		throw error(400, { message: err instanceof Error ? err.message : 'Activation failed' });
	}
};
