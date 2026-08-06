import {
	DISTRICT_COORDINATES,
	SIMULATED_USERS,
	type SimulatedVenueProfile
} from '$lib/data/simulated-users';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import type { CityMapPin } from '$lib/types/map';

/*
 * Seed floorplan when Supabase env is absent - venues as rooms, no live matches.
 * Disabled in pilot/production unless mock fallbacks are explicitly enabled.
 */
export function buildOfflinePins(): CityMapPin[] {
	if (!mockFallbacksAllowed()) return [];

	return SIMULATED_USERS.filter((user): user is SimulatedVenueProfile => user.role === 'venue').map(
		(venue) => {
			const coords = DISTRICT_COORDINATES[venue.district];
			return {
				venue_id: venue.id,
				venue_name: venue.full_name,
				venue_username: venue.username,
				venue_bio: venue.bio ?? null,
				opening_hours: null,
				lat: coords.lat,
				lng: coords.lng,
				showing_count: 0,
				transit_count: 0,
				works: []
			};
		}
	);
}
