import { getArtistById, mockArtworkListings } from '$lib/data/mock-artists';
import {
	DISTRICT_COORDINATES,
	getSimulatedUserById,
	type SimulatedVenueProfile
} from '$lib/data/simulated-users';
import { formatArtStyle, isArtStyle, type ArtStyle } from '$lib/constants/art-styles';
import { isSeedVenueId } from '$lib/constants/seed-ids';
import { parseGeographicLocation } from '$lib/server/geo-parse';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import { roomPlacementForHang } from '$lib/scheduling';
import type { Database } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface RoomWork {
	id: string;
	title: string;
	image_url: string;
	artist_name: string;
	artist_id: string | null;
	artist_username: string | null;
	style: string | null;
	placement: 'showing' | 'transit' | 'past';
	status: 'available' | 'matched' | 'sold' | string;
	description: string | null;
}

export interface RoomPage {
	venue_id: string;
	venue_name: string;
	venue_username: string;
	bio: string | null;
	image_url: string | null;
	website: string | null;
	instagram: string | null;
	location: string;
	opening_hours: string | null;
	lat: number | null;
	lng: number | null;
	works: RoomWork[];
}

function roomFromVenue(
	venueId: string,
	simulatedVenue: SimulatedVenueProfile | null,
	overrides: {
		venue_name?: string | null;
		venue_username?: string | null;
		bio?: string | null;
		image_url?: string | null;
		website?: string | null;
		instagram?: string | null;
		location?: string | null;
		opening_hours?: string | null;
		lat?: number | null;
		lng?: number | null;
	},
	works: RoomWork[] = []
): RoomPage {
	const coords = coordsForVenue(venueId);

	return {
		venue_id: venueId,
		venue_name:
			overrides.venue_name ?? simulatedVenue?.full_name ?? overrides.venue_username ?? 'Venue',
		venue_username: overrides.venue_username ?? simulatedVenue?.username ?? 'venue',
		bio: overrides.bio ?? simulatedVenue?.bio ?? null,
		image_url: overrides.image_url ?? simulatedVenue?.image_url ?? null,
		website: overrides.website ?? simulatedVenue?.website ?? null,
		instagram: overrides.instagram ?? simulatedVenue?.instagram ?? null,
		location: overrides.location ?? simulatedVenue?.location ?? 'Bristol',
		opening_hours: overrides.opening_hours?.trim() || null,
		lat: overrides.lat ?? coords?.lat ?? null,
		lng: overrides.lng ?? coords?.lng ?? null,
		works
	};
}

function coordsForVenue(venueId: string): { lat: number; lng: number } | null {
	if (!mockFallbacksAllowed()) return null;
	const user = getSimulatedUserById(venueId);
	if (user?.role !== 'venue') return null;
	return DISTRICT_COORDINATES[user.district] ?? null;
}

function resolveStyleLabel(artworkId: string, raw: string | null | undefined): string | null {
	if (raw && isArtStyle(raw)) return formatArtStyle(raw);
	if (mockFallbacksAllowed()) {
		const seed = mockArtworkListings.find((item) => item.id === artworkId)?.style ?? null;
		return seed ? formatArtStyle(seed) : null;
	}
	return null;
}

export async function loadRoomPage(
	supabase: SupabaseClient<Database> | null,
	venueId: string
): Promise<RoomPage | null> {
	if (!mockFallbacksAllowed() && isSeedVenueId(venueId)) {
		return null;
	}

	const simulated = mockFallbacksAllowed() ? getSimulatedUserById(venueId) : null;
	const simulatedVenue = simulated?.role === 'venue' ? (simulated as SimulatedVenueProfile) : null;

	if (!supabase) {
		if (!simulatedVenue) return null;
		return roomFromVenue(venueId, simulatedVenue, {});
	}

	let venueEntity: {
		id: string;
		name: string;
		slug: string;
		bio: string | null;
		website: string | null;
		instagram: string | null;
		image_url: string | null;
		district: string | null;
		city_id: string | null;
		geographic_location: string | null;
		opening_hours: string | null;
		is_active?: boolean | null;
	} | null = null;

	{
		const withHours = await supabase
			.from('venues')
			.select(
				'id, name, slug, bio, website, instagram, image_url, district, city_id, geographic_location, opening_hours, is_active'
			)
			.eq('id', venueId)
			.maybeSingle();

		if (withHours.error?.code === '42703') {
			const withoutHours = await supabase
				.from('venues')
				.select(
					'id, name, slug, bio, website, instagram, image_url, district, city_id, geographic_location, is_active'
				)
				.eq('id', venueId)
				.maybeSingle();
			if (withoutHours.data) {
				venueEntity = { ...withoutHours.data, opening_hours: null };
			}
		} else if (!withHours.error) {
			venueEntity = withHours.data as typeof venueEntity;
		}
	}

	let overrides: {
		venue_name?: string | null;
		venue_username?: string | null;
		bio?: string | null;
		image_url?: string | null;
		website?: string | null;
		instagram?: string | null;
		location?: string | null;
		opening_hours?: string | null;
		lat?: number | null;
		lng?: number | null;
	} = {};

	if (venueEntity) {
		if (!mockFallbacksAllowed() && isSeedVenueId(venueEntity.id)) {
			return null;
		}
		if (venueEntity.is_active === false) {
			return null;
		}
		const geo = parseGeographicLocation(venueEntity.geographic_location);
		overrides = {
			venue_name: venueEntity.name,
			venue_username: venueEntity.slug,
			bio: venueEntity.bio,
			image_url: venueEntity.image_url,
			website: venueEntity.website,
			instagram: venueEntity.instagram,
			location: venueEntity.district
				? `${venueEntity.district.replace(/_/g, ' ')}, Bristol`
				: 'Nearby',
			opening_hours: venueEntity.opening_hours ?? null,
			lat: geo?.lat ?? null,
			lng: geo?.lng ?? null
		};
	} else {
		const { data: venue, error: venueError } = await supabase
			.from('profiles')
			.select('id, username, full_name, bio, website, instagram, user_type, image_url')
			.eq('id', venueId)
			.maybeSingle();

		if (venueError) throw new Error(venueError.message);
		if (!venue || venue.user_type !== 'venue') {
			if (!simulatedVenue) return null;
			return roomFromVenue(venueId, simulatedVenue, {});
		} else {
			overrides = {
				venue_name: venue.full_name ?? venue.username,
				venue_username: venue.username,
				bio: venue.bio,
				image_url: venue.image_url,
				website: venue.website,
				instagram: venue.instagram
			};
		}
	}

	const { data: matches, error: matchError } = await supabase
		.from('matches')
		.select('artwork_id, status, approved_at, hung_at, starts_on, ends_on')
		.eq('venue_id', venueId)
		.in('status', ['pending', 'accepted']);

	if (matchError?.code === '42703') {
		const legacy = await supabase
			.from('matches')
			.select('artwork_id, status, approved_at, starts_on, ends_on')
			.eq('venue_id', venueId)
			.in('status', ['pending', 'accepted']);
		if (legacy.error) throw new Error(legacy.error.message);
		const matches = (legacy.data ?? []).map((row) => ({
			...row,
			hung_at: row.approved_at
		}));
		return finishRoomPage(supabase, venueId, simulatedVenue, overrides, matches);
	}

	if (matchError) throw new Error(matchError.message);

	return finishRoomPage(supabase, venueId, simulatedVenue, overrides, matches ?? []);
}

