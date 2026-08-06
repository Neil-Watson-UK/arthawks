import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hubForUserType } from '$lib/constants/routes';
import { profileToIdentity } from '$lib/server/profile-identity';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.supabase) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let body: { email?: string; password?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const email = body.email?.trim().toLowerCase() ?? '';
	const password = body.password ?? '';
	if (!email.includes('@') || !password) {
		throw error(400, { message: 'Email and password are required' });
	}

	const { data, error: signInError } = await event.locals.supabase.auth.signInWithPassword({
		email,
		password
	});

	if (signInError || !data.user) {
		throw error(401, { message: signInError?.message ?? 'Invalid email or password' });
	}

	const { data: profile, error: profileError } = await event.locals.supabase
		.from('profiles')
		.select('*')
		.eq('id', data.user.id)
		.maybeSingle();

	if (profileError || !profile) {
		throw error(403, { message: 'Account has no profile. Contact support.' });
	}

	if (profile.is_active === false) {
		await event.locals.supabase.auth.signOut();
		throw error(403, { message: 'This account has been deactivated.' });
	}

	return json({
		identity: profileToIdentity(profile),
		user_type: profile.user_type,
		redirectTo: hubForUserType(profile.user_type)
	});
};
