import { adminServiceClient } from '$lib/server/admin';
import type { PageServerLoad } from './$types';
import type { ContactSubmissionStatus, ContactTopic } from '$lib/types/database';

export const load: PageServerLoad = async (event) => {
	const supabase = adminServiceClient(event);
	const status = event.url.searchParams.get('status') ?? 'new';
	const topic = event.url.searchParams.get('topic') ?? '';

	let query = supabase
		.from('contact_submissions')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(100);

	if (status === 'new' || status === 'read' || status === 'archived') {
		query = query.eq('status', status as ContactSubmissionStatus);
	} else if (status !== 'all') {
		query = query.eq('status', 'new');
	}

	if (topic === 'hello' || topic === 'artists' || topic === 'venues' || topic === 'support') {
		query = query.eq('topic', topic as ContactTopic);
	}

	const [{ data: submissions }, counts] = await Promise.all([
		query,
		Promise.all(
			(['new', 'read', 'archived'] as const).map(async (s) => {
				const { count } = await supabase
					.from('contact_submissions')
					.select('*', { count: 'exact', head: true })
					.eq('status', s);
				return [s, count ?? 0] as const;
			})
		)
	]);

	return {
		submissions: submissions ?? [],
		filter: status === 'all' || status === 'read' || status === 'archived' ? status : 'new',
		topicFilter: topic,
		counts: Object.fromEntries(counts) as Record<'new' | 'read' | 'archived', number>
	};
};
