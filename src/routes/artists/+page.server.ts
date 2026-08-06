import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { listDirectoryArtists, utcDateKey } from '$lib/server/daily-spotlight';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const dateKey = utcDateKey();

	if (!hasPublicSupabaseEnv()) {
		return { artists: [] as const, dateKey };
	}

	try {
		const supabase = createServiceClient();
		const artists = await listDirectoryArtists(supabase, dateKey);
		return { artists, dateKey };
	} catch (err) {
		console.warn('artists directory load skipped:', err);
		return { artists: [] as const, dateKey };
	}
};
