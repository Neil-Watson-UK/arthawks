import { requireUserType } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const profile = requireUserType(event, 'admin');
	return { profile };
};
