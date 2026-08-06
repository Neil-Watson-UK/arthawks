import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);
	const role = event.url.searchParams.get('role');

	let query = supabase
		.from('profiles')
		.select(
			'id, username, full_name, user_type, email, is_active, district, city_id, onboarding_complete, updated_at'
		)
		.order('updated_at', { ascending: false })
		.limit(200);

	if (role === 'admin' || role === 'artist' || role === 'venue' || role === 'buyer') {
		query = query.eq('user_type', role);
	}

	const { data, error } = await query;
	if (error) {
		console.error(error);
		return { users: [], filter: role };
	}

	return { users: data ?? [], filter: role };
};
