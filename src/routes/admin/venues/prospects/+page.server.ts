import { adminServiceClient } from '$lib/server/admin';
import type { VenueProspectLifecycle } from '$lib/types/database';
import type { PageServerLoad } from './$types';

const STATUSES: VenueProspectLifecycle[] = [
	'draft',
	'unclaimed',
	'claim_pending',
	'verified',
	'inactive'
];

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);
	const raw = event.url.searchParams.get('status') ?? 'draft';
	const status: VenueProspectLifecycle = STATUSES.includes(raw as VenueProspectLifecycle)
		? (raw as VenueProspectLifecycle)
		: 'draft';

	const [{ data: prospects }, claimsCount] = await Promise.all([
		supabase
			.from('venue_prospects')
			.select('*')
			.eq('lifecycle_status', status)
			.order('name')
			.limit(300),
		supabase
			.from('venue_claims')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'pending')
	]);

	return {
		status,
		prospects: prospects ?? [],
		pendingClaimCount: claimsCount.count ?? 0
	};
};
