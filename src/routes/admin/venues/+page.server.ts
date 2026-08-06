import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	const [{ data: venues }, { data: cities }, { data: owners }] = await Promise.all([
		supabase
			.from('venues')
			.select(
				'id, owner_id, city_id, name, slug, bio, website, instagram, image_url, district, postcode, footfall, is_active, aesthetic_tags'
			)
			.order('name')
			.limit(200),
		supabase.from('cities').select('id, name, slug').eq('is_active', true),
		supabase.from('profiles').select('id, full_name, username').eq('user_type', 'venue')
	]);

	return {
		venues: venues ?? [],
		cities: cities ?? [],
		owners: owners ?? []
	};
};
