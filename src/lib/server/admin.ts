import { error } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { requireUserType } from '$lib/server/auth';
import { createServiceClient } from '$lib/server/supabase';
import type { UserType } from '$lib/types/database';

export function requireAdmin(event: RequestEvent) {
	return requireUserType(event, 'admin' as UserType);
}

export function adminServiceClient(event: RequestEvent) {
	requireAdmin(event);
	try {
		return createServiceClient();
	} catch {
		throw error(503, { message: 'Service role is not configured' });
	}
}
