import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { isArtStyle, type ArtStyle } from '$lib/constants/art-styles';
import { resolveSubstrateTier, type SubstrateTier } from '$lib/constants/auto-amor';
import {
	isSeedArtworkId,
	isSeedArtistId,
	isSeedVenueId
} from '$lib/constants/seed-ids';
import {
	artworkImageUrl,
	getArtistById,
	gbpToPence,
	mockArtworkListings,
	type MockArtworkListing
} from '$lib/data/mock-artists';
import {
	DEFAULT_SIMULATED_USER_ID,
	DISTRICT_COORDINATES,
	getSimulatedUserById,
	SIMULATED_USERS,
	type SimulatedUser,
	type SimulatedVenueProfile
} from '$lib/data/simulated-users';
import { getIdentityById, listIdentities, rememberIdentity } from '$lib/data/identity';
import { mockFallbacksAllowed } from '$lib/mock-fallbacks';
import { placementForHang } from '$lib/scheduling';
import { isSupabaseConfigured, supabase } from '$lib/supabaseClient';
import type {
	ArtworkStatus,
	InteractionType,
	MatchStatus,
	UserType,
	Database
} from '$lib/types/database';
import type { SwipeCard } from '$lib/types/swipe';

const TASTE_STORAGE_KEY = 'arthawks_taste';

export type { SimulatedUser } from '$lib/data/simulated-users';
export { SIMULATED_USERS } from '$lib/data/simulated-users';
export { allIdentities, listIdentities, rememberIdentity } from '$lib/data/identity';

type ArtworkRow = Database['public']['Tables']['artworks']['Row'];
type MatchRow = Database['public']['Tables']['matches']['Row'];
type SocialRow = Database['public']['Tables']['social_interactions']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface NetworkArtwork extends MockArtworkListing {
	status: ArtworkStatus;
	created_at: string;
	/** Artist-written descriptor, max 2000 characters */
	description?: string | null;
	/** Visual class - landscape, figurative, graphic, portrait, abstract */
	style?: ArtStyle | null;
	substrate_tier?: SubstrateTier;
	is_plug_and_play?: boolean;
	/** Object URL for local uploads; static assets / Storage URLs use image_url */
	image_url?: string;
}

export interface NetworkMatch {
	id: string;
	venue_id: string;
	artwork_id: string;
	status: MatchStatus;
	created_at: string;
	approved_at?: string | null;
	hung_at?: string | null;
	starts_on?: string | null;
	ends_on?: string | null;
}

export interface NetworkSocialInteraction {
	id: string;
	user_id: string;
	username: string;
	artwork_id: string;
	interaction_type: InteractionType;
	content: string | null;
	created_at: string;
}

export const networkReady = writable(false);
export const networkError = writable<string | null>(null);

export interface ProfileLookup {
	username: string;
	full_name: string | null;
	user_type: UserType | null;
	bio?: string | null;
	website?: string | null;
	instagram?: string | null;
}

const profileCache = writable<Record<string, ProfileLookup>>({});

function seedArtworks(): NetworkArtwork[] {
	return mockArtworkListings.map((artwork) => {
		const substrate = resolveSubstrateTier(
			artwork.substrate_tier,
			artwork.height_cm,
			artwork.width_cm
		);
		return {
			...artwork,
			description: artwork.description ?? null,
			...substrate,
			status: 'available' as const,
			created_at: '2026-07-01T10:00:00Z'
		};
	});
}

function isPersistableImageUrl(url: string | undefined): boolean {
	if (!url?.trim()) return false;
	/* blob: and data: URLs are session-local and must never drive swipe hydration */
	if (url.startsWith('blob:') || url.startsWith('data:')) return false;
	return true;
}

