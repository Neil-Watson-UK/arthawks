import { demoIdentitiesEnabled } from '$lib/server/demo-flag';
import { countWorksSoldThroughPlatform } from '$lib/server/ledger';
import { profileToIdentity, type SessionIdentity } from '$lib/server/profile-identity';
import { hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = event.locals.profile;
	const sessionIdentity: SessionIdentity | null = profile ? profileToIdentity(profile) : null;

	let worksSold = 0;
	if (hasPublicSupabaseEnv()) {
		try {
			worksSold = await countWorksSoldThroughPlatform();
		} catch (err) {
			console.warn('works sold count skipped:', err);
		}
	}

	return {
		session: event.locals.session
			? {
					userId: event.locals.session.user.id,
					email: event.locals.session.user.email ?? null
				}
			: null,
		profile,
		sessionIdentity,
		demoIdentities: demoIdentitiesEnabled(),
		worksSold
	};
};
