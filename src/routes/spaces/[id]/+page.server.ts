import { error } from '@sveltejs/kit';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { getPublicProspect } from '$lib/server/venue-prospects';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const id = event.params.id;
	if (!id) throw error(404, 'Not found');

	if (!hasPublicSupabaseEnv()) throw error(503, 'Unavailable');

	const supabase = createServiceClient();
	const prospect = await getPublicProspect(supabase, id);
	if (!prospect) throw error(404, 'This space is not publicly listed');

	return { prospect };
};
