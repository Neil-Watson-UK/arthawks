import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing id' });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const allowed = ['title', 'status', 'price_pence', 'medium', 'description', 'style', 'substrate_tier'];
	const patch: Record<string, unknown> = {};
	for (const key of allowed) {
		if (key in body) patch[key] = body[key];
	}

	const { data, error: updateError } = await supabase
		.from('artworks')
		.update(patch as never)
		.eq('id', id)
		.select('id, status, title')
		.maybeSingle();

	if (updateError) throw error(500, { message: updateError.message });
	return json({ artwork: data });
};

export const DELETE: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing id' });

	const { error: deleteError } = await supabase.from('artworks').delete().eq('id', id);
	if (deleteError) throw error(500, { message: deleteError.message });
	return json({ ok: true });
};
