import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing id' });

	let body: { status?: string };
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	if (!body.status || !['pending', 'accepted', 'declined'].includes(body.status)) {
		throw error(400, { message: 'status must be pending|accepted|declined' });
	}

	const { data, error: updateError } = await supabase
		.from('matches')
		.update({ status: body.status } as never)
		.eq('id', id)
		.select('id, status')
		.maybeSingle();

	if (updateError) throw error(500, { message: updateError.message });
	return json({ match: data });
};
