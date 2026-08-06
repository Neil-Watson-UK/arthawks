import { redirectIfAuthenticatedProfile } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	redirectIfAuthenticatedProfile(event);

	return {};
};
