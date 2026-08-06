import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { loadDailySpotlight } from '$lib/server/daily-spotlight';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!hasPublicSupabaseEnv()) {
		return { spotlight: { dateKey: '', artist: null, venue: null } };
	}

	try {
		const supabase = createServiceClient();
		const spotlight = await loadDailySpotlight(supabase);
		return { spotlight };
	} catch (err) {
		console.warn('discover spotlight skipped:', err);
		return { spotlight: { dateKey: '', artist: null, venue: null } };
	}
};
