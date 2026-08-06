import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminServiceClient } from '$lib/server/admin';

export const PATCH: RequestHandler = async (event) => {
	const supabase = adminServiceClient(event);
	const id = event.params.id;
	if (!id) throw error(400, { message: 'Missing venue id' });

	let body: Record<string, unknown>;
	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	const allowed = [
		'name',
		'slug',
		'bio',
		'website',
		'instagram',
		'image_url',
		'postcode',
		'opening_hours',
		'district',
		'footfall',
		'city_id',
		'owner_id',
		'is_active',
		'partner_status',
		'aesthetic_tags',
		'preferred_media'
	];
	const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
	for (const key of allowed) {
		if (key in body) patch[key] = body[key];
	}

	/* Keep is_active and partner_status aligned when either is sent */
	if (typeof patch.partner_status === 'string') {
		patch.is_active = patch.partner_status === 'active';
	} else if (typeof patch.is_active === 'boolean') {
		patch.partner_status = patch.is_active ? 'active' : 'inactive';
	}

	const { data, error: updateError } = await supabase
		.from('venues')
		.update(patch as never)
		.eq('id', id)
		.select('*')
		.maybeSingle();

	if (updateError) throw error(500, { message: updateError.message });
	return json({ venue: data });
};