function resolveImageUrl(artwork: NetworkArtwork): string {
	if (artwork.image_url?.startsWith('blob:')) return artwork.image_url;
	if (isPersistableImageUrl(artwork.image_url)) return artwork.image_url!;
	return artworkImageUrl(artwork.image_filename);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const toRadians = (value: number) => (value * Math.PI) / 180;
	const earthRadius = 6371000;
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;

	return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function distanceBetweenDistricts(
	venueDistrict: SimulatedVenueProfile['district'],
	artistDistrict: string
): number {
	const venueCoords = DISTRICT_COORDINATES[venueDistrict];
	const artistCoords = DISTRICT_COORDINATES[artistDistrict as keyof typeof DISTRICT_COORDINATES];

	if (!venueCoords || !artistCoords) return 1500;

	return haversineMeters(venueCoords.lat, venueCoords.lng, artistCoords.lat, artistCoords.lng);
}

/*
 * Map soft venue aesthetics onto the shared style vocabulary.
 */
function venuePreferredStyles(venue: SimulatedVenueProfile): ArtStyle[] {
	const styles = new Set<ArtStyle>();

	for (const tag of venue.aesthetic_tags) {
		if (tag === 'bohemian' || tag === 'eclectic') {
			styles.add('figurative');
			styles.add('graphic');
		}
		if (tag === 'minimalist' || tag === 'clean') {
			styles.add('abstract');
			styles.add('landscape');
		}
		if (tag === 'contemporary') {
			styles.add('graphic');
			styles.add('abstract');
			styles.add('portrait');
		}
	}

	return [...styles];
}

function scoreArtworkForVenue(
	artwork: NetworkArtwork,
	venue: SimulatedVenueProfile,
	taste: ArtStyle[] = []
): number {
	const artist = getArtistById(artwork.artist_id);
	const medium = artwork.medium.toLowerCase();
	let score = 0;

	for (const preferred of venue.preferred_media) {
		if (medium.includes(preferred.toLowerCase())) {
			score += 3;
		}
	}

	const preferredStyles = venuePreferredStyles(venue);
	if (artwork.style && preferredStyles.includes(artwork.style)) {
		score += 4;
	}

	/* Guest / gateway taste - what someone said they were looking for */
	if (artwork.style && taste.includes(artwork.style)) {
		score += 5;
	}

	if (venue.aesthetic_tags.includes('bohemian')) {
		if (medium.includes('oil') || medium.includes('mixed')) score += 2;
		if ((artwork.spottings?.length ?? 0) > 0) score += 1;
	}

	if (venue.aesthetic_tags.includes('minimalist')) {
		if (medium.includes('acrylic') || medium.includes('watercolor') || medium.includes('ink')) {
			score += 2;
		}
		if (medium.includes('oil') && artwork.title.length > 18) score -= 1;
	}

	if (venue.footfall === 'high' && (artwork.spottings?.length ?? 0) > 0) {
		score += 1;
	}

	/* Auto Amor boards mate with standard venue anchors - prioritize for hang readiness */
	if (artwork.is_plug_and_play) {
		score += 12;
	}

	const distance = artist
		? distanceBetweenDistricts(venue.district, artist.district)
		: artwork.distance_meters;

	score -= distance / 900;

	return score;
}

function artworkDistanceForVenue(artwork: NetworkArtwork, venue: SimulatedVenueProfile): number {
	const artist = getArtistById(artwork.artist_id);
	if (!artist) return artwork.distance_meters;

	return distanceBetweenDistricts(venue.district, artist.district);
}

export function isBlobImageUrl(url: string | undefined): url is string {
	return typeof url === 'string' && url.startsWith('blob:');
}

export function revokeBlobImageUrl(url: string | undefined): void {
	if (!isBlobImageUrl(url)) return;
	URL.revokeObjectURL(url);
}

/*
 * Revoke a locally uploaded preview once the artwork is permanently removed.
 * Matched and discover views keep blob URLs alive for the prototype session.
 */
export function releaseArtworkImage(artworkId: string): void {
	artworks.update((list) =>
		list.map((artwork) => {
			if (artwork.id !== artworkId) return artwork;
			revokeBlobImageUrl(artwork.image_url);
			return { ...artwork, image_url: undefined };
		})
	);
}

function mapArtworkRow(row: ArtworkRow): NetworkArtwork {
	const rawUrl = row.image_url ?? '';
	const persistable = isPersistableImageUrl(rawUrl);
	const filename = rawUrl.startsWith('/artworks/')
		? rawUrl.replace('/artworks/', '')
		: '';

	/*
	 * Seed catalogue IDs keep mock list prices only when demoware fallbacks are on.
	 */
	const seed = mockFallbacksAllowed()
		? mockArtworkListings.find((item) => item.id === row.id)
		: undefined;
	const height = Number(row.height_cm ?? seed?.height_cm ?? 0);
	const width = Number(row.width_cm ?? seed?.width_cm ?? 0);
	const substrate = resolveSubstrateTier(
		row.substrate_tier ?? seed?.substrate_tier,
		height,
		width
	);

	return {
		id: row.id,
		artist_id: row.artist_id,
		title: row.title,
		medium: row.medium ?? '',
		description: row.description ?? seed?.description ?? null,
		style: (row.style && isArtStyle(row.style) ? row.style : null) ?? seed?.style ?? null,
		price: seed?.price ?? row.price_pence,
		height_cm: height,
		width_cm: width,
		...substrate,
		image_filename: filename || seed?.image_filename || '',
		image_url: persistable ? rawUrl : undefined,
		distance_meters: seed?.distance_meters ?? 1500,
		status: row.status,
		created_at: row.created_at,
		spottings: seed?.spottings ?? []
	};
}

function mapMatchRow(row: MatchRow): NetworkMatch {
	const withHung = row as MatchRow & { hung_at?: string | null };
	return {
		id: row.id,
		venue_id: row.venue_id,
		artwork_id: row.artwork_id,
		status: row.status,
		created_at: row.created_at,
		approved_at: row.approved_at ?? null,
		hung_at:
			'hung_at' in withHung ? (withHung.hung_at ?? null) : (row.approved_at ?? null),
		starts_on: row.starts_on ?? null,
		ends_on: row.ends_on ?? null
	};
}

function mapSocialRow(
	row: SocialRow,
	profiles: Record<string, ProfileLookup>
): NetworkSocialInteraction {
	const simulated = getSimulatedUserById(row.user_id);

	return {
		id: row.id,
		user_id: row.user_id,
		username: profiles[row.user_id]?.username ?? simulated?.username ?? 'guest',
		artwork_id: row.artwork_id,
		interaction_type: row.interaction_type,
		content: row.content,
		created_at: row.created_at
	};
}

function resolveProfileName(profileId: string, profiles: Record<string, ProfileLookup>): string {
	const cached = profiles[profileId];
	if (cached?.full_name) return cached.full_name;
	if (cached?.username) return cached.username;

	const simulated = getSimulatedUserById(profileId);
	return simulated?.full_name ?? simulated?.username ?? 'a local venue';
}

export function artworkToSwipeCard(
	artwork: NetworkArtwork,
	distanceMeters = artwork.distance_meters
): SwipeCard {
	const artist = getArtistById(artwork.artist_id);
	const cached = get(profileCache)[artwork.artist_id];

	const substrate = resolveSubstrateTier(
		artwork.substrate_tier,
		artwork.height_cm,
		artwork.width_cm
	);

	return {
		id: artwork.id,
		artist_id: artwork.artist_id,
		title: artwork.title,
		medium: artwork.medium,
		description: artwork.description ?? null,
		style: artwork.style ?? null,
		price: artwork.price,
		height_cm: artwork.height_cm,
		width_cm: artwork.width_cm,
		image_url: resolveImageUrl(artwork),
		status: artwork.status,
		created_at: artwork.created_at,
		distance_meters: distanceMeters,
		artist_username: artist?.username ?? cached?.username ?? 'unknown',
		artist_full_name: artist?.full_name ?? cached?.full_name ?? null,
		...substrate,
		spottings: artwork.spottings ?? []
	};
}

const defaultUser = getSimulatedUserById(DEFAULT_SIMULATED_USER_ID) ?? SIMULATED_USERS[0];

export const currentUser = writable<SimulatedUser>(defaultUser);
export const artworks = writable<NetworkArtwork[]>(
	isSupabaseConfigured && !mockFallbacksAllowed() ? [] : seedArtworks()
);
export const matches = writable<NetworkMatch[]>([]);
export const socialInteractions = writable<NetworkSocialInteraction[]>([]);

function readStoredTaste(): ArtStyle[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(TASTE_STORAGE_KEY);
		if (!raw) return [];
		return raw
			.split(',')
			.map((value) => value.trim())
			.filter(isArtStyle);
	} catch {
		return [];
	}
}

