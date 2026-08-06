import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	parseGatewayIntent,
	redirectForTasteExplore,
	redirectForUserType
} from '$lib/onboard';
import { onboardTypeToProfileUserType } from '$lib/server/profile';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';

type OnboardRequestBody = {
	text?: string;
	type?: string;
	/* Legacy gateway payload from Phase 1 */
	intent?: string;
	/* Comma-separated art styles from gateway chips / free text */
	styles?: string;
	/* Taste form: always land on /find matches */
	taste_explore?: string;
};

export const POST: RequestHandler = async (event) => {
	let body: OnboardRequestBody;

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const intent = parseGatewayIntent(body);

	if (!intent) {
		throw error(400, {
			message: 'Please provide a type selection or describe who you are in the text field.'
		});
	}

	const userType = intent.userType;
	const tasteExplore = body.taste_explore === '1' || body.taste_explore === 'true';

	/* Persist routing intent for visitors who have not authenticated yet */
	event.cookies.set('arthawks_intent', tasteExplore ? 'buyer' : userType, {
		path: '/',
		maxAge: 60 * 60 * 24 * 30,
		httpOnly: true,
		sameSite: 'lax'
	});

	/* Taste cookie is readable client-side so Discover / Find can prefer matching styles */
	if (intent.styles.length > 0) {
		event.cookies.set('arthawks_taste', intent.styles.join(','), {
			path: '/',
			maxAge: 60 * 60 * 24 * 30,
			httpOnly: false,
			sameSite: 'lax'
		});
	}

	const routeUserType = tasteExplore ? 'buyer' : userType;
	const profileUserType = onboardTypeToProfileUserType(routeUserType);
	const { session, supabase } = event.locals;

	/*
	 * Anonymous gateway clicks (I host a room / I make the work / exploring)
	 * only need cookies + redirect. Never upsert seed UUIDs into profiles -
	 * those require auth.users rows and are quarantined for pilot.
	 */
	const skipProfileWrite = !session?.user;

	if (!skipProfileWrite && hasPublicSupabaseEnv()) {
		const profileId = session!.user!.id;
		const username =
			session!.user!.email?.split('@')[0]?.slice(0, 30) ?? `user_${profileId.slice(0, 8)}`;
		const fullName =
			typeof session!.user!.user_metadata?.full_name === 'string'
				? session!.user!.user_metadata.full_name
				: null;

		try {
			const client =
				supabase ??
				(() => {
					try {
						return createServiceClient();
					} catch {
						return null;
					}
				})();

			if (client) {
				const { error: profileError } = await client.from('profiles').upsert(
					{
						id: profileId,
						username,
						full_name: fullName,
						user_type: profileUserType
					},
					{ onConflict: 'id' }
				);

				if (profileError) {
					console.error('Profile upsert failed:', profileError);
					throw error(500, { message: 'Failed to save your profile preference' });
				}
			}
		} catch (err) {
			if (err && typeof err === 'object' && 'status' in err) throw err;
			console.error('Onboard profile write skipped:', err);
		}
	}

	return json({
		user_type: routeUserType,
		styles: intent.styles,
		profile_id: session?.user?.id ?? null,
		redirectTo: tasteExplore
			? redirectForTasteExplore(intent.styles, body.text ?? null)
			: redirectForUserType(routeUserType, intent.styles)
	});
};
