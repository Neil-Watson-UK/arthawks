/**
 * Bristol Overpass / OpenStreetMap venue candidate import.
 * Server-side only - never call from the browser.
 *
 * Strategy: small per-category queries + delays (avoids 429 on huge bbox queries).
 * Successful payloads are cached under .data/ for retry without hitting Overpass again.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const OSM_SOURCE = 'openstreetmap';

/** Approximate Bristol unitary authority bounding box (S,W,N,E) */
export const BRISTOL_BBOX = {
	south: 51.384,
	west: -2.722,
	north: 51.544,
	east: -2.45
} as const;

/** Prefer quieter mirrors first; kumi often 429s under load */
const OVERPASS_ENDPOINTS = [
	'https://lz4.overpass-api.de/api/interpreter',
	'https://overpass-api.de/api/interpreter',
	'https://overpass.private.coffee/api/interpreter'
] as const;

const USER_AGENT = 'ArtHawksVenueImport/1.0 (bristol-venue-prospects; localhost-dev)';

const CACHE_DIR = path.join(process.cwd(), '.data');
const CACHE_FILE = path.join(CACHE_DIR, 'overpass-bristol-cache.json');

export type OverpassElement = {
	type: 'node' | 'way' | 'relation';
	id: number;
	lat?: number;
	lon?: number;
	center?: { lat: number; lon: number };
	tags?: Record<string, string>;
};

export type NormalizedProspectCandidate = {
	name: string;
	category: string | null;
	address: string | null;
	locality: string | null;
	postcode: string | null;
	latitude: number;
	longitude: number;
	website: string | null;
	phone: string | null;
	source: string;
	source_record_id: string;
	source_url: string;
};

export type ImportReportRow = {
	source_record_id: string;
	name: string;
	action: 'insert' | 'update' | 'skip' | 'invalid' | 'protected';
	reason?: string;
};

export type ImportReport = {
	dry_run: boolean;
	fetched: number;
	normalized: number;
	inserted: number;
	updated: number;
	skipped: number;
	invalid: number;
	protected: number;
	rows: ImportReportRow[];
	queried_at: string;
	bbox: typeof BRISTOL_BBOX;
	source_endpoint?: string;
	from_cache?: boolean;
};

type CachePayload = {
	saved_at: string;
	endpoint: string;
	elements: OverpassElement[];
};

type CategoryQuery = { id: string; filter: string };

const CATEGORY_QUERIES: CategoryQuery[] = [
	{ id: 'cafe', filter: '["amenity"="cafe"]' },
	{ id: 'pub', filter: '["amenity"="pub"]' },
	{ id: 'bar', filter: '["amenity"="bar"]' },
	{ id: 'restaurant', filter: '["amenity"="restaurant"]' },
	{ id: 'arts_centre', filter: '["amenity"="arts_centre"]' },
	{ id: 'gallery', filter: '["tourism"="gallery"]' },
	{ id: 'shop_art', filter: '["shop"="art"]' }
];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function bboxString(bbox = BRISTOL_BBOX): string {
	return `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
}

function buildCategoryQuery(filter: string, bbox = BRISTOL_BBOX): string {
	const box = bboxString(bbox);
	return `
[out:json][timeout:60];
(
  node${filter}(${box});
  way${filter}(${box});
);
out center tags;
`.trim();
}

function categoryFromTags(tags: Record<string, string>): string | null {
	if (tags.amenity) return tags.amenity;
	if (tags.tourism) return tags.tourism;
	if (tags.shop) return `shop:${tags.shop}`;
	return null;
}

function addressFromTags(tags: Record<string, string>): string | null {
	const line = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim();
	return line || null;
}

function isValidCoord(lat: number, lng: number): boolean {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lng) &&
		lat >= -90 &&
		lat <= 90 &&
		lng >= -180 &&
		lng <= 180 &&
		!(lat === 0 && lng === 0)
	);
}

function inBristolBbox(lat: number, lng: number, bbox = BRISTOL_BBOX): boolean {
	return lat >= bbox.south && lat <= bbox.north && lng >= bbox.west && lng <= bbox.east;
}

export function normalizeOverpassElement(
	el: OverpassElement,
	bbox = BRISTOL_BBOX
): NormalizedProspectCandidate | null {
	const tags = el.tags ?? {};
	const name = (tags.name ?? tags['name:en'] ?? '').trim();
	if (!name) return null;

	const lat = el.lat ?? el.center?.lat;
	const lng = el.lon ?? el.center?.lon;
	if (lat == null || lng == null) return null;
	if (!isValidCoord(lat, lng) || !inBristolBbox(lat, lng, bbox)) return null;

	const source_record_id = `${el.type}/${el.id}`;
	return {
		name,
		category: categoryFromTags(tags),
		address: addressFromTags(tags),
		locality: tags['addr:suburb'] ?? tags['addr:city'] ?? tags['addr:place'] ?? null,
		postcode: tags['addr:postcode'] ?? null,
		latitude: lat,
		longitude: lng,
		website: tags.website ?? tags['contact:website'] ?? null,
		phone: tags.phone ?? tags['contact:phone'] ?? null,
		source: OSM_SOURCE,
		source_record_id,
		source_url: `https://www.openstreetmap.org/${source_record_id}`
	};
}

