import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing user id' });

	let body: {
		is_active?: boolean;
		full_name?: string;
		user_type?: string;
		city_id?: string | null;
	};
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
	if (typeof body.full_name === 'string') patch.full_name = body.full_name.trim();
	if (body.user_type && ['admin', 'artist', 'venue', 'buyer'].includes(body.user_type)) {
		patch.user_type = body.user_type;
	}
	if ('city_id' in body) patch.city_id = body.city_id;

	const { data, error: updateError } = await supabase
		.from('profiles')
		.update(patch as never)
		.eq('id', id)
		.select('id, is_active, user_type, full_name')
		.maybeSingle();

	if (updateError) throw error(500, { message: updateError.message });
	return json({ user: data });
};
