import { redirect } from '@sveltejs/kit';
import { hubForUserType, ROUTES } from '$lib/constants/routes';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	if (event.locals.profile) {
		throw redirect(303, hubForUserType(event.locals.profile.user_type));
	}
	return {};
};
