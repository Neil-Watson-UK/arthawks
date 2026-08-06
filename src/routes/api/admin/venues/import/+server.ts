import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';
import { runOverpassImport } from '$lib/server/venue-prospects';

/**
 * POST /api/admin/venues/import?dry_run=1&cache=0
 * Admin-only Bristol Overpass import. Default dry_run=true unless dry_run=0.
 * cache=1 forces use of .data/overpass-bristol-cache.json
 */
export const POST: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const dryParam = event.url.searchParams.get('dry_run');
	const dryRun = dryParam !== '0' && dryParam !== 'false';
	const preferCache =
		event.url.searchParams.get('cache') === '1' ||
		event.url.searchParams.get('cache') === 'true';

	try {
		const report = await runOverpassImport(supabase, { dryRun, preferCache });
		return json(report);
	} catch (err) {
		console.error('Overpass import failed:', err);
		throw error(502, {
			message: err instanceof Error ? err.message : 'Overpass import failed'
		});
	}
};
