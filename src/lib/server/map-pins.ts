import { getArtistById } from '$lib/data/mock-artists';
import {
	DISTRICT_COORDINATES,
	getSimulatedUserById,
	SIMULATED_USERS,
	type SimulatedVenueProfile
} from '$lib/data/simulated-users';
import { parseGeographicLocation } from '$lib/server/geo-parse';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import { placementForHang } from '$lib/scheduling';
import type { CityMapPin, MapWorkPin, ProspectMapPin } from '$lib/types/map';
import type { Database } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

const BRISTOL_CENTER = { lat: 51.4545, lng: -2.5879 };

type VenueGeoRow = {
	id: string;
	slug: string;
	name: string;
	bio: string | null;
	opening_hours: string | null;
	geographic_location: string | null;
	is_active: boolean;
};

type MatchGeoRow = {
	venue_id: string;
	artwork_id: string;
	status: string;
	approved_at: string | null;
	hung_at: string | null;
	starts_on: string | null;
	ends_on: string | null;
};

function fallbackCoords(venueId: string): { lat: number; lng: number } | null {
	if (!mockFallbacksAllowed()) return null;
	const user = getSimulatedUserById(venueId);
	if (user?.role !== 'venue') return null;
	return DISTRICT_COORDINATES[user.district] ?? null;
}

function parseLocation(raw: string | null, venueId: string): { lat: number; lng: number } | null {
	return parseGeographicLocation(raw) ?? fallbackCoords(venueId);
}

/*
 * Prefer the venues entity (postcode-geocoded). Fall back to venue profiles,
 * then simulated seed venues.
 */
export async function buildCityMapPins(
	supabase: SupabaseClient<Database>
): Promise<CityMapPin[]> {
	const [{ data: venueRows, error: venueTableError }, matchQuery] = await Promise.all([
		supabase
			.from('venues')
			.select('id, slug, name, bio, opening_hours, geographic_location, is_active')
			.eq('is_active', true),
		supabase
			.from('matches')
			.select('venue_id, artwork_id, status, approved_at, hung_at, starts_on, ends_on')
			.in('status', ['pending', 'accepted'])
	]);

	let matchRows: MatchGeoRow[] = [];

	if (matchQuery.error?.code === '42703') {
		const legacy = await supabase
			.from('matches')
			.select('venue_id, artwork_id, status, approved_at, starts_on, ends_on')
			.in('status', ['pending', 'accepted']);
		if (legacy.error) throw new Error(legacy.error.message);
		matchRows = (legacy.data ?? []).map((row) => ({
			...row,
			hung_at: row.approved_at
		})) as MatchGeoRow[];
	} else if (matchQuery.error) {
		throw new Error(matchQuery.error.message);
	} else {
		matchRows = ((matchQuery.data ?? []) as MatchGeoRow[]).map((row) => ({
			...row,
			hung_at: row.hung_at ?? null
		}));
	}

	let venueList: VenueGeoRow[] = [];

	if (!venueTableError && venueRows && venueRows.length > 0) {
		venueList = (venueRows as VenueGeoRow[]).map((row) => ({
			...row,
			opening_hours: row.opening_hours ?? null
		}));
	} else if (venueTableError?.code === '42703') {
		const fallback = await supabase
			.from('venues')
			.select('id, slug, name, bio, geographic_location, is_active')
			.eq('is_active', true);
		if (!fallback.error && fallback.data) {
			venueList = fallback.data.map((row) => ({
				...(row as Omit<VenueGeoRow, 'opening_hours'>),
				opening_hours: null
			}));
		}
	} else {
		if (venueTableError && venueTableError.code !== '42P01' && venueTableError.code !== 'PGRST205') {
			console.warn('venues map query:', venueTableError.message);
		}

		const { data: profiles, error: profileError } = await supabase
			.from('profiles')
			.select('id, username, full_name, bio, geographic_location, is_active')
			.eq('user_type', 'venue')
			.eq('is_active', true);

		if (profileError) throw new Error(profileError.message);

		venueList =
			(profiles ?? []).map((row) => ({
				id: row.id,
				slug: row.username,
				name: row.full_name ?? row.username,
				bio: row.bio,
				opening_hours: null,
				geographic_location: row.geographic_location,
				is_active: true
			})) ?? [];
	}

	if (venueList.length === 0 && mockFallbacksAllowed()) {
		venueList = SIMULATED_USERS.filter((user) => user.role === 'venue').map((user) => ({
			id: user.id,
			slug: user.username,
			name: user.full_name,
			bio: (user as SimulatedVenueProfile).bio ?? null,
			opening_hours: null,
			geographic_location: null,
			is_active: true
		}));
	}

	const artworkIds = [...new Set(matchRows.map((row) => row.artwork_id))];
	let artworks: {
		id: string;
		title: string;
		image_url: string;
		status: string;
		artist_id: string;
	}[] = [];

	if (artworkIds.length > 0) {
		const { data, error } = await supabase
			.from('artworks')
			.select('id, title, image_url, status, artist_id')
			.in('id', artworkIds)
			.neq('status', 'sold');

		if (error) throw new Error(error.message);
		artworks = data ?? [];
	}

	const artworkById = new Map(artworks.map((row) => [row.id, row]));

	const missingGeoIds = venueList
		.filter((venue) => !parseLocation(venue.geographic_location, venue.id))
		.map((venue) => venue.id);

	const profileGeoById = new Map<string, string | null>();
	if (missingGeoIds.length > 0) {
		const { data: profilesWithGeo } = await supabase
			.from('profiles')
			.select('id, geographic_location')
			.in('id', missingGeoIds);
		for (const row of profilesWithGeo ?? []) {
			profileGeoById.set(row.id, row.geographic_location);
		}
	}

	const pins: CityMapPin[] = [];

	for (const venue of venueList) {
		let coords = parseLocation(venue.geographic_location, venue.id);
		if (!coords) {
			coords = parseLocation(profileGeoById.get(venue.id) ?? null, venue.id);
		}
		if (!coords) continue;

		const venueMatches = matchRows.filter((row) => row.venue_id === venue.id);
		const works: MapWorkPin[] = [];

		for (const match of venueMatches) {
			const artwork = artworkById.get(match.artwork_id);
			if (!artwork) continue;

			const artist = getArtistById(artwork.artist_id);
			works.push({
				id: artwork.id,
				title: artwork.title,
				image_url: artwork.image_url,
				artist_name: artist?.full_name ?? 'Artist',
				placement: placementForHang(match)
			});
		}

		works.sort((a, b) => {
			if (a.placement !== b.placement) return a.placement === 'showing' ? -1 : 1;
			return a.title.localeCompare(b.title);
		});

		pins.push({
			venue_id: venue.id,
			venue_name: venue.name,
			venue_username: venue.slug,
			venue_bio: venue.bio,
			opening_hours: venue.opening_hours?.trim() || null,
			lat: coords.lat,
			lng: coords.lng,
			showing_count: works.filter((work) => work.placement === 'showing').length,
			transit_count: works.filter((work) => work.placement === 'transit').length,
			works
		});
	}

	return pins.sort((a, b) => a.venue_name.localeCompare(b.venue_name));
}