/*
 * Styles a guest said they were looking for - shapes Discover order and Curate for Me.
 */
export const tastePreferences = writable<ArtStyle[]>(readStoredTaste());

export function setTastePreferences(styles: ArtStyle[]): void {
	const unique = [...new Set(styles.filter(isArtStyle))];
	tastePreferences.set(unique);

	if (browser) {
		try {
			if (unique.length === 0) localStorage.removeItem(TASTE_STORAGE_KEY);
			else localStorage.setItem(TASTE_STORAGE_KEY, unique.join(','));
		} catch {
			/* ignore quota / private mode */
		}
	}
}

export function setCurrentUser(userId: string): void {
	const user = getIdentityById(userId);
	if (user) {
		currentUser.set(user);
		if (browser) {
			try {
				localStorage.setItem('arthawks_current_user', userId);
			} catch {
				/* ignore */
			}
		}
	}
}

export function setActiveIdentity(user: SimulatedUser): void {
	rememberIdentity(user);
	currentUser.set(user);
	if (browser) {
		try {
			localStorage.setItem('arthawks_current_user', user.id);
		} catch {
			/* ignore */
		}
	}
}

/** Clear client identity after sign-out (falls back to seed guest). */
export function clearSessionIdentity(): void {
	const guest =
		SIMULATED_USERS.find((user) => user.role === 'buyer') ??
		getSimulatedUserById(DEFAULT_SIMULATED_USER_ID) ??
		SIMULATED_USERS[0];
	currentUser.set(guest);
	if (browser) {
		try {
			localStorage.removeItem('arthawks_current_user');
		} catch {
			/* ignore */
		}
	}
}

export function getActiveArtistId(): string | null {
	const user = get(currentUser);
	return user.role === 'artist' ? user.id : null;
}

export function getActiveVenueId(): string | null {
	const user = get(currentUser);
	return user.role === 'venue' ? user.id : null;
}

export const artistDashboard = derived([artworks, matches, currentUser], ([$artworks, $matches, $user]) => {
	if ($user.role !== 'artist') return null;

	const works = $artworks.filter((artwork) => artwork.artist_id === $user.id);

	return {
		artist: $user,
		works,
		stats: {
			total: works.length,
			available: works.filter((work) => work.status === 'available').length,
			matched: works.filter((work) => work.status === 'matched').length,
			sold: works.filter((work) => work.status === 'sold').length,
			pendingDelivery: $matches.filter((match) => {
				const artwork = works.find((work) => work.id === match.artwork_id);
				return artwork && match.status === 'pending';
			}).length
		}
	};
});

export const availableSwipeCards = derived(
	[artworks, matches, currentUser],
	([$artworks, $matches, $user]) => {
		if ($user.role !== 'venue') return [];

		const venue = $user as SimulatedVenueProfile;
		const seen = new Set(
			$matches.filter((match) => match.venue_id === venue.id).map((match) => match.artwork_id)
		);

		return $artworks
			.filter((artwork) => artwork.status === 'available' && !seen.has(artwork.id))
			.map((artwork) => artworkToSwipeCard(artwork, artworkDistanceForVenue(artwork, venue)))
			.sort((a, b) => {
				if (a.is_plug_and_play !== b.is_plug_and_play) {
					return a.is_plug_and_play ? -1 : 1;
				}
				return a.distance_meters - b.distance_meters;
			});
	}
);

export const venueCuratedCollection = derived(
	[artworks, currentUser, tastePreferences],
	([$artworks, $user, $taste]) => {
		if ($user.role !== 'venue') return [];

		const venue = $user as SimulatedVenueProfile;

		return $artworks
			.filter((artwork) => artwork.status === 'available')
			.map((artwork) => ({
				artwork,
				score: scoreArtworkForVenue(artwork, venue, $taste),
				distance: artworkDistanceForVenue(artwork, venue)
			}))
			.sort((a, b) => {
				if (Boolean(a.artwork.is_plug_and_play) !== Boolean(b.artwork.is_plug_and_play)) {
					return a.artwork.is_plug_and_play ? -1 : 1;
				}
				return b.score - a.score;
			})
			.slice(0, 5)
			.map((row) => artworkToSwipeCard(row.artwork, row.distance));
	}
);

export const matchedArtworks = derived(artworks, ($artworks) =>
	$artworks.filter((a) => a.status === 'matched')
);

export const availableArtworks = derived(artworks, ($artworks) =>
	$artworks.filter((a) => a.status === 'available')
);

export const venueActiveMatches = derived(
	[matches, artworks, currentUser],
	([$matches, $artworks, $user]) => {
		if ($user.role !== 'venue') return [];

		return $matches
			.filter(
				(match) =>
					match.venue_id === $user.id &&
					(match.status === 'pending' || match.status === 'accepted')
			)
			.map((match) => {
				const artwork = $artworks.find((a) => a.id === match.artwork_id);
				const artist = artwork ? getArtistById(artwork.artist_id) : undefined;
				return {
					match,
					artwork,
					artistName: artist?.full_name ?? 'Unknown artist'
				};
			})
			.filter((row) => row.artwork);
	}
);

export interface ArtworkPlacement {
	venue_id: string;
	venue_name: string;
	match_status: MatchStatus;
	approved_at: string | null;
	placement: 'showing' | 'transit';
}

export interface DiscoverFeedCard extends SwipeCard {
	spotting_count: number;
	/** Present when a venue has claimed interest / hung the work */
	placement: ArtworkPlacement | null;
}

export interface CityRoom {
	venue_id: string;
	venue_name: string;
	location: string;
	bio: string | null;
	image_url: string | null;
	work_count: number;
	works: DiscoverFeedCard[];
}

/*
 * The city gallery - every living work (available on the compass + hung on walls).
 * Sold pieces leave quietly; appreciation stays centre stage.
 */
