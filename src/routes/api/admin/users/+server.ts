import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { BRISTOL_CITY_ID } from '$lib/constants/geo';
import { adminServiceClient } from '$lib/server/admin';
import { upsertVenueForOwner } from '$lib/server/venues';
import type { UserType } from '$lib/types/database';

function slugUsername(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 30);
}

export const POST: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);

	let body: {
		email?: string;
		password?: string;
		full_name?: string;
		username?: string;
		user_type?: UserType;
	};
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const email = body.email?.trim().toLowerCase() ?? '';
	const password = body.password ?? '';
	const fullName = body.full_name?.trim() ?? '';
	const userType = body.user_type;
	const username = slugUsername(body.username || fullName || email.split('@')[0] || 'member');

	if (!email.includes('@') || password.length < 8 || !fullName) {
		throw error(400, { message: 'email, password (8+), and full_name are required' });
	}
	if (!userType || !['admin', 'artist', 'venue', 'buyer'].includes(userType)) {
		throw error(400, { message: 'user_type must be admin|artist|venue|buyer' });
	}

	const { data: created, error: createError } = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { full_name: fullName, user_type: userType }
	});

	if (createError || !created.user) {
		throw error(400, { message: createError?.message ?? 'Could not create user' });
	}

	const id = created.user.id;
	const { error: profileError } = await supabase.from('profiles').upsert(
		{
			id,
			username,
			full_name: fullName,
			user_type: userType,
			email,
			city_id: BRISTOL_CITY_ID,
			onboarding_complete: true,
			is_active: true,
			aesthetic_tags: [],
			preferred_media: []
		} as never,
		{ onConflict: 'id' }
	);

	if (profileError) {
		await supabase.auth.admin.deleteUser(id);
		throw error(500, { message: profileError.message });
	}

	if (userType === 'venue') {
		await upsertVenueForOwner(supabase, {
			id,
			owner_id: id,
			name: fullName,
			slug: username,
			city_id: BRISTOL_CITY_ID,
			partner_status: 'verified'
		});
	}

	return json({ id, email, user_type: userType });
};
