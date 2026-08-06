import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ROUTES } from '$lib/constants/routes';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.supabase) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	let body: { email?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const email = body.email?.trim().toLowerCase() ?? '';
	if (!email.includes('@')) {
		throw error(400, { message: 'A valid email is required' });
	}

	const origin = event.url.origin;
	const { error: resetError } = await event.locals.supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${origin}${ROUTES.accountPassword}`
	});

	if (resetError) {
		throw error(400, { message: resetError.message });
	}

	return json({
		message: 'If that email is registered, a reset link is on its way.'
	});
};