export const discoverFeed = derived(
	[artworks, matches, socialInteractions, profileCache, tastePreferences],
	([$artworks, $matches, $social, $profiles, $taste]) => {
		const spottingCounts = new Map<string, number>();

		for (const row of $social) {
			if (row.interaction_type !== 'spotted_at_venue') continue;
			spottingCounts.set(row.artwork_id, (spottingCounts.get(row.artwork_id) ?? 0) + 1);
		}

		/* Prefer confirmed hangs over pending interest when placing a work */
		const placementByArtwork = new Map<string, ArtworkPlacement>();

		const rankedMatches = [...$matches].sort((a, b) => {
			const rank = (match: NetworkMatch) => {
				const place = placementForHang(match);
				if (place === 'showing') return 0;
				if (match.status === 'accepted') return 1;
				if (match.status === 'pending') return 2;
				return 3;
			};
			return rank(a) - rank(b);
		});

		for (const match of rankedMatches) {
			if (match.status !== 'pending' && match.status !== 'accepted') continue;
			if (placementByArtwork.has(match.artwork_id)) continue;

			placementByArtwork.set(match.artwork_id, {
				venue_id: match.venue_id,
				venue_name: resolveProfileName(match.venue_id, $profiles),
				match_status: match.status,
				approved_at: match.approved_at ?? null,
				placement: placementForHang(match)
			});
		}

		const gallery = $artworks.filter((artwork) => {
			if (artwork.status === 'sold') return false;
			if (!mockFallbacksAllowed()) {
				if (isSeedArtworkId(artwork.id) || isSeedArtistId(artwork.artist_id)) return false;
			}
			return true;
		});

		const cards: DiscoverFeedCard[] = gallery
			.map((artwork) => ({
				...artworkToSwipeCard(artwork),
				spotting_count: spottingCounts.get(artwork.id) ?? 0,
				placement: (() => {
					const placement = placementByArtwork.get(artwork.id) ?? null;
					if (
						placement &&
						!mockFallbacksAllowed() &&
						isSeedVenueId(placement.venue_id)
					) {
						return null;
					}
					return placement;
				})()
			}))
			.sort((a, b) => {
				const aHung = a.placement?.placement === 'showing' ? 0 : 1;
				const bHung = b.placement?.placement === 'showing' ? 0 : 1;
				if (aHung !== bHung) return aHung - bHung;

				const aTaste = a.style && $taste.includes(a.style) ? 0 : 1;
				const bTaste = b.style && $taste.includes(b.style) ? 0 : 1;
				if (aTaste !== bTaste) return aTaste - bTaste;

				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
			});

		const roomsMap = new Map<string, CityRoom>();

		for (const card of cards) {
			if (!card.placement) continue;
			if (!mockFallbacksAllowed() && isSeedVenueId(card.placement.venue_id)) continue;

			const existing = roomsMap.get(card.placement.venue_id);
			if (existing) {
				existing.works.push(card);
				existing.work_count += 1;
				continue;
			}

			const simulated = mockFallbacksAllowed()
				? getSimulatedUserById(card.placement.venue_id)
				: null;
			const cached = $profiles[card.placement.venue_id];
			roomsMap.set(card.placement.venue_id, {
				venue_id: card.placement.venue_id,
				venue_name: card.placement.venue_name,
				location: simulated?.role === 'venue' ? simulated.location : 'Nearby',
				bio:
					simulated?.role === 'venue'
						? (simulated.bio ?? null)
						: (cached?.bio ?? null),
				image_url:
					simulated?.role === 'venue' ? (simulated.image_url ?? null) : null,
				work_count: 1,
				works: [card]
			});
		}

		/* Dedupe rooms that share a display name (e.g. two Gallimaufrys) - keep the fullest */
		const rooms = [...roomsMap.values()]
			.sort((a, b) => b.work_count - a.work_count)
			.reduce<CityRoom[]>((acc, room) => {
				const key = room.venue_name.trim().toLowerCase();
				const prior = acc.find((row) => row.venue_name.trim().toLowerCase() === key);
				if (!prior) {
					acc.push(room);
					return acc;
				}
				if (room.work_count > prior.work_count) {
					const idx = acc.indexOf(prior);
					acc[idx] = room;
				}
				return acc;
			}, []);

		return {
			artworks: cards,
			rooms,
			on_walls: cards.filter((card) => card.placement?.placement === 'showing').length,
			available_count: cards.filter((card) => card.status === 'available').length,
			/* Legacy alias */
			matched: cards,
			interactions: [...$social]
				.filter((row) => row.interaction_type === 'spotted_at_venue')
				.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
		};
	}
);

export function generateId(_prefix?: string): string {
	return crypto.randomUUID();
}

function upsertById<T extends { id: string }>(list: T[], row: T): T[] {
	const index = list.findIndex((item) => item.id === row.id);
	if (index === -1) return [row, ...list];
	const next = [...list];
	next[index] = row;
	return next;
}

function removeById<T extends { id: string }>(list: T[], id: string): T[] {
	return list.filter((item) => item.id !== id);
}

/*
 * Pull the current catalogue, matches, and social feed from Postgres.
 */
