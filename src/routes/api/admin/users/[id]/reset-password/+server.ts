import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ROUTES } from '$lib/constants/routes';
import { adminServiceClient } from '$lib/server/admin';

export const POST: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing user id' });

	const { data: profile } = await supabase.from('profiles').select('email').eq('id', id).maybeSingle();
	const email = profile?.email;
	if (!email) {
		const { data: authUser } = await supabase.auth.admin.getUserById(id);
		const authEmail = authUser.user?.email;
		if (!authEmail) throw error(400, { message: 'User has no email' });

		const { error: resetError } = await supabase.auth.resetPasswordForEmail(authEmail, {
			redirectTo: `${event.url.origin}${ROUTES.accountPassword}`
		});
		if (resetError) throw error(400, { message: resetError.message });
		return json({ message: `Reset link sent to ${authEmail}` });
	}

	const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${event.url.origin}${ROUTES.accountPassword}`
	});
	if (resetError) throw error(400, { message: resetError.message });

	return json({ message: `Reset link sent to ${email}` });
};
