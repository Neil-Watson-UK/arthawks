import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertControlsVenue, requireApiProfile } from '$lib/server/api-auth';
import { createServiceClient } from '$lib/server/supabase';
import {
	DISTRICT_COORDINATES,
	getSimulatedUserById,
	type SimulatedVenueProfile
} from '$lib/data/simulated-users';
import { getArtistById, mockArtworkListings } from '$lib/data/mock-artists';
import { isArtStyle, type ArtStyle } from '$lib/constants/art-styles';
import { resolveSubstrateTier } from '$lib/constants/auto-amor';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import type { MatchStatus } from '$lib/types/database';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
	return UUID_RE.test(value);
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

function distanceForArtwork(
	venue: SimulatedVenueProfile | undefined,
	artistId: string
): number {
	const artist = getArtistById(artistId);
	if (!venue || !artist) return 1500;

	const venueCoords = DISTRICT_COORDINATES[venue.district];
	const artistCoords = DISTRICT_COORDINATES[artist.district as keyof typeof DISTRICT_COORDINATES];
	if (!venueCoords || !artistCoords) return 1500;

	return haversineMeters(venueCoords.lat, venueCoords.lng, artistCoords.lat, artistCoords.lng);
}

/** Map venue aesthetic_tags to ArtStyle - prefer direct chips, keep legacy aliases. */
function stylesFromTags(tags: string[]): ArtStyle[] {
	const styles = new Set<ArtStyle>();
	for (const tag of tags) {
		if (isArtStyle(tag)) {
			styles.add(tag);
			continue;
		}
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

function longestSideCm(height: number | null, width: number | null): number | null {
	if (height == null && width == null) return null;
	return Math.max(Number(height) || 0, Number(width) || 0);
}

function parseStylesParam(raw: string | null): ArtStyle[] {
	if (!raw?.trim()) return [];
	return [
		...new Set(
			raw
				.split(',')
				.map((value) => value.trim())
				.filter(isArtStyle)
		)
	];
}

function resolveStyle(artworkId: string, raw: string | null | undefined): ArtStyle | null {
	if (raw && isArtStyle(raw)) return raw;
	if (!mockFallbacksAllowed()) return null;
	const seed = mockArtworkListings.find((item) => item.id === artworkId);
	return seed?.style ?? null;
}

/*
 * GET /api/curate?venue_id=…&limit=1-5&max_cm=&styles=landscape,abstract
 * Brief constraints first, then rank by plug-and-play + distance + style fit.
 */
export const GET: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');
	const venueId = event.url.searchParams.get('venue_id');
	const rawLimit = Number.parseInt(event.url.searchParams.get('limit') ?? '5', 10);
	const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 5) : 5;
	const rawMaxCm = Number.parseInt(event.url.searchParams.get('max_cm') ?? '', 10);
	const maxCm = Number.isFinite(rawMaxCm) && rawMaxCm > 0 ? rawMaxCm : null;
	const briefStyles = parseStylesParam(event.url.searchParams.get('styles'));
	const taste = (event.cookies.get('arthawks_taste') ?? '')
		.split(',')
		.map((value) => value.trim())
		.filter(isArtStyle);

	if (!venueId || !isUuid(venueId)) {
		throw error(400, { message: 'venue_id must be a valid UUID' });
	}

	await assertControlsVenue(profile, venueId);

	const supabase = createServiceClient();

	const { data: venueRow } = await supabase
		.from('venues')
		.select('id, name, slug, aesthetic_tags, district')
		.eq('id', venueId)
		.maybeSingle();

	let venueName: string | null = venueRow?.name ?? null;

	if (!venueRow) {
		const { data: venue, error: venueError } = await supabase
			.from('profiles')
			.select('id, user_type, full_name, username')
			.eq('id', venueId)
			.maybeSingle();

		if (venueError) {
			throw error(500, { message: 'Failed to load venue profile' });
		}

		if (!venue || venue.user_type !== 'venue') {
			throw error(404, { message: 'Venue not found' });
		}
		venueName = venue.full_name ?? venue.username;
	}

	const simulatedVenue = getSimulatedUserById(venueId);
	const venueProfile =
		simulatedVenue?.role === 'venue'
			? (simulatedVenue as SimulatedVenueProfile)
			: venueRow
				? ({
						role: 'venue',
						id: venueRow.id,
						username: venueRow.slug,
						full_name: venueRow.name,
						location: 'Bristol',
						district: (venueRow.district as SimulatedVenueProfile['district']) || 'stokes_croft',
						footfall: 'medium',
						aesthetic_tags: venueRow.aesthetic_tags ?? [],
						preferred_media: []
					} satisfies SimulatedVenueProfile)
				: undefined;

	/*
	 * Exclude works this venue has already swiped on (any match row),
	 * then rank remaining available catalogue by distance + style fit.
	 */
	const matchesQuery = supabase.from('matches').select('artwork_id').eq('venue_id', venueId);
	type CurateArtworkRow = {
		id: string;
		artist_id: string;
		title: string;
		medium: string | null;
		description: string | null;
		style?: string | null;
		price_pence: number;
		height_cm: number | null;
		width_cm: number | null;
		substrate_tier?: string | null;
		is_plug_and_play?: boolean | null;
		image_url: string;
		status: string;
		created_at: string;
	};

	let artworks: CurateArtworkRow[] | null = null;
	let artworksError: { message: string; code?: string } | null = null;

	/* Prefer substrate + style columns; degrade gracefully if migrations lag */
	const withSubstrate = await supabase
		.from('artworks')
		.select(
			'id, artist_id, title, medium, description, style, price_pence, height_cm, width_cm, substrate_tier, is_plug_and_play, image_url, status, created_at'
		)
		.eq('status', 'available');

	if (withSubstrate.error?.code === '42703') {
		const withStyle = await supabase
			.from('artworks')
			.select(
				'id, artist_id, title, medium, description, style, price_pence, height_cm, width_cm, image_url, status, created_at'
			)
			.eq('status', 'available');

		if (withStyle.error?.code === '42703') {
			const bare = await supabase
				.from('artworks')
				.select(
					'id, artist_id, title, medium, description, price_pence, height_cm, width_cm, image_url, status, created_at'
				)
				.eq('status', 'available');
			artworks = (bare.data as CurateArtworkRow[] | null) ?? null;
			artworksError = bare.error;
		} else {
			artworks = (withStyle.data as CurateArtworkRow[] | null) ?? null;
			artworksError = withStyle.error;
		}
	} else {
		artworks = (withSubstrate.data as CurateArtworkRow[] | null) ?? null;
		artworksError = withSubstrate.error;
	}

	const { data: existingMatches, error: matchesError } = await matchesQuery;

	if (artworksError || matchesError) {
		console.error('Curate fetch failed:', artworksError ?? matchesError);
		throw error(500, { message: 'Failed to assemble curated collection' });
	}

	const excluded = new Set((existingMatches ?? []).map((row) => row.artwork_id));
	const venueStyles = venueProfile ? stylesFromTags(venueProfile.aesthetic_tags) : [];
	const preferredStyles = briefStyles.length > 0 ? briefStyles : venueStyles;

	const artistIds = [
		...new Set((artworks ?? []).filter((a) => !excluded.has(a.id)).map((a) => a.artist_id))
	];
	const artistNameById = new Map<string, { username: string; full_name: string | null }>();
	if (artistIds.length > 0) {
		const { data: artists } = await supabase
			.from('profiles')
			.select('id, username, full_name')
			.in('id', artistIds);
		for (const row of artists ?? []) {
			artistNameById.set(row.id, { username: row.username, full_name: row.full_name });
		}
	}

	const ranked = (artworks ?? [])
		.filter((artwork) => !excluded.has(artwork.id))
		.filter((artwork) => {
			if (maxCm == null) return true;
			const side = longestSideCm(artwork.height_cm, artwork.width_cm);
			/* Unknown dimensions stay eligible so sparse catalogue is not emptied */
			if (side == null || side <= 0) return true;
			return side <= maxCm;
		})
		.filter((artwork) => {
			if (briefStyles.length === 0) return true;
			const style = resolveStyle(artwork.id, artwork.style);
			/* When the venue named types, only return works that match */
			return style != null && briefStyles.includes(style);
		})
		.map((artwork) => {
			const fromDb = artistNameById.get(artwork.artist_id);
			const artist = mockFallbacksAllowed() ? getArtistById(artwork.artist_id) : null;
			const distance_meters = distanceForArtwork(venueProfile, artwork.artist_id);
			const style = resolveStyle(artwork.id, artwork.style);
			const substrate = resolveSubstrateTier(
				artwork.substrate_tier,
				artwork.height_cm,
				artwork.width_cm
			);
			/* Plug-and-play Auto Amor boards lead the recommendation queue */
			let score = 1000 - distance_meters / 50;

			if (substrate.is_plug_and_play) score += 120;
			if (style && preferredStyles.includes(style)) score += 40;
			if (style && taste.includes(style)) score += 50;

			return {
				id: artwork.id,
				artist_id: artwork.artist_id,
				title: artwork.title,
				medium: artwork.medium,
				description: artwork.description,
				style,
				price: artwork.price_pence,
				height_cm: artwork.height_cm,
				width_cm: artwork.width_cm,
				image_url: artwork.image_url,
				status: artwork.status,
				created_at: artwork.created_at,
				distance_meters,
				artist_username: fromDb?.username ?? artist?.username ?? 'artist',
				artist_full_name: fromDb?.full_name ?? artist?.full_name ?? null,
				substrate_tier: substrate.substrate_tier,
				is_plug_and_play: substrate.is_plug_and_play,
				score
			};
		})
		.sort((a, b) => {
			if (a.is_plug_and_play !== b.is_plug_and_play) {
				return a.is_plug_and_play ? -1 : 1;
			}
			return b.score - a.score;
		})
		.slice(0, limit);

	const emptyHint =
		ranked.length === 0
			? 'Nothing matched that brief. Loosen size, add another type, or try self-curation.'
			: null;

	return json({
		venue_id: venueId,
		venue_name: venueName ?? 'Venue',
		count: ranked.length,
		cards: ranked,
		brief: {
			limit,
			max_cm: maxCm,
			styles: preferredStyles
		},
		empty_hint: emptyHint
	});
};

