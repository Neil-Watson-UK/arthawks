import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database> | null;
			session: Session | null;
			profile: ProfileRow | null;
		}
	}

	interface Window {
		grecaptcha?: {
			ready: (cb: () => void) => void;
			execute: (siteKey: string, options: { action: string }) => Promise<string>;
		};
	}
}

export {};