export async function hydrateNetworkFromSupabase(): Promise<void> {
	if (!supabase) {
		networkReady.set(true);
		networkError.set(null);
		return;
	}

	networkError.set(null);

	const [artworksRes, matchesRes, socialRes, profilesRes] = await Promise.all([
		supabase.from('artworks').select('*').order('created_at', { ascending: false }),
		supabase.from('matches').select('*').order('created_at', { ascending: false }),
		supabase.from('social_interactions').select('*').order('created_at', { ascending: false }),
		supabase.from('profiles').select('id, username, full_name, user_type, bio, website, instagram')
	]);

	if (artworksRes.error || matchesRes.error || socialRes.error || profilesRes.error) {
		const message =
			artworksRes.error?.message ??
			matchesRes.error?.message ??
			socialRes.error?.message ??
			profilesRes.error?.message ??
			'Failed to load network data';
		networkError.set(message);
		console.error('Supabase hydrate failed:', message);
		/* Do not keep seed catalogue when live Supabase is configured */
		if (isSupabaseConfigured && !mockFallbacksAllowed()) {
			artworks.set([]);
			matches.set([]);
			socialInteractions.set([]);
		}
		networkReady.set(true);
		return;
	}

	const profiles: Record<string, ProfileLookup> = {};

	/* Seed simulated names only when mock/demo mode is on */
	if (mockFallbacksAllowed()) {
		for (const user of SIMULATED_USERS) {
			profiles[user.id] = {
				username: user.username,
				full_name: user.full_name,
				user_type: user.role,
				bio: 'bio' in user ? (user.bio ?? null) : null,
				website: 'website' in user ? (user.website ?? null) : null,
				instagram: 'instagram' in user ? (user.instagram ?? null) : null
			};
		}
	}

	for (const profile of (profilesRes.data ?? []) as Pick<
		ProfileRow,
		'id' | 'username' | 'full_name' | 'user_type' | 'bio' | 'website' | 'instagram'
	>[]) {
		const prior = profiles[profile.id];
		profiles[profile.id] = {
			username: profile.username,
			full_name: profile.full_name,
			user_type: profile.user_type,
			bio: profile.bio ?? prior?.bio ?? null,
			website: profile.website ?? prior?.website ?? null,
			instagram: profile.instagram ?? prior?.instagram ?? null
		};
	}

	profileCache.set(profiles);

	artworks.set(
		((artworksRes.data ?? []) as ArtworkRow[])
			.filter((row) => mockFallbacksAllowed() || !isSeedArtworkId(row.id))
			.filter((row) => mockFallbacksAllowed() || !isSeedArtistId(row.artist_id))
			.map(mapArtworkRow)
	);
	matches.set(
		((matchesRes.data ?? []) as MatchRow[])
			.filter((row) => mockFallbacksAllowed() || !isSeedVenueId(row.venue_id))
			.filter((row) => mockFallbacksAllowed() || !isSeedArtworkId(row.artwork_id))
			.map(mapMatchRow)
	);
	socialInteractions.set(
		((socialRes.data ?? []) as SocialRow[]).map((row) => mapSocialRow(row, profiles))
	);

	networkReady.set(true);
}

let realtimeChannel: RealtimeChannel | null = null;

/*
 * Subscribe to Postgres changes so every connected client redraws live.
 */
export function startNetworkRealtime(): () => void {
	if (!supabase) {
		return () => undefined;
	}

	if (realtimeChannel) {
		return () => {
			if (supabase && realtimeChannel) {
				void supabase.removeChannel(realtimeChannel);
			}
			realtimeChannel = null;
		};
	}

	realtimeChannel = supabase
		.channel('arthawks-network')
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'artworks' },
			(payload) => {
				if (payload.eventType === 'DELETE') {
					const id = (payload.old as { id?: string }).id;
					if (id) artworks.update((list) => removeById(list, id));
					return;
				}

				const row = payload.new as ArtworkRow;
				artworks.update((list) => upsertById(list, mapArtworkRow(row)));
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'matches' },
			(payload) => {
				if (payload.eventType === 'DELETE') {
					const id = (payload.old as { id?: string }).id;
					if (id) matches.update((list) => removeById(list, id));
					return;
				}

				const row = payload.new as MatchRow;
				matches.update((list) => upsertById(list, mapMatchRow(row)));
			}
		)
		.on(
			'postgres_changes',
			{ event: '*', schema: 'public', table: 'social_interactions' },
			(payload) => {
				if (payload.eventType === 'DELETE') {
					const id = (payload.old as { id?: string }).id;
					if (id) socialInteractions.update((list) => removeById(list, id));
					return;
				}

				const row = payload.new as SocialRow;
				const profiles = get(profileCache);
				socialInteractions.update((list) => upsertById(list, mapSocialRow(row, profiles)));
			}
		)
		.subscribe((status) => {
			if (status === 'CHANNEL_ERROR') {
				console.error('ArtHawks realtime channel error');
			}
		});

	return () => {
		if (realtimeChannel && supabase) {
			void supabase.removeChannel(realtimeChannel);
			realtimeChannel = null;
		}
	};
}

/*
 * Boot sequence for the root layout - hydrate then keep the UI in sync.
 */
export async function initNetwork(options?: {
	preferSessionIdentity?: boolean;
	demoIdentities?: boolean;
}): Promise<() => void> {
	/* Ensure venue / artist names resolve before the first Discover paint */
	const seedProfiles: Record<string, ProfileLookup> = {};
	for (const user of SIMULATED_USERS) {
		seedProfiles[user.id] = {
			username: user.username,
			full_name: user.full_name,
			user_type: user.role,
			bio: 'bio' in user ? (user.bio ?? null) : null,
			website: 'website' in user ? (user.website ?? null) : null,
			instagram: 'instagram' in user ? (user.instagram ?? null) : null
		};
	}
	profileCache.update((cache) => ({ ...seedProfiles, ...cache }));

	await hydrateNetworkFromSupabase();

	if (browser && options?.demoIdentities && !options.preferSessionIdentity) {
		try {
			const saved = localStorage.getItem('arthawks_current_user');
			if (saved) setCurrentUser(saved);
		} catch {
			/* ignore */
		}
	}

	return startNetworkRealtime();
}

/*
 * Upload a local file into the public `artworks` Storage bucket and return its HTTPS URL.
 */
export async function uploadArtworkImage(file: File, artistId: string): Promise<string> {
	if (!supabase || !isSupabaseConfigured) {
		throw new Error('Supabase is not configured - cannot upload artwork image');
	}

	const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
	const safeExt = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
	const path = `${artistId}/${crypto.randomUUID()}.${safeExt}`;

	const { error } = await supabase.storage.from('artworks').upload(path, file, {
		cacheControl: '3600',
		upsert: false,
		contentType: file.type || 'image/jpeg'
	});

	if (error) {
		throw new Error(`Image upload failed: ${error.message}`);
	}

	const { data } = supabase.storage.from('artworks').getPublicUrl(path);
	return data.publicUrl;
}

