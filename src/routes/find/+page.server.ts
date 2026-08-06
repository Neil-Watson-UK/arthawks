import { resolveFindStyles, loadFindMatches } from '$lib/server/find-matches';
import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const styles = resolveFindStyles({
		queryStyles: url.searchParams.get('styles'),
		cookieStyles: cookies.get('arthawks_taste')
	});

	const prompt = url.searchParams.get('q')?.trim() || null;

	if (!hasPublicSupabaseEnv()) {
		return {
			prompt,
			styles,
			works: [],
			rooms: [],
			artists: [],
			empty: true,
			error: 'Live catalogue is not configured yet.'
		};
	}

	try {
		const supabase = createServiceClient();
		const results = await loadFindMatches(supabase, styles);
		return {
			prompt,
			...results,
			error: null
		};
	} catch (err) {
		console.error('Find matches failed:', err);
		return {
			prompt,
			styles,
			works: [],
			rooms: [],
			artists: [],
			empty: true,
			error: err instanceof Error ? err.message : 'Could not load matches'
		};
	}
};
