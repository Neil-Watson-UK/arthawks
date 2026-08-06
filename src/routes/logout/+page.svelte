<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { ROUTES } from '$lib/constants/routes';
	import { clearSessionIdentity } from '$lib/stores/network';
	import { supabase } from '$lib/supabaseClient';

	let status = $state('Signing out…');

	onMount(() => {
		void (async () => {
			try {
				/* Clear browser localStorage session first */
				if (supabase) {
					await supabase.auth.signOut({ scope: 'global' });
				}

				/* Clear SSR auth cookies */
				await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });

				clearSessionIdentity();
				await invalidateAll();
				status = 'Signed out';
				await goto(ROUTES.login, { replaceState: true });
			} catch {
				status = 'Could not sign out cleanly - redirecting…';
				clearSessionIdentity();
				await goto(ROUTES.login, { replaceState: true });
			}
		})();
	});
</script>

<section class="logout">
	<p>{status}</p>
</section>

<style>
	.logout {
		min-height: 40vh;
		display: grid;
		place-items: center;
		padding: 2rem;
		font-size: 0.95rem;
		color: rgb(30 41 59 / 0.65);
	}
</style>
