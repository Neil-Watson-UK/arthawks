import { requireUserType } from '$lib/server/auth';
import { listVenueAwaitingCollection } from '$lib/server/purchases';
import { hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const profile = requireUserType(event, 'venue');
	let awaiting: Awaited<ReturnType<typeof listVenueAwaitingCollection>> = [];

	if (hasPublicSupabaseEnv()) {
		try {
			awaiting = await listVenueAwaitingCollection(profile.id);
		} catch (err) {
			console.warn('Awaiting collection load skipped:', err);
		}
	}

	return { awaiting };
};
