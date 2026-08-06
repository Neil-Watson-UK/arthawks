import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env as privateEnv } from '$env/dynamic/private';

import { env as publicEnv } from '$env/dynamic/public';

import type { Database } from '$lib/types/database';

import type { RequestEvent } from '@sveltejs/kit';



export function hasPublicSupabaseEnv(): boolean {

	return Boolean(publicEnv.PUBLIC_SUPABASE_URL && publicEnv.PUBLIC_SUPABASE_ANON_KEY);

}



export async function createRequestClient(

	event: RequestEvent

): Promise<SupabaseClient<Database> | null> {

	if (!hasPublicSupabaseEnv()) {

		return null;

	}



	try {

		const { createServerClient } = await import('@supabase/ssr');



		return createServerClient<Database>(

			publicEnv.PUBLIC_SUPABASE_URL!,

			publicEnv.PUBLIC_SUPABASE_ANON_KEY!,

			{

				cookies: {

					getAll: () => event.cookies.getAll(),

					setAll: (

						cookiesToSet: {

							name: string;

							value: string;

							options?: Record<string, unknown>;

						}[]

					) => {

						for (const { name, value, options } of cookiesToSet) {

							event.cookies.set(name, value, { path: '/', ...options });

						}

					}

				}

			}

		) as unknown as SupabaseClient<Database>;

	} catch (err) {

		console.error('Failed to initialize Supabase request client:', err);

		return null;

	}

}



export function createServiceClient(): SupabaseClient<Database> {

	const url = privateEnv.SUPABASE_URL ?? publicEnv.PUBLIC_SUPABASE_URL;

	const key = privateEnv.SUPABASE_SERVICE_ROLE_KEY;



	if (!url || !key) {

		throw new Error('Missing Supabase environment variables');

	}



	return createClient<Database>(url, key, {

		auth: {

			autoRefreshToken: false,

			persistSession: false

		}

	});

}

