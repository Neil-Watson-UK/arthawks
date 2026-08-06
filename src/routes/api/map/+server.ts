import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildCityMapPins, buildProspectMapPins, cityMapPayload } from '$lib/server/map-pins';
import { buildOfflinePins } from '$lib/server/map-offline';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { CityMapPin, MapWorkPin } from '$lib/types/map';

/*
 * GET /api/map
 * Venue rooms with coordinates - not limited to Bristol.
 * Prefer table assembly (venues); fall back to RPC; offline seeds only when mocks allowed.
 */
export const GET: RequestHandler = async () => {
	if (!hasPublicSupabaseEnv()) {
		return json(cityMapPayload(buildOfflinePins()));
	}

	try {
		let supabase;
		try {
			supabase = createServiceClient();
		} catch {
			return json(cityMapPayload(buildOfflinePins()));
		}

		/* Primary: venues table with postcode-derived geography */
		try {
			const [pins, prospectPins] = await Promise.all([
				buildCityMapPins(supabase),
				buildProspectMapPins(supabase)
			]);
			if (pins.length > 0 || prospectPins.length > 0) {
				return json(cityMapPayload(pins, prospectPins));
			}
		} catch (err) {
			console.warn('buildCityMapPins failed, trying RPC:', err);
		}

		const prospectPins = await buildProspectMapPins(supabase).catch(() => []);

		const { data, error: rpcError } = await supabase.rpc('get_city_map_pins');

		if (!rpcError && data) {
			const pins: CityMapPin[] = (data as Array<Record<string, unknown>>).map((row) => {
				const works = (Array.isArray(row.works) ? row.works : []) as MapWorkPin[];
				return {
					venue_id: String(row.venue_id),
					venue_name: String(row.venue_name ?? 'Venue'),
					venue_username: String(row.venue_username ?? ''),
					venue_bio: (row.venue_bio as string | null) ?? null,
					opening_hours: ((row.opening_hours as string | null) ?? null)?.trim() || null,
					lat: Number(row.lat),
					lng: Number(row.lng),
					showing_count: Number(row.showing_count ?? 0),
					transit_count: Number(row.transit_count ?? 0),
					works
				};
			});

			return json(
				cityMapPayload(
					pins.filter((pin) => Number.isFinite(pin.lat) && Number.isFinite(pin.lng)),
					prospectPins
				)
			);
		}

		if (rpcError) {
			console.warn('get_city_map_pins RPC unavailable:', rpcError.message);
		}

		if (mockFallbacksAllowed()) {
			return json(cityMapPayload(buildOfflinePins(), prospectPins));
		}
		return json(cityMapPayload([], prospectPins));
	} catch (err) {
		console.error('City map failed:', err);
		throw error(500, { message: 'Failed to load the map' });
	}
};
