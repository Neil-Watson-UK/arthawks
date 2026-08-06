import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';
import type { ContactSubmissionStatus } from '$lib/types/database';

const STATUSES = ['new', 'read', 'archived'] as const;

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);

	let body: { id?: string; status?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const id = body.id?.trim() ?? '';
	const status = body.status?.trim() as ContactSubmissionStatus;
	if (!id) throw error(400, { message: 'id is required' });
	if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
		throw error(400, { message: 'status must be new, read, or archived' });
	}

	const { data, error: updateError } = await supabase
		.from('contact_submissions')
		.update({ status, updated_at: new Date().toISOString() })
		.eq('id', id)
		.select('id, status')
		.maybeSingle();

	if (updateError) {
		throw error(500, { message: updateError.message });
	}
	if (!data) {
		throw error(404, { message: 'Submission not found' });
	}

	return json({ ok: true, submission: data });
};
