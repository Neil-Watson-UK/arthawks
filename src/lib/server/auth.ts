import { redirect } from '@sveltejs/kit';
import { hubForUserType, ROUTES, type OnboardUserType } from '$lib/constants/routes';
import type { UserType } from '$lib/types/database';
import type { RequestEvent } from '@sveltejs/kit';

export function redirectIfAuthenticatedProfile(event: RequestEvent): void {
	const profile = event.locals.profile;
	if (!profile) return;
	if (profile.is_active === false) {
		throw redirect(303, ROUTES.login);
	}
	throw redirect(303, hubForUserType(profile.user_type));
}

export function requireSession(event: RequestEvent) {
	if (!event.locals.session) {
		throw redirect(303, ROUTES.login);
	}

	return event.locals.session;
}

export function requireUserType(event: RequestEvent, allowed: UserType | UserType[]) {
	requireSession(event);

	const profile = event.locals.profile;
	const allowedTypes = Array.isArray(allowed) ? allowed : [allowed];

	if (!profile || !allowedTypes.includes(profile.user_type)) {
		throw redirect(303, ROUTES.home);
	}

	if (profile.is_active === false) {
		throw redirect(303, ROUTES.login);
	}

	return profile;
}

export function readIntentCookie(event: RequestEvent): OnboardUserType | null {
	const value = event.cookies.get('arthawks_intent');
	if (value === 'artist' || value === 'venue' || value === 'buyer') {
		return value;
	}

	return null;
}
