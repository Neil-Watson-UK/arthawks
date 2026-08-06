import { adminServiceClient } from '$lib/server/admin';
import { listProspects } from '$lib/server/venue-prospects';
import type { VenueProspectLifecycle } from '$lib/types/database';
import type { PageServerLoad } from './$types';

const STATUSES: VenueProspectLifecycle[] = [
	'draft',
	'unclaimed',
	'claim_pending',
	'verified',
	'inactive'
];

const PAGE_SIZE = 50;

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);
	const raw = event.url.searchParams.get('status') ?? 'draft';
	const status: VenueProspectLifecycle = STATUSES.includes(raw as VenueProspectLifecycle)
		? (raw as VenueProspectLifecycle)
		: 'draft';

	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const letterRaw = event.url.searchParams.get('letter')?.trim().toUpperCase() ?? '';
	const letter =
		letterRaw === '#' || /^[A-Z]$/.test(letterRaw) ? letterRaw : '';

	const pageRaw = Number.parseInt(event.url.searchParams.get('page') ?? '1', 10);
	const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
	const offset = (page - 1) * PAGE_SIZE;

	const [{ prospects, total, limit }, claimsCount] = await Promise.all([
		listProspects(supabase, {
			status,
			q: q || undefined,
			letter: letter || undefined,
			limit: PAGE_SIZE,
			offset
		}),
		supabase
			.from('venue_claims')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'pending')
	]);

	const totalPages = Math.max(1, Math.ceil(total / limit));

	return {
		status,
		q,
		letter,
		page,
		pageSize: limit,
		total,
		totalPages,
		prospects,
		pendingClaimCount: claimsCount.count ?? 0
	};
};
