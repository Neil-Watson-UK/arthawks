import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.supabase) {
		throw error(503, { message: 'Supabase is not configured' });
	}

	const { error: signOutError } = await event.locals.supabase.auth.signOut();
	if (signOutError) {
		throw error(500, { message: signOutError.message });
	}

	return json({ ok: true });
};