async function finishRoomPage(
	supabase: SupabaseClient<Database>,
	venueId: string,
	simulatedVenue: SimulatedVenueProfile | null,
	overrides: {
		venue_name?: string | null;
		venue_username?: string | null;
		bio?: string | null;
		image_url?: string | null;
		website?: string | null;
		instagram?: string | null;
		location?: string | null;
		opening_hours?: string | null;
		lat?: number | null;
		lng?: number | null;
	},
	matches: {
		artwork_id: string;
		status: string;
		approved_at: string | null;
		hung_at?: string | null;
		starts_on: string | null;
		ends_on: string | null;
	}[]
): Promise<RoomPage> {
	const artworkIds = matches.map((row) => row.artwork_id);
	let works: RoomWork[] = [];

	if (artworkIds.length > 0) {
		let artworks:
			| {
					id: string;
					title: string;
					image_url: string;
					description: string | null;
					style?: string | null;
					status: string;
					artist_id: string;
			  }[]
			| null = null;

		const withStyle = await supabase
			.from('artworks')
			.select('id, title, image_url, description, style, status, artist_id')
			.in('id', artworkIds);

		if (withStyle.error?.code === '42703') {
			const withoutStyle = await supabase
				.from('artworks')
				.select('id, title, image_url, description, status, artist_id')
				.in('id', artworkIds);
			if (withoutStyle.error) throw new Error(withoutStyle.error.message);
			artworks = withoutStyle.data;
		} else if (withStyle.error) {
			throw new Error(withStyle.error.message);
		} else {
			artworks = withStyle.data;
		}

		const matchByArtwork = new Map(matches.map((row) => [row.artwork_id, row]));
		const artistIds = [...new Set((artworks ?? []).map((row) => row.artist_id))];
		const artistById = new Map<string, { username: string; full_name: string | null }>();

		if (artistIds.length > 0) {
			const { data: artists } = await supabase
				.from('profiles')
				.select('id, username, full_name')
				.in('id', artistIds);
			for (const row of artists ?? []) {
				artistById.set(row.id, { username: row.username, full_name: row.full_name });
			}
		}

		works = (artworks ?? []).map((artwork) => {
			const match = matchByArtwork.get(artwork.id);
			const live = artistById.get(artwork.artist_id);
			const mock = mockFallbacksAllowed() ? getArtistById(artwork.artist_id) : null;

			return {
				id: artwork.id,
				title: artwork.title,
				image_url: artwork.image_url,
				artist_name: live?.full_name ?? mock?.full_name ?? 'Artist',
				artist_id: artwork.artist_id,
				artist_username: live?.username ?? mock?.username ?? null,
				style: resolveStyleLabel(artwork.id, artwork.style),
				placement: match
					? roomPlacementForHang(match, artwork.status)
					: artwork.status === 'sold'
						? ('past' as const)
						: ('transit' as const),
				status: artwork.status,
				description: artwork.description
			};
		});

		works.sort((a, b) => {
			const rank = (placement: RoomWork['placement']) =>
				placement === 'showing' ? 0 : placement === 'transit' ? 1 : 2;
			const byPlace = rank(a.placement) - rank(b.placement);
			if (byPlace !== 0) return byPlace;
			return a.title.localeCompare(b.title);
		});
	}

	return roomFromVenue(venueId, simulatedVenue, overrides, works);
}
