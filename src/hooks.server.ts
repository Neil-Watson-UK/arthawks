import { createRequestClient } from '$lib/server/supabase';
import type { Database } from '$lib/types/database';
import type { Handle } from '@sveltejs/kit';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.supabase = null;
	event.locals.session = null;
	event.locals.profile = null;

	try {
		const supabase = await createRequestClient(event);
		event.locals.supabase = supabase;

		if (supabase) {
			const {
				data: { user }
			} = await supabase.auth.getUser();

			if (user) {
				const { data: profile } = await supabase
					.from('profiles')
					.select('*')
					.eq('id', user.id)
					.maybeSingle();

				const row = profile as ProfileRow | null;
				if (row && row.is_active === false) {
					await supabase.auth.signOut();
					event.locals.session = null;
					event.locals.profile = null;
				} else {
					const {
						data: { session }
					} = await supabase.auth.getSession();
					event.locals.session = session;
					event.locals.profile = row;
				}
			}
		}
	} catch (err) {
		/*
		 * Supabase may be misconfigured or unreachable during local prototype work.
		 * Fall back to anonymous mode instead of failing every route with a 500.
		 */
		console.error('Supabase session bootstrap failed:', err);
	}

	return resolve(event);
};
