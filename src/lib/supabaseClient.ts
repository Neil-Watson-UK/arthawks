import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import type { Database } from '$lib/types/database';

/*
 * Browser/client Supabase singleton for Phase 1 store sync + Realtime.
 * Server routes continue to use `$lib/server/supabase` (cookie-aware SSR).
 */
const url = publicEnv.PUBLIC_SUPABASE_URL ?? '';
const anonKey = publicEnv.PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
	? createClient<Database>(url, anonKey, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
		})
	: null;