/** Unclaimed / claim_pending prospects only - never partners. */
export async function buildProspectMapPins(
	supabase: SupabaseClient<Database>
): Promise<ProspectMapPin[]> {
	const { data, error } = await supabase
		.from('venue_prospects')
		.select('id, name, category, latitude, longitude, lifecycle_status')
		.in('lifecycle_status', ['unclaimed', 'claim_pending']);

	if (error) {
		if (error.code === '42P01' || error.code === 'PGRST205') return [];
		console.warn('prospect map query:', error.message);
		return [];
	}

	return (data ?? [])
		.filter(
			(row) =>
				Number.isFinite(row.latitude) &&
				Number.isFinite(row.longitude) &&
				(row.lifecycle_status === 'unclaimed' || row.lifecycle_status === 'claim_pending')
		)
		.map((row) => ({
			prospect_id: row.id,
			name: row.name,
			category: row.category,
			lat: row.latitude,
			lng: row.longitude,
			lifecycle_status: row.lifecycle_status as 'unclaimed' | 'claim_pending',
			label: 'Potential Art Hawks space' as const
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function cityMapPayload(pins: CityMapPin[], prospectPins: ProspectMapPin[] = []) {
	const allLatLng = [
		...pins.map((p) => ({ lat: p.lat, lng: p.lng })),
		...prospectPins.map((p) => ({ lat: p.lat, lng: p.lng }))
	];
	const center =
		allLatLng.length > 0
			? {
					lat: allLatLng.reduce((sum, pin) => sum + pin.lat, 0) / allLatLng.length,
					lng: allLatLng.reduce((sum, pin) => sum + pin.lng, 0) / allLatLng.length
				}
			: BRISTOL_CENTER;

	return {
		city: 'Nearby',
		center,
		pins,
		prospect_pins: prospectPins
	};
}

export { BRISTOL_CENTER };
