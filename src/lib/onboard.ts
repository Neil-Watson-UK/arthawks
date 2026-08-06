import { extractArtStyles, isArtStyle, type ArtStyle } from '$lib/constants/art-styles';
import {
	findRoute,
	hubForUserType,
	routeForUserType,
	ROUTES,
	type OnboardUserType
} from '$lib/constants/routes';
import { setCurrentUser, setTastePreferences } from '$lib/stores/network';

const ARTIST_SIGNALS = ['paint', 'canvas', 'artist', 'creator', 'painter', 'studio'];
const VENUE_SIGNALS = [
	'cafe',
	'café',
	'cafes',
	'cafés',
	'pub',
	'venue',
	'walls',
	'co-working',
	'coworking',
	'gallery',
	'restaurant',
	'bar'
];
/*
 * Default simulated identity per gateway audience.
 * Users can refine via the Identity Switcher after landing.
 */
export const DEFAULT_IDENTITY_BY_ROLE: Record<OnboardUserType, string> = {
	artist: 'a0000000-0000-4000-8000-000000000001',
	venue: 'c0000000-0000-4000-8000-000000000001',
	buyer: 'b0000000-0000-4000-8000-000000000099'
};

export function isOnboardUserType(value: string): value is OnboardUserType {
	return value === 'artist' || value === 'venue' || value === 'buyer';
}

export function classifyOnboardInput(input: string): OnboardUserType {
	const normalized = input.trim().toLowerCase();
	if (!normalized) return 'buyer';

	const hasArtist = ARTIST_SIGNALS.some((signal) => normalized.includes(signal));
	const hasVenue = VENUE_SIGNALS.some((signal) => normalized.includes(signal));

	if (hasArtist && !hasVenue) return 'artist';
	if (hasVenue && !hasArtist) return 'venue';

	return 'buyer';
}

type OnboardBody = {
	text?: string;
	type?: string;
	intent?: string;
	styles?: string;
};

export interface GatewayIntent {
	userType: OnboardUserType;
	styles: ArtStyle[];
}

/*
 * Free text does two jobs:
 * 1) Routes the visitor (artist / venue / guest)
 * 2) Captures art styles they mention for later curation
 */
export function parseGatewayIntent(body: OnboardBody): GatewayIntent | null {
	let userType: OnboardUserType | null = null;

	if (body.type && isOnboardUserType(body.type)) {
		userType = body.type;
	} else if (body.intent && body.intent !== 'text' && isOnboardUserType(body.intent)) {
		userType = body.intent;
	} else if (body.text?.trim()) {
		userType = classifyOnboardInput(body.text);
	}

	if (!userType) return null;

	const fromText = body.text ? extractArtStyles(body.text) : [];
	const fromList = (body.styles ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(isArtStyle);

	return {
		userType,
		styles: [...new Set([...fromText, ...fromList])]
	};
}

export function resolveOnboardUserType(body: OnboardBody): OnboardUserType | null {
	return parseGatewayIntent(body)?.userType ?? null;
}

export function applyGatewayIdentity(userType: OnboardUserType, styles: ArtStyle[] = []): void {
	/* Only explorers get a guest identity immediately - artists/venues sell first, then register */
	if (userType === 'buyer') {
		setCurrentUser(DEFAULT_IDENTITY_BY_ROLE[userType]);
	}
	if (styles.length > 0) {
		setTastePreferences(styles);
	}
}

/**
 * Artists / venues land on theatrical pitch pages first, then register.
 * Explorers (and free-text taste) land on /find with matching rooms & artists.
 */
export function redirectForUserType(userType: OnboardUserType, styles: ArtStyle[] = []): string {
	if (userType === 'buyer') return findRoute(styles);
	if (userType === 'artist') return ROUTES.whyExhibit;
	if (userType === 'venue') return ROUTES.whyHost;
	return routeForUserType(userType);
}

/** Free-text gateway continue → taste results (even if signals hint artist/venue). */
export function redirectForTasteExplore(styles: ArtStyle[], prompt?: string | null): string {
	return findRoute(styles, prompt);
}