type AcceptBody = {
	venue_id?: string;
	artwork_ids?: string[];
};

/*
 * POST /api/curate
 * Accept a curated collection - insert pending ("interested") match rows.
 */
export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, 'venue');

	let body: AcceptBody;

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	const venueId = body.venue_id;
	const artworkIds = body.artwork_ids ?? [];

	if (!venueId || !isUuid(venueId)) {
		throw error(400, { message: 'venue_id must be a valid UUID' });
	}

	if (!Array.isArray(artworkIds) || artworkIds.length === 0 || artworkIds.length > 5) {
		throw error(400, { message: 'artwork_ids must contain 1-5 UUIDs' });
	}

	if (!artworkIds.every((id) => typeof id === 'string' && isUuid(id))) {
		throw error(400, { message: 'Each artwork_id must be a valid UUID' });
	}

	await assertControlsVenue(profile, venueId);

	const supabase = createServiceClient();

	const { data: venueEntity } = await supabase
		.from('venues')
		.select('id')
		.eq('id', venueId)
		.maybeSingle();

	if (!venueEntity) {
		const { data: venue, error: venueError } = await supabase
			.from('profiles')
			.select('id, user_type')
			.eq('id', venueId)
			.maybeSingle();

		if (venueError || !venue || venue.user_type !== 'venue') {
			throw error(404, { message: 'Venue not found' });
		}
	}

	const pendingStatus: MatchStatus = 'pending';

	const rows = artworkIds.map((artwork_id) => ({
		venue_id: venueId,
		artwork_id,
		status: pendingStatus
	}));

	const { data: matches, error: upsertError } = await supabase
		.from('matches')
		.upsert(rows, { onConflict: 'venue_id,artwork_id' })
		.select('id, venue_id, artwork_id, status, created_at');

	if (upsertError) {
		console.error('Accept collection failed:', upsertError);
		throw error(500, { message: 'Failed to accept curated collection' });
	}

	return json({
		venue_id: venueId,
		accepted: matches?.length ?? 0,
		matches: matches ?? []
	});
};
