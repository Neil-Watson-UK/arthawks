export const ROUTES = {
	home: '/',
	login: '/login',
	logout: '/logout',
	forgotPassword: '/forgot-password',
	accountPassword: '/account/password',
	whyHost: '/why/host',
	whyExhibit: '/why/exhibit',
	onboardArtist: '/onboard/artist',
	onboardVenue: '/onboard/venue',
	onboardBuyer: '/onboard/buyer',
	artist: '/artist',
	artistPromote: '/artist/promote',
	artistInbox: '/artist/inbox',
	venue: '/venue',
	venueSettings: '/venue/settings',
	venueSwipe: '/venue/swipe',
	venueCurate: '/venue/curate',
	venuePromote: '/venue/promote',
	venueCalendar: '/venue/calendar',
	venuePulse: '/venue/pulse',
	venueCollect: '/venue/collect',
	discover: '/discover',
	discoverSwipe: '/discover/swipe',
	find: '/find',
	map: '/map',
	rooms: '/rooms',
	artists: '/artists',
	admin: '/admin',
	adminUsers: '/admin/users',
	adminVenues: '/admin/venues',
	adminProspects: '/admin/venues/prospects',
	adminClaims: '/admin/venues/claims',
	adminArtworks: '/admin/artworks',
	adminMatches: '/admin/matches',
	adminFinance: '/admin/finance',
	adminInbox: '/admin/inbox',
	spaces: '/spaces',
	contact: '/contact',
	art: '/art',
	pickup: '/pickup'
} as const;

export function pickupVerifyRoute(token: string): string {
	return `${ROUTES.pickup}/${encodeURIComponent(token)}`;
}

export function artworkRoute(id: string): string {
	return `${ROUTES.art}/${id}`;
}

export function roomRoute(venueId: string): string {
	return `${ROUTES.rooms}/${venueId}`;
}

export function spaceRoute(prospectId: string): string {
	return `${ROUTES.spaces}/${prospectId}`;
}

export function claimSpaceRoute(prospectId: string): string {
	return `${ROUTES.spaces}/${prospectId}/claim`;
}

export function artistRoute(usernameOrId: string): string {
	return `${ROUTES.artists}/${encodeURIComponent(usernameOrId)}`;
}

/* Gateway-facing audience type returned by onboarding */
export type OnboardUserType = 'artist' | 'venue' | 'buyer';

export function routeForUserType(
	userType: OnboardUserType | 'artist' | 'venue' | 'admin' | string
): string {
	switch (userType) {
		case 'artist':
			return ROUTES.onboardArtist;
		case 'venue':
			return ROUTES.onboardVenue;
		case 'buyer':
			return ROUTES.onboardBuyer;
		case 'admin':
			return ROUTES.admin;
		default:
			return ROUTES.home;
	}
}

/* After registration / login, land on the working hub */
export function hubForUserType(
	userType: OnboardUserType | 'artist' | 'venue' | 'admin' | string
): string {
	switch (userType) {
		case 'artist':
			return ROUTES.artist;
		case 'venue':
			return ROUTES.venue;
		case 'buyer':
			return ROUTES.find;
		case 'admin':
			return ROUTES.admin;
		default:
			return ROUTES.home;
	}
}

/** Explorer taste results with optional style query string */
export function findRoute(styles: string[] = [], prompt?: string | null): string {
	const params = new URLSearchParams();
	if (styles.length) params.set('styles', styles.join(','));
	if (prompt?.trim()) params.set('q', prompt.trim().slice(0, 180));
	const qs = params.toString();
	return qs ? `${ROUTES.find}?${qs}` : ROUTES.find;
}