export async function addArtwork(input: {
	artist_id?: string;
	title: string;
	medium: string;
	description?: string;
	style?: ArtStyle | null;
	price_gbp: number;
	height_cm: number;
	width_cm: number;
	substrate_tier?: SubstrateTier;
	image_filename?: string;
	image_url?: string;
	image_file?: File | null;
	distance_meters?: number;
}): Promise<NetworkArtwork> {
	const activeArtistId = getActiveArtistId();
	const artistId = input.artist_id ?? activeArtistId;

	if (!artistId) {
		throw new Error('addArtwork requires an active artist identity or explicit artist_id');
	}

	const description = normalizeDescription(input.description);
	const artist = getArtistById(artistId);
	const venueUser = get(currentUser);
	const distance =
		input.distance_meters ??
		(venueUser.role === 'venue'
			? distanceBetweenDistricts(venueUser.district, artist?.district ?? 'stokes_croft')
			: 1500);

	let imageUrl = isPersistableImageUrl(input.image_url)
		? input.image_url!
		: input.image_filename
			? artworkImageUrl(input.image_filename)
			: '';

	/*
	 * Prefer a real Storage upload. Never persist blob: URLs - they blank the
	 * swipe deck after reload or when another identity opens the catalogue.
	 */
	if (input.image_file && supabase && isSupabaseConfigured) {
		imageUrl = await uploadArtworkImage(input.image_file, artistId);
	} else if (input.image_url?.startsWith('blob:') && input.image_file == null) {
		throw new Error(
			'Artwork image must be uploaded to Storage. Re-select the file and submit again.'
		);
	}

	const style = input.style && isArtStyle(input.style) ? input.style : null;
	const substrate = resolveSubstrateTier(
		input.substrate_tier,
		input.height_cm,
		input.width_cm
	);

	if (supabase && isSupabaseConfigured) {
		const baseInsert = {
			artist_id: artistId,
			title: input.title.trim(),
			medium: input.medium,
			description,
			style,
			price_pence: gbpToPence(input.price_gbp),
			height_cm: input.height_cm,
			width_cm: input.width_cm,
			image_url: imageUrl,
			status: 'available' as const
		};

		let { data, error } = await supabase
			.from('artworks')
			.insert({ ...baseInsert, substrate_tier: substrate.substrate_tier })
			.select('*')
			.single();

		/* Column may be absent until Auto Amor migration is applied */
		if (error?.code === '42703') {
			({ data, error } = await supabase.from('artworks').insert(baseInsert).select('*').single());
		}

		if (error || !data) {
			throw new Error(error?.message ?? 'Failed to insert artwork');
		}

		const mapped = {
			...mapArtworkRow(data as ArtworkRow),
			distance_meters: distance,
			style: mapArtworkRow(data as ArtworkRow).style ?? style,
			...substrate,
			image_filename: input.image_filename ?? mapArtworkRow(data as ArtworkRow).image_filename,
			image_url: imageUrl || mapArtworkRow(data as ArtworkRow).image_url
		};

		artworks.update((list) => upsertById(list, mapped));
		return mapped;
	}

	const artwork: NetworkArtwork = {
		id: generateId(),
		artist_id: artistId,
		title: input.title.trim(),
		medium: input.medium,
		description,
		style,
		price: gbpToPence(input.price_gbp),
		height_cm: input.height_cm,
		width_cm: input.width_cm,
		...substrate,
		image_filename: input.image_filename ?? '',
		image_url: input.image_url ?? imageUrl,
		distance_meters: distance,
		status: 'available',
		created_at: new Date().toISOString(),
		spottings: []
	};

	artworks.update((list) => [artwork, ...list]);
	return artwork;
}

function normalizeDescription(value: string | undefined | null): string | null {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return null;
	if (trimmed.length > 2000) {
		throw new Error('Description must be 2000 characters or fewer');
	}
	return trimmed;
}

function assertOwnsArtwork(artworkId: string): NetworkArtwork {
	const artistId = getActiveArtistId();
	if (!artistId) {
		throw new Error('An artist identity is required to manage catalogue works');
	}

	const artwork = get(artworks).find((item) => item.id === artworkId);
	if (!artwork || artwork.artist_id !== artistId) {
		throw new Error('You can only manage works in your own catalogue');
	}

	return artwork;
}

/*
 * Update catalogue fields for an existing work owned by the active artist.
 */
export async function updateArtwork(
	artworkId: string,
	input: {
		title: string;
		medium: string;
		description?: string;
		style?: ArtStyle | null;
		price_gbp: number;
		height_cm: number;
		width_cm: number;
		substrate_tier?: SubstrateTier;
		image_file?: File | null;
	}
): Promise<NetworkArtwork> {
	const existing = assertOwnsArtwork(artworkId);
	const description = normalizeDescription(input.description);
	const style =
		input.style === undefined
			? (existing.style ?? null)
			: input.style && isArtStyle(input.style)
				? input.style
				: null;
	const substrate = resolveSubstrateTier(
		input.substrate_tier ?? existing.substrate_tier,
		input.height_cm,
		input.width_cm
	);
	let imageUrl = existing.image_url ?? artworkImageUrl(existing.image_filename);

	if (input.image_file && supabase && isSupabaseConfigured) {
		imageUrl = await uploadArtworkImage(input.image_file, existing.artist_id);
	}

	if (supabase && isSupabaseConfigured) {
		const baseUpdate = {
			title: input.title.trim(),
			medium: input.medium,
			description,
			style,
			price_pence: gbpToPence(input.price_gbp),
			height_cm: input.height_cm,
			width_cm: input.width_cm,
			image_url: imageUrl
		};

		let { data, error } = await supabase
			.from('artworks')
			.update({ ...baseUpdate, substrate_tier: substrate.substrate_tier })
			.eq('id', artworkId)
			.eq('artist_id', existing.artist_id)
			.select('*')
			.single();

		if (error?.code === '42703') {
			({ data, error } = await supabase
				.from('artworks')
				.update(baseUpdate)
				.eq('id', artworkId)
				.eq('artist_id', existing.artist_id)
				.select('*')
				.single());
		}

		if (error || !data) {
			throw new Error(error?.message ?? 'Failed to update artwork');
		}

		const mapped = {
			...mapArtworkRow(data as ArtworkRow),
			distance_meters: existing.distance_meters,
			spottings: existing.spottings,
			style: mapArtworkRow(data as ArtworkRow).style ?? style,
			...substrate
		};
		artworks.update((list) => upsertById(list, mapped));
		return mapped;
	}

	const mapped: NetworkArtwork = {
		...existing,
		title: input.title.trim(),
		medium: input.medium,
		description,
		style,
		price: gbpToPence(input.price_gbp),
		height_cm: input.height_cm,
		width_cm: input.width_cm,
		...substrate,
		image_url: imageUrl
	};
	artworks.update((list) => upsertById(list, mapped));
	return mapped;
}

