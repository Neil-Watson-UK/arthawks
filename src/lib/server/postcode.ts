/**
 * UK postcode helpers - normalize, validate shape, geocode via postcodes.io.
 */

export type GeoPoint = { lat: number; lng: number };

/** Outward + inward with a single space, e.g. BS1 4ST */
export function normalizePostcode(raw: string): string {
	const compact = raw.replace(/\s+/g, '').toUpperCase();
	if (compact.length < 5) return compact;
	return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/**
 * Loose UK postcode pattern (covers most formats including BS1 4ST, EC1A 1BB).
 * Full official regex is huge; we rely on postcodes.io for authoritative check.
 */
export function looksLikeUkPostcode(raw: string): boolean {
	const compact = raw.replace(/\s+/g, '').toUpperCase();
	return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
}

export async function geocodeUkPostcode(postcode: string): Promise<{
	postcode: string;
	lat: number;
	lng: number;
	admin_district: string | null;
	region: string | null;
} | null> {
	const normalized = normalizePostcode(postcode);
	const encoded = encodeURIComponent(normalized);

	try {
		const response = await fetch(`https://api.postcodes.io/postcodes/${encoded}`, {
			headers: { Accept: 'application/json' }
		});

		if (response.status === 404) return null;
		if (!response.ok) return null;

		const payload = (await response.json()) as {
			status: number;
			result?: {
				postcode?: string;
				latitude?: number;
				longitude?: number;
				admin_district?: string | null;
				region?: string | null;
			};
		};

		const result = payload.result;
		if (
			!result ||
			typeof result.latitude !== 'number' ||
			typeof result.longitude !== 'number'
		) {
			return null;
		}

		return {
			postcode: result.postcode ?? normalized,
			lat: result.latitude,
			lng: result.longitude,
			admin_district: result.admin_district ?? null,
			region: result.region ?? null
		};
	} catch {
		return null;
	}
}

export function pointWkt(lat: number, lng: number): string {
	/* EWKT so PostgREST can cast into geography(point, 4326) */
	return `SRID=4326;POINT(${lng} ${lat})`;
}
