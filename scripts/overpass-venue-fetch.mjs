/**
 * Fetch Bristol OSM venue candidates and cache them locally.
 * Does not write to the database — use Admin → Prospects for dry-run/apply after this.
 *
 *   npm run import:venues:fetch
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
	fetchBristolVenueCandidates,
	normalizeOverpassElement
} from '../src/lib/server/overpass-import.ts';

const outDir = path.join(process.cwd(), '.data');

async function main() {
	console.log('Fetching Bristol venues from Overpass (small per-category queries)…');
	console.log('This often takes 30–90 seconds. Do not interrupt.\n');

	const { elements, endpoint, from_cache } = await fetchBristolVenueCandidates(undefined, {
		preferCache: false,
		allowCacheFallback: false
	});

	const candidates = [];
	let invalid = 0;
	for (const el of elements) {
		const c = normalizeOverpassElement(el);
		if (!c) {
			invalid += 1;
			continue;
		}
		candidates.push({
			name: c.name,
			category: c.category,
			postcode: c.postcode,
			locality: c.locality,
			source_record_id: c.source_record_id,
			lat: c.latitude,
			lng: c.longitude
		});
	}

	candidates.sort((a, b) => a.name.localeCompare(b.name));

	const summary = {
		fetched_at: new Date().toISOString(),
		endpoint,
		from_cache,
		raw_elements: elements.length,
		named_candidates: candidates.length,
		invalid_or_unnamed: invalid,
		by_category: Object.fromEntries(
			[...candidates.reduce((m, c) => {
				const key = c.category ?? 'unknown';
				m.set(key, (m.get(key) ?? 0) + 1);
				return m;
			}, new Map())].sort((a, b) => b[1] - a[1])
		),
		sample: candidates.slice(0, 40)
	};

	await mkdir(outDir, { recursive: true });
	const reportPath = path.join(outDir, 'overpass-fetch-summary.json');
	await writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');

	console.log(`Endpoint: ${endpoint}`);
	console.log(`Raw elements: ${elements.length}`);
	console.log(`Named candidates: ${candidates.length}`);
	console.log(`Invalid/unnamed: ${invalid}`);
	console.log(`Categories:`, summary.by_category);
	console.log(`\nCached elements → .data/overpass-bristol-cache.json`);
	console.log(`Summary → ${reportPath}`);
	console.log('\nNext: Admin → Prospects → “Dry-run from cache” (or dry-run; live will reuse cache on failure).');
}

main().catch((err) => {
	console.error(err instanceof Error ? err.message : err);
	process.exit(1);
});
