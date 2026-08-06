import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);

	const { data: claims } = await supabase
		.from('venue_claims')
		.select('*')
		.eq('status', 'pending')
		.order('created_at', { ascending: true })
		.limit(100);

	const prospectIds = [...new Set((claims ?? []).map((c) => c.prospect_id))];
	const claimantIds = [...new Set((claims ?? []).map((c) => c.claimant_user_id))];

	const [{ data: prospects }, { data: profiles }] = await Promise.all([
		prospectIds.length
			? supabase.from('venue_prospects').select('*').in('id', prospectIds)
			: Promise.resolve({ data: [] as never[] }),
		claimantIds.length
			? supabase.from('profiles').select('id, full_name, username, email, user_type').in('id', claimantIds)
			: Promise.resolve({ data: [] as never[] })
	]);

	const prospectMap = new Map((prospects ?? []).map((p) => [p.id, p]));
	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

	return {
		claims: (claims ?? []).map((c) => ({
			...c,
			prospect: prospectMap.get(c.prospect_id) ?? null,
			claimant: profileMap.get(c.claimant_user_id) ?? null
		}))
	};
};
