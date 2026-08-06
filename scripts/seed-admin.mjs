#!/usr/bin/env node
/**
 * Create (or promote) an admin Auth user + profiles row.
 *
 * Usage (from repo root, with .env loaded):
 *   node --env-file=.env scripts/seed-admin.mjs
 *
 * Required env:
 *   PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADMIN_EMAIL
 *   ADMIN_PASSWORD  (min 8 chars; never commit this)
 *
 * Optional:
 *   ADMIN_USERNAME (default: admin)
 *   ADMIN_FULL_NAME (default: Art Hawks Admin)
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const username = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const fullName = process.env.ADMIN_FULL_NAME || 'Art Hawks Admin';
const bristolCityId = 'd0000000-0000-4000-8000-000000000001';

if (!url || !serviceKey) {
	console.error('Missing PUBLIC_SUPABASE_URL / SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
	process.exit(1);
}
if (!email.includes('@') || password.length < 8) {
	console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters)');
	process.exit(1);
}

const supabase = createClient(url, serviceKey, {
	auth: { autoRefreshToken: false, persistSession: false }
});

async function findUserByEmail() {
	let page = 1;
	for (;;) {
		const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
		if (error) throw error;
		const hit = data.users.find((u) => u.email?.toLowerCase() === email);
		if (hit) return hit;
		if (data.users.length < 200) return null;
		page += 1;
	}
}

const existing = await findUserByEmail();
let userId;

if (existing) {
	userId = existing.id;
	const { error } = await supabase.auth.admin.updateUserById(userId, {
		password,
		email_confirm: true,
		user_metadata: { full_name: fullName, user_type: 'admin' }
	});
	if (error) {
		console.error('Failed to update admin auth user:', error.message);
		process.exit(1);
	}
	console.log('Updated existing auth user:', email);
} else {
	const { data, error } = await supabase.auth.admin.createUser({
		email,
		password,
		email_confirm: true,
		user_metadata: { full_name: fullName, user_type: 'admin' }
	});
	if (error || !data.user) {
		console.error('Failed to create admin:', error?.message ?? 'unknown');
		process.exit(1);
	}
	userId = data.user.id;
	console.log('Created auth user:', email);
}

const { error: profileError } = await supabase.from('profiles').upsert(
	{
		id: userId,
		username,
		full_name: fullName,
		user_type: 'admin',
		email,
		city_id: bristolCityId,
		onboarding_complete: true,
		is_active: true,
		aesthetic_tags: [],
		preferred_media: []
	},
	{ onConflict: 'id' }
);

if (profileError) {
	console.error('Failed to upsert admin profile:', profileError.message);
	console.error('Ensure scripts/APPLY_IN_SUPABASE.sql (cities/venues/admin) has been run.');
	process.exit(1);
}

console.log('Admin profile ready:', { id: userId, username, email });
console.log('Sign in at /login — do not commit ADMIN_PASSWORD.');