/*
 * Soft-close a listing by marking it sold - removed from swipe decks automatically.
 */
export async function markArtworkSold(artworkId: string): Promise<void> {
	const existing = assertOwnsArtwork(artworkId);

	if (supabase && isSupabaseConfigured) {
		const { data, error } = await supabase
			.from('artworks')
			.update({ status: 'sold' })
			.eq('id', artworkId)
			.eq('artist_id', existing.artist_id)
			.select('*')
			.single();

		if (error || !data) {
			throw new Error(error?.message ?? 'Failed to mark artwork as sold');
		}

		artworks.update((list) => upsertById(list, mapArtworkRow(data as ArtworkRow)));
		return;
	}

	artworks.update((list) =>
		list.map((artwork) =>
			artwork.id === artworkId ? { ...artwork, status: 'sold' as const } : artwork
		)
	);
}

/*
 * Permanently remove a work from the catalogue and any pending matches.
 */
export async function deleteArtwork(artworkId: string): Promise<void> {
	const existing = assertOwnsArtwork(artworkId);

	if (supabase && isSupabaseConfigured) {
		const { error: matchError } = await supabase.from('matches').delete().eq('artwork_id', artworkId);
		if (matchError) {
			throw new Error(matchError.message);
		}

		const { error } = await supabase
			.from('artworks')
			.delete()
			.eq('id', artworkId)
			.eq('artist_id', existing.artist_id);

		if (error) {
			throw new Error(error.message);
		}
	}

	revokeBlobImageUrl(existing.image_url);
	artworks.update((list) => removeById(list, artworkId));
	matches.update((list) => list.filter((match) => match.artwork_id !== artworkId));
	socialInteractions.update((list) => list.filter((row) => row.artwork_id !== artworkId));
}

/*
 * Apply a match row returned by the API into the local store without a second write.
 */
export function upsertLocalMatch(row: NetworkMatch): void {
	matches.update((list) => upsertById(list, row));
}

/*
 * Record a venue right-swipe as interest.
 * DB enum uses `pending` for the interested state (no separate interested value).
 * Artwork stays `available` until a true accepted match is confirmed.
 */
export async function recordVenueMatch(venueId: string, artworkId: string): Promise<NetworkMatch> {
	if (supabase && isSupabaseConfigured) {
		const { data: matchRow, error: matchError } = await supabase
			.from('matches')
			.upsert(
				{
					venue_id: venueId,
					artwork_id: artworkId,
					status: 'pending'
				},
				{ onConflict: 'venue_id,artwork_id' }
			)
			.select('*')
			.single();

		if (matchError || !matchRow) {
			throw new Error(matchError?.message ?? 'Failed to record venue interest');
		}

		const mapped = mapMatchRow(matchRow as MatchRow);
		matches.update((list) => upsertById(list, mapped));
		return mapped;
	}

	const match: NetworkMatch = {
		id: generateId(),
		venue_id: venueId,
		artwork_id: artworkId,
		status: 'pending',
		created_at: new Date().toISOString()
	};

	matches.update((list) => [match, ...list]);
	return match;
}

/*
 * Persist a declined swipe so the work drops out of this venue's deck.
 */
export async function recordVenueDecline(venueId: string, artworkId: string): Promise<void> {
	if (supabase && isSupabaseConfigured) {
		const { data: matchRow, error: matchError } = await supabase
			.from('matches')
			.upsert(
				{
					venue_id: venueId,
					artwork_id: artworkId,
					status: 'declined'
				},
				{ onConflict: 'venue_id,artwork_id' }
			)
			.select('*')
			.single();

		if (matchError) {
			throw new Error(matchError.message);
		}

		if (matchRow) {
			matches.update((list) => upsertById(list, mapMatchRow(matchRow as MatchRow)));
		}
		return;
	}

	matches.update((list) =>
		upsertById(list, {
			id: generateId(),
			venue_id: venueId,
			artwork_id: artworkId,
			status: 'declined',
			created_at: new Date().toISOString()
		})
	);
}

type ProfilePromoInput = {
	full_name?: string;
	bio?: string;
	website?: string;
	instagram?: string;
};

/*
 * Persist promotional profile fields for the active identity (artist or venue).
 * Guests do not own a space - they share encounters instead.
 */
async function updateOwnProfile(
	role: 'artist' | 'venue',
	input: ProfilePromoInput
): Promise<void> {
	const user = get(currentUser);
	if (user.role !== role) {
		throw new Error(
			role === 'artist'
				? 'An artist identity is required to update your studio profile'
				: 'A venue identity is required to update venue details'
		);
	}

	const payload = {
		full_name: input.full_name?.trim() || null,
		bio: input.bio?.trim() || null,
		website: input.website?.trim() || null,
		instagram: input.instagram?.trim() || null
	};

	if (supabase && isSupabaseConfigured) {
		const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
		if (error) {
			throw new Error(error.message);
		}
	}

	profileCache.update((cache) => ({
		...cache,
		[user.id]: {
			username: cache[user.id]?.username ?? user.username,
			full_name: payload.full_name,
			user_type: role,
			bio: payload.bio,
			website: payload.website,
			instagram: payload.instagram
		}
	}));

	currentUser.update((current) => {
		if (current.id !== user.id || current.role !== role) return current;
		return {
			...current,
			full_name: payload.full_name ?? current.full_name,
			bio: payload.bio,
			website: payload.website,
			instagram: payload.instagram
		};
	});
}

export async function updateVenueProfile(input: ProfilePromoInput): Promise<void> {
	await updateOwnProfile('venue', input);
}

