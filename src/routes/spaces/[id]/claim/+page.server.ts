import { error, redirect } from '@sveltejs/kit';
import { ROUTES } from '$lib/constants/routes';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { getPublicProspect } from '$lib/server/venue-prospects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const id = event.params.id;
	if (!id) throw error(404);

	if (!event.locals.session || !event.locals.profile) {
		throw redirect(303, `${ROUTES.login}?next=${encodeURIComponent(`/spaces/${id}/claim`)}`);
	}

	if (!hasPublicSupabaseEnv()) throw error(503, 'Unavailable');

	const supabase = createServiceClient();
	const prospect = await getPublicProspect(supabase, id);
	if (!prospect) throw error(404, 'This space is not open for claims');
	if (prospect.lifecycle_status !== 'unclaimed') {
		throw error(400, 'A claim is already pending or this space is not claimable');
	}

	return {
		prospect,
		profile: {
			full_name: event.locals.profile.full_name,
			email: event.locals.profile.email,
			user_type: event.locals.profile.user_type
		}
	};
};