async function postOverpass(
	endpoint: string,
	query: string
): Promise<{ ok: true; elements: OverpassElement[] } | { ok: false; status: number; detail: string }> {
	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
				'User-Agent': USER_AGENT
			},
			body: `data=${encodeURIComponent(query)}`,
			signal: AbortSignal.timeout(90_000)
		});

		if (!response.ok) {
			return { ok: false, status: response.status, detail: `HTTP ${response.status}` };
		}

		const payload = (await response.json()) as { elements?: OverpassElement[] };
		return { ok: true, elements: payload.elements ?? [] };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { ok: false, status: 0, detail: msg };
	}
}

async function fetchCategory(
	category: CategoryQuery,
	bbox = BRISTOL_BBOX
): Promise<{ elements: OverpassElement[]; endpoint: string }> {
	const query = buildCategoryQuery(category.filter, bbox);
	const errors: string[] = [];

	for (const endpoint of OVERPASS_ENDPOINTS) {
		for (let attempt = 0; attempt < 2; attempt++) {
			if (attempt > 0) await sleep(2500 + Math.floor(Math.random() * 1000));

			const result = await postOverpass(endpoint, query);
			if (result.ok) {
				return { elements: result.elements, endpoint };
			}

			errors.push(`${category.id}@${endpoint}: ${result.detail}`);
			if (result.status === 429 || result.status === 504 || result.status === 502) {
				await sleep(4000);
				continue;
			}
			break;
		}
	}

	throw new Error(`Category ${category.id} failed - ${errors.slice(-3).join('; ')}`);
}

export async function writeOverpassCache(
	elements: OverpassElement[],
	endpoint: string
): Promise<void> {
	await mkdir(CACHE_DIR, { recursive: true });
	const payload: CachePayload = {
		saved_at: new Date().toISOString(),
		endpoint,
		elements
	};
	await writeFile(CACHE_FILE, JSON.stringify(payload), 'utf8');
}

export async function readOverpassCache(): Promise<CachePayload | null> {
	try {
		const raw = await readFile(CACHE_FILE, 'utf8');
		const parsed = JSON.parse(raw) as CachePayload;
		if (!Array.isArray(parsed.elements)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Live fetch: one small Overpass query per venue category, with pauses.
 * Falls back to `.data/overpass-bristol-cache.json` when `preferCache` or all live attempts fail.
 */
export async function fetchBristolVenueCandidates(
	bbox = BRISTOL_BBOX,
	opts: { preferCache?: boolean; allowCacheFallback?: boolean } = {}
): Promise<{ elements: OverpassElement[]; endpoint: string; from_cache: boolean }> {
	if (opts.preferCache) {
		const cache = await readOverpassCache();
		if (cache) {
			return {
				elements: cache.elements,
				endpoint: `cache:${cache.endpoint}`,
				from_cache: true
			};
		}
	}

	const byId = new Map<string, OverpassElement>();
	const endpointsUsed = new Set<string>();
	const categoryErrors: string[] = [];

	for (let i = 0; i < CATEGORY_QUERIES.length; i++) {
		const category = CATEGORY_QUERIES[i];
		try {
			if (i > 0) await sleep(1200);
			const { elements, endpoint } = await fetchCategory(category, bbox);
			endpointsUsed.add(endpoint);
			for (const el of elements) {
				byId.set(`${el.type}/${el.id}`, el);
			}
			console.info(
				`[overpass] ${category.id}: ${elements.length} elements via ${endpoint}`
			);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			categoryErrors.push(msg);
			console.warn(`[overpass] ${msg}`);
		}
	}

	if (byId.size > 0) {
		const elements = [...byId.values()];
		const endpoint = [...endpointsUsed].join(', ') || 'overpass';
		await writeOverpassCache(elements, endpoint).catch((err) =>
			console.warn('[overpass] cache write failed:', err)
		);
		return { elements, endpoint, from_cache: false };
	}

	if (opts.allowCacheFallback !== false) {
		const cache = await readOverpassCache();
		if (cache?.elements.length) {
			console.warn('[overpass] using cached payload after live failure');
			return {
				elements: cache.elements,
				endpoint: `cache:${cache.endpoint}`,
				from_cache: true
			};
		}
	}

	throw new Error(
		categoryErrors.length
			? `Overpass failed for all categories. Wait 1-2 minutes and retry, or run: npm run import:venues:fetch. Details: ${categoryErrors[0]}`
			: 'Overpass returned no elements'
	);
}

/** Haversine distance in metres */
export function distanceMetres(
	a: { lat: number; lng: number },
	b: { lat: number; lng: number }
): number {
	const R = 6371000;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(b.lat - a.lat);
	const dLng = toRad(b.lng - a.lng);
	const lat1 = toRad(a.lat);
	const lat2 = toRad(b.lat);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export function namesLikelyDuplicate(a: string, b: string): boolean {
	const norm = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	const na = norm(a);
	const nb = norm(b);
	if (!na || !nb) return false;
	if (na === nb) return true;
	return na.includes(nb) || nb.includes(na);
}