export async function updateArtistProfile(input: ProfilePromoInput): Promise<void> {
	await updateOwnProfile('artist', input);
}

export interface ArtistProfileCard {
	id: string;
	full_name: string;
	username: string;
	bio: string | null;
	website: string | null;
	instagram: string | null;
	location: string;
	medium?: string;
}

export function resolveArtistProfile(artistId: string): ArtistProfileCard {
	const cached = get(profileCache)[artistId];
	const active = get(currentUser);
	const simulated = getSimulatedUserById(artistId);
	const artist = simulated?.role === 'artist' ? simulated : null;
	const live = active.id === artistId && active.role === 'artist' ? active : null;

	return {
		id: artistId,
		full_name: live?.full_name ?? cached?.full_name ?? artist?.full_name ?? 'Artist',
		username: live?.username ?? cached?.username ?? artist?.username ?? 'artist',
		bio: live?.bio ?? cached?.bio ?? artist?.bio ?? null,
		website: live?.website ?? cached?.website ?? artist?.website ?? null,
		instagram: live?.instagram ?? cached?.instagram ?? artist?.instagram ?? null,
		location: artist?.location ?? 'Bristol',
		medium: artist?.medium
	};
}

export interface PromotionPiece {
	match: NetworkMatch | null;
	artwork: NetworkArtwork;
	card: SwipeCard;
	artist: ArtistProfileCard;
}

export interface ArtistVenuePack {
	venue_id: string;
	venue_name: string;
	venue_location: string;
	pieces: PromotionPiece[];
}

/*
 * Artist promotion packs - works grouped by venue interest / hanging.
 */
export const artistVenuePacks = derived(
	[matches, artworks, currentUser, profileCache],
	([$matches, $artworks, $user, $profiles]) => {
		if ($user.role !== 'artist') {
			return { packs: [] as ArtistVenuePack[], unplaced: [] as PromotionPiece[] };
		}

		const ownWorks = $artworks.filter((artwork) => artwork.artist_id === $user.id);
		const ownIds = new Set(ownWorks.map((work) => work.id));
		const artist = resolveArtistProfile($user.id);

		const packsMap = new Map<string, ArtistVenuePack>();
		const placedIds = new Set<string>();

		for (const match of $matches) {
			if (!ownIds.has(match.artwork_id)) continue;
			if (match.status !== 'pending' && match.status !== 'accepted') continue;

			const artwork = ownWorks.find((work) => work.id === match.artwork_id);
			if (!artwork) continue;

			placedIds.add(artwork.id);
			const venueSim = getSimulatedUserById(match.venue_id);
			const existing = packsMap.get(match.venue_id);

			const piece: PromotionPiece = {
				match,
				artwork,
				card: artworkToSwipeCard(artwork),
				artist
			};

			if (existing) {
				existing.pieces.push(piece);
				continue;
			}

			packsMap.set(match.venue_id, {
				venue_id: match.venue_id,
				venue_name: resolveProfileName(match.venue_id, $profiles),
				venue_location: venueSim?.role === 'venue' ? venueSim.location : 'Bristol',
				pieces: [piece]
			});
		}

		const unplaced: PromotionPiece[] = ownWorks
			.filter((artwork) => artwork.status === 'available' && !placedIds.has(artwork.id))
			.map((artwork) => ({
				match: null,
				artwork,
				card: artworkToSwipeCard(artwork),
				artist
			}));

		return {
			packs: [...packsMap.values()].sort((a, b) => a.venue_name.localeCompare(b.venue_name)),
			unplaced
		};
	}
);

/*
 * Venue promotion pack - hung / interested works with artist profiles for marketing.
 */
export const venuePromotionPack = derived(
	[venueActiveMatches, currentUser],
	([$active, $user]) => {
		if ($user.role !== 'venue') return [] as PromotionPiece[];

		return $active
			.filter((row) => row.artwork)
			.map((row) => ({
				match: row.match,
				artwork: row.artwork!,
				card: artworkToSwipeCard(row.artwork!),
				artist: resolveArtistProfile(row.artwork!.artist_id)
			}));
	}
);

/*
 * Accept a curated collection via the local API, then hydrate match rows locally.
 */
export async function acceptCuratedCollection(
	venueId: string,
	artworkIds: string[]
): Promise<NetworkMatch[]> {
	const response = await fetch('/api/curate', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ venue_id: venueId, artwork_ids: artworkIds })
	});

	if (!response.ok) {
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		throw new Error(payload?.message ?? 'Failed to accept curated collection');
	}

	const payload = (await response.json()) as { matches?: MatchRow[] };
	const rows = (payload.matches ?? []).map(mapMatchRow);

	for (const row of rows) {
		matches.update((list) => upsertById(list, row));
	}

	return rows;
}

export async function logSpottedInteraction(input: {
	username: string;
	artwork_id: string;
	content: string;
	user_id?: string;
}): Promise<void> {
	const activeUser = get(currentUser);
	const userId = input.user_id ?? activeUser.id;
	const username = input.username.trim() || activeUser.username;

	if (supabase && isSupabaseConfigured) {
		const { data, error } = await supabase
			.from('social_interactions')
			.insert({
				user_id: userId,
				artwork_id: input.artwork_id,
				interaction_type: 'spotted_at_venue',
				content: input.content.trim() || null
			})
			.select('*')
			.single();

		if (error || !data) {
			throw new Error(error?.message ?? 'Failed to log spotting');
		}

		profileCache.update((cache) => ({
			...cache,
			[userId]: {
				username,
				full_name: cache[userId]?.full_name ?? getSimulatedUserById(userId)?.full_name ?? null,
				user_type: cache[userId]?.user_type ?? get(currentUser).role
			}
		}));
		socialInteractions.update((list) =>
			upsertById(list, mapSocialRow(data as SocialRow, get(profileCache)))
		);
		return;
	}

	const interaction: NetworkSocialInteraction = {
		id: generateId(),
		user_id: userId,
		username,
		artwork_id: input.artwork_id,
		interaction_type: 'spotted_at_venue',
		content: input.content.trim() || null,
		created_at: new Date().toISOString()
	};

	socialInteractions.update((list) => [interaction, ...list]);
}
