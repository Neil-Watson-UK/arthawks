import { requireUserType } from '$lib/server/auth';
import { getArtistBalance } from '$lib/server/ledger';
import { hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = requireUserType(event, 'artist');

	let balance = { available_pence: 0, lifetime_pence: 0 };
	if (hasPublicSupabaseEnv()) {
		try {
			balance = await getArtistBalance(profile.id);
		} catch (err) {
			console.warn('Artist balance skipped:', err);
		}
	}

	return { profile, balance };
};
