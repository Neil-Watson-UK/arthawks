import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!hasPublicSupabaseEnv()) {
		return { spaces: [] as const };
	}

	try {
		const supabase = createServiceClient();
		const { data, error } = await supabase
			.from('venue_prospects')
			.select(
				'id, name, category, address, locality, postcode, latitude, longitude, website, lifecycle_status'
			)
			.in('lifecycle_status', ['unclaimed', 'claim_pending'])
			.order('name')
			.limit(200);

		if (error) {
			console.warn('spaces list:', error.message);
			return { spaces: [] as const };
		}

		return { spaces: data ?? [] };
	} catch (err) {
		console.warn('spaces load skipped:', err);
		return { spaces: [] as const };
	}
};
