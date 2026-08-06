import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.supabase || !event.locals.session) {
		throw error(401, { message: 'You must be signed in to change your password' });
	}

	let body: { password?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const password = body.password ?? '';
	if (password.length < 8) {
		throw error(400, { message: 'Password must be at least 8 characters' });
	}

	const { error: updateError } = await event.locals.supabase.auth.updateUser({ password });
	if (updateError) {
		throw error(400, { message: updateError.message });
	}

	return json({ message: 'Password updated.' });
};
