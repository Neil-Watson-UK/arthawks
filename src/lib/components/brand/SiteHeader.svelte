<script lang="ts">
	import { browser } from '$app/environment';
	import { afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import ArtHawksLogo from '$lib/components/brand/ArtHawksLogo.svelte';
	import { ROUTES } from '$lib/constants/routes';
	import {
		allIdentities,
		clearSessionIdentity,
		currentUser,
		setCurrentUser,
		type SimulatedUser
	} from '$lib/stores/network';
	import { supabase } from '$lib/supabaseClient';
	import { goto, invalidateAll } from '$app/navigation';

	let {
		demoIdentities = false,
		signedIn = false
	}: {
		demoIdentities?: boolean;
		signedIn?: boolean;
	} = $props();

	let menuOpen = $state(false);
	let rootEl = $state<HTMLElement | null>(null);

	const pathname = $derived($page.url.pathname);
	const isHome = $derived(pathname === ROUTES.home);
	const isPitch =
		$derived(pathname === ROUTES.whyHost || pathname === ROUTES.whyExhibit);
	const isImmersive = $derived(isHome || isPitch);
	const isVenueArea = $derived(pathname.startsWith(ROUTES.venue));
	const isAdminArea = $derived(pathname.startsWith(ROUTES.admin));
	const isSwipe = $derived(pathname === ROUTES.venueSwipe);
	const isCurate = $derived(pathname === ROUTES.venueCurate);
	const isCalendar = $derived(pathname === ROUTES.venueCalendar);
	const isPulse = $derived(pathname === ROUTES.venuePulse);
	const isArtDoor = $derived(pathname.startsWith(`${ROUTES.art}/`));

	const primaryLinks = $derived.by(() => {
		const links: { href: string; label: string; match: (path: string) => boolean }[] = [
			{
				href: ROUTES.artist,
				label: 'Studio',
				match: (path: string) =>
					path === ROUTES.artist || path.startsWith(`${ROUTES.artist}/`)
			},
			{
				href: ROUTES.venue,
				label: 'Venue',
				match: (path: string) => path.startsWith(ROUTES.venue)
			},
			{
				href: ROUTES.discover,
				label: 'Discover',
				match: (path: string) => path.startsWith(ROUTES.discover)
			},
			{
				href: ROUTES.artists,
				label: 'Artists',
				match: (path: string) =>
					path === ROUTES.artists || path.startsWith(`${ROUTES.artists}/`)
			},
			{
				href: ROUTES.map,
				label: 'Map',
				match: (path: string) => path.startsWith(ROUTES.map)
			},
			{
				href: ROUTES.spaces,
				label: 'Spaces',
				match: (path: string) => path.startsWith(ROUTES.spaces)
			},
			{
				href: ROUTES.contact,
				label: 'Contact',
				match: (path: string) => path.startsWith(ROUTES.contact)
			}
		];
		if ($currentUser.role === 'admin' || isAdminArea) {
			links.push({
				href: ROUTES.admin,
				label: 'Admin',
				match: (path: string) => path.startsWith(ROUTES.admin)
			});
		}
		return links;
	});

	afterNavigate(() => {
		menuOpen = false;
	});

	function roleLabel(role: SimulatedUser['role']): string {
		switch (role) {
			case 'artist':
				return 'Artist';
			case 'venue':
				return 'Venue';
			case 'buyer':
				return 'Guest';
			case 'admin':
				return 'Admin';
		}
	}

	function subtitleFor(user: SimulatedUser): string {
		if (user.role === 'artist') return user.medium;
		if (user.role === 'venue') return user.aesthetic_tags.slice(0, 2).join(' · ');
		return user.location;
	}

	function toggleMenu(): void {
		menuOpen = !menuOpen;
	}

	function chooseUser(id: string): void {
		setCurrentUser(id);
		menuOpen = false;
	}

	let signingOut = $state(false);

	async function signOut(): Promise<void> {
		if (signingOut) return;
		signingOut = true;
		menuOpen = false;
		try {
			if (supabase) {
				await supabase.auth.signOut({ scope: 'global' });
			}
			await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
			clearSessionIdentity();
			await invalidateAll();
			await goto(ROUTES.login, { replaceState: true });
		} catch {
			clearSessionIdentity();
			await goto(ROUTES.logout, { replaceState: true });
		} finally {
			signingOut = false;
		}
	}

	$effect(() => {
		if (!browser || !menuOpen) return;

		function onPointerDown(event: PointerEvent): void {
			const target = event.target as Node | null;
			if (rootEl && target && !rootEl.contains(target)) {
				menuOpen = false;
			}
		}

		function onKeyDown(event: KeyboardEvent): void {
			if (event.key === 'Escape') menuOpen = false;
		}

		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);

		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<header
	bind:this={rootEl}
	class="site-header"
	class:site-header--home={isImmersive}
	class:site-header--door={isArtDoor}
>
	<div class="site-header__rail">
		<a class="site-header__brand" href={ROUTES.home} aria-label="Art Hawks home">
			<ArtHawksLogo variant="nav" onDark={isImmersive} class="site-header__logo" />
		</a>

		<nav class="site-header__nav" aria-label="Primary">
			{#each primaryLinks as link (link.href)}
				<a
					class="site-header__link"
					class:site-header__link--active={link.match(pathname)}
					href={link.href}
				>
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="site-header__aside">
			{#if demoIdentities && signedIn}
				<button
					type="button"
					class="site-header__text-btn"
					disabled={signingOut}
					onclick={() => void signOut()}
				>
					{signingOut ? 'Signing out…' : 'Log out'}
				</button>
			{/if}

			{#if demoIdentities}
				<button
					type="button"
					class="site-header__identity"
					aria-expanded={menuOpen}
					aria-controls="identity-menu"
					onclick={toggleMenu}
				>
					<span class="site-header__identity-role">{roleLabel($currentUser.role)}</span>
					<span class="site-header__identity-name">{$currentUser.full_name}</span>
				</button>

				{#if menuOpen}
					<div
						class="site-header__menu"
						id="identity-menu"
						role="menu"
						aria-label="Switch identity"
					>
						<p class="site-header__menu-eyebrow">Demo · viewing as</p>
						{#each $allIdentities as user (user.id)}
							<button
								type="button"
								class="site-header__persona"
								class:site-header__persona--active={$currentUser.id === user.id}
								role="menuitem"
								onclick={() => chooseUser(user.id)}
							>
								<span class="site-header__persona-role">{roleLabel(user.role)}</span>
								<span class="site-header__persona-name">{user.full_name}</span>
								<span class="site-header__persona-hint">{subtitleFor(user)}</span>
							</button>
						{/each}
					</div>
				{/if}
			{:else if signedIn}
				<button
					type="button"
					class="site-header__identity"
					aria-expanded={menuOpen}
					aria-controls="account-menu"
					onclick={toggleMenu}
				>
					<span class="site-header__identity-role">{roleLabel($currentUser.role)}</span>
					<span class="site-header__identity-name">{$currentUser.full_name}</span>
				</button>

				{#if menuOpen}
					<div
						class="site-header__menu"
						id="account-menu"
						role="menu"
						aria-label="Account"
					>
						<a class="site-header__menu-link" role="menuitem" href={ROUTES.accountPassword}
							>Password</a
						>
						<button
							type="button"
							class="site-header__menu-action"
							role="menuitem"
							disabled={signingOut}
							onclick={() => void signOut()}
						>
							{signingOut ? 'Signing out…' : 'Log out'}
						</button>
					</div>
				{/if}
			{:else}
				<a class="site-header__identity site-header__identity--link" href={ROUTES.login}>
					<span class="site-header__identity-role">Account</span>
					<span class="site-header__identity-name">Sign in</span>
				</a>
			{/if}
		</div>
	</div>

	{#if isVenueArea}
		<nav class="site-header__modes" aria-label="Venue modes">
			<a
				class="site-header__mode"
				class:site-header__mode--active={pathname === ROUTES.venue}
				href={ROUTES.venue}
			>
				Hub
			</a>
			<a
				class="site-header__mode"
				class:site-header__mode--active={pathname === ROUTES.venueSettings}
				href={ROUTES.venueSettings}
			>
				Identity
			</a>
			<a
				class="site-header__mode"
				class:site-header__mode--active={isCalendar}
				href={ROUTES.venueCalendar}
			>
				Calendar
			</a>
			<a
				class="site-header__mode"
				class:site-header__mode--active={isSwipe}
				href={ROUTES.venueSwipe}
			>
				Self-Curation
			</a>
			<a
				class="site-header__mode"
				class:site-header__mode--active={isCurate}
				href={ROUTES.venueCurate}
			>
				Curate for Me
			</a>
			<a
				class="site-header__mode"
				class:site-header__mode--active={isPulse}
				href={ROUTES.venuePulse}
			>
				Pulse
			</a>
		</nav>
	{/if}
</header>

<style>
	.site-header {
		--page-gutter: 1.25rem;
		--logo-width: clamp(10.75rem, 17vw, 12.75rem);
		position: sticky;
		top: 0;
		z-index: 50;
		overflow: visible;
		padding-inline: var(--page-gutter);
		color: var(--color-ink, #0e181f);
		background:
			linear-gradient(180deg, rgb(232 228 218 / 0.96) 0%, rgb(232 228 218 / 0.88) 100%);
		backdrop-filter: blur(14px);
	}

	.site-header--door {
		background:
			linear-gradient(180deg, rgb(243 240 232 / 0.96) 0%, rgb(232 228 218 / 0.88) 100%);
	}

	.site-header--home {
		position: absolute;
		inset-inline: 0;
		background: linear-gradient(180deg, rgb(14 24 31 / 0.72) 0%, rgb(14 24 31 / 0) 100%);
		color: var(--color-wall, #e8e4da);
		backdrop-filter: none;
	}

	.site-header--home .site-header__rail {
		border-bottom-color: rgb(232 228 218 / 0.16);
	}

	.site-header--home .site-header__link {
		color: rgb(232 228 218 / 0.62);
	}

	.site-header--home .site-header__link:hover,
	.site-header--home .site-header__link--active {
		color: var(--color-wall, #e8e4da);
	}

	.site-header--home .site-header__link::after {
		background: var(--color-pulse, #d4a35a);
	}

	.site-header--home .site-header__identity-role,
	.site-header--home .site-header__text-link,
	.site-header--home .site-header__text-btn {
		color: rgb(232 228 218 / 0.5);
	}

	.site-header--home .site-header__identity-name {
		color: var(--color-wall, #e8e4da);
	}

	.site-header--home .site-header__text-link:hover,
	.site-header--home .site-header__text-btn:hover:not(:disabled) {
		color: var(--color-pulse, #d4a35a);
	}

	.site-header--home :global(.site-header__logo) {
		filter: drop-shadow(0 12px 24px rgb(0 0 0 / 0.35));
	}

	.site-header--home .site-header__brand:hover :global(.site-header__logo) {
		filter: drop-shadow(0 16px 28px rgb(0 0 0 / 0.45));
	}

	.site-header--home .site-header__nav {
		border-top-color: rgb(232 228 218 / 0.12);
	}

	.site-header__rail {
		display: grid;
		grid-template-columns: minmax(0, auto) minmax(0, 1fr) minmax(0, auto);
		align-items: end;
		column-gap: clamp(1.5rem, 3.5vw, 3rem);
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: max(0.75rem, env(safe-area-inset-top)) 0 0;
		border-bottom: 1px solid rgb(14 24 31 / 0.14);
	}

	.site-header__brand {
		display: block;
		position: relative;
		z-index: 2;
		width: var(--logo-width);
		justify-self: start;
		text-decoration: none;
		line-height: 0;
	}

	.site-header__brand :global(.site-header__logo) {
		width: 100%;
		height: auto;
		/* Drop the dark plinth below the pencil line; orange sill rests on it */
		margin-bottom: -25px;
		filter: drop-shadow(0 10px 18px rgb(30 41 59 / 0.1));
		transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1), filter 260ms ease;
	}

	.site-header__brand:hover :global(.site-header__logo) {
		transform: translateY(1px);
		filter: drop-shadow(0 14px 22px rgb(30 41 59 / 0.14));
	}

	.site-header__nav {
		display: none;
		justify-self: center;
		align-items: center;
		gap: clamp(1.35rem, 2.8vw, 2.4rem);
		padding-bottom: 0.7rem;
		min-height: 2.5rem;
	}

	.site-header__link {
		position: relative;
		padding: 0.35rem 0 0.45rem;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		text-decoration: none;
		color: rgb(14 24 31 / 0.58);
		transition: color 180ms ease;
	}

	.site-header__link::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: var(--color-ember, #c9652e);
		transform: scaleX(0);
		transform-origin: center;
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.site-header__link:hover {
		color: var(--color-ink, #0e181f);
	}

	.site-header__link--active {
		color: var(--color-ink, #0e181f);
	}

	.site-header__link--active::after,
	.site-header__link:hover::after {
		transform: scaleX(1);
	}

	.site-header__aside {
		position: relative;
		justify-self: end;
		display: flex;
		align-items: flex-end;
		gap: 0.85rem;
		padding-bottom: 0.7rem;
		min-height: 2.5rem;
	}

	.site-header__identity {
		appearance: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.12rem;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
		color: inherit;
		text-align: right;
	}

	.site-header__identity--link {
		text-decoration: none;
	}

	.site-header__identity-role {
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.site-header__identity-name {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 0.95rem;
		font-weight: 500;
		letter-spacing: 0.01em;
		line-height: 1.1;
		max-width: 11rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--color-indigo, #1e293b);
	}

	.site-header__text-link,
	.site-header__text-btn {
		appearance: none;
		padding: 0;
		border: none;
		background: transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		text-decoration: none;
		color: rgb(30 41 59 / 0.48);
		cursor: pointer;
	}

	.site-header__text-link:hover,
	.site-header__text-btn:hover:not(:disabled) {
		color: var(--color-burnt, #c2410c);
	}

	.site-header__text-btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.site-header__modes {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.35rem 1.35rem;
		width: min(100%, 72rem);
		margin: 0 auto;
		padding: 0.55rem 0 0.7rem;
	}

	.site-header__mode {
		position: relative;
		padding: 0.2rem 0 0.35rem;
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		text-decoration: none;
		color: rgb(30 41 59 / 0.48);
	}

	.site-header__mode::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 1px;
		background: var(--color-burnt, #c2410c);
		transform: scaleX(0);
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.site-header__mode:hover,
	.site-header__mode--active {
		color: var(--color-burnt, #c2410c);
	}

	.site-header__mode:hover::after,
	.site-header__mode--active::after {
		transform: scaleX(1);
	}

	.site-header__menu {
		position: absolute;
		right: 0;
		top: calc(100% + 0.55rem);
		z-index: 60;
		display: grid;
		gap: 0.2rem;
		min-width: 14rem;
		padding: 0.75rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		border-radius: 0;
		background: var(--color-cream, #faf9f6);
		box-shadow: 0 18px 36px rgb(30 41 59 / 0.12);
	}

	.site-header__menu-eyebrow {
		margin: 0 0 0.35rem;
		font-size: 0.62rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.site-header__menu-link,
	.site-header__menu-action {
		appearance: none;
		display: block;
		width: 100%;
		padding: 0.6rem 0.45rem;
		border: none;
		border-radius: 0;
		background: transparent;
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		text-align: left;
		text-decoration: none;
		color: var(--color-indigo, #1e293b);
		cursor: pointer;
	}

	.site-header__menu-link:hover,
	.site-header__menu-action:hover:not(:disabled) {
		background: rgb(30 41 59 / 0.05);
		color: var(--color-burnt, #c2410c);
	}

	.site-header__menu-action:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.site-header__persona {
		display: grid;
		gap: 0.1rem;
		padding: 0.55rem 0.45rem;
		border: none;
		border-radius: 0;
		background: transparent;
		text-align: left;
		color: inherit;
		cursor: pointer;
	}

	.site-header__persona:hover,
	.site-header__persona--active {
		background: rgb(30 41 59 / 0.05);
	}

	.site-header__persona-role {
		font-size: 0.62rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: rgb(30 41 59 / 0.45);
	}

	.site-header__persona-name {
		font-family: var(--font-display, 'Fraunces', Georgia, serif);
		font-size: 0.92rem;
		font-weight: 500;
	}

	.site-header__persona-hint {
		font-size: 0.72rem;
		color: rgb(30 41 59 / 0.55);
	}

	@media (min-width: 820px) {
		.site-header__nav {
			display: flex;
		}
	}

	@media (min-width: 1100px) {
		.site-header {
			--page-gutter: 2rem;
		}
	}

	@media (max-width: 819px) {
		.site-header {
			/* Tall enough for the arched mark; was crushed by padding inside this width */
			--logo-width: 7.25rem;
		}

		.site-header__rail {
			position: relative;
			display: flex;
			flex-direction: column;
			align-items: stretch;
			gap: 0.45rem;
			padding-top: max(0.65rem, env(safe-area-inset-top));
		}

		.site-header__brand {
			align-self: center;
			justify-self: center;
			width: var(--logo-width);
			/* Do not add horizontal padding here - it shrinks the logo box */
			padding-inline: 0;
			z-index: 1;
		}

		.site-header__brand :global(.site-header__logo) {
			margin-bottom: -12px;
			filter: drop-shadow(0 6px 12px rgb(30 41 59 / 0.1));
		}

		.site-header__aside {
			position: absolute;
			top: max(0.55rem, env(safe-area-inset-top));
			right: 0;
			z-index: 4;
			padding-bottom: 0;
			min-height: 0;
			align-items: flex-start;
			max-width: min(42vw, 9.5rem);
		}

		.site-header__identity-name {
			max-width: 100%;
			font-size: 0.85rem;
		}

		.site-header__nav {
			display: flex;
			justify-content: space-between;
			gap: 0.4rem;
			padding-top: 0.45rem;
			border-top: 1px solid rgb(14 24 31 / 0.08);
		}

		.site-header--home .site-header__nav {
			border-top-color: rgb(232 228 218 / 0.12);
		}

		.site-header__link {
			font-size: 0.64rem;
			letter-spacing: 0.12em;
		}

		.site-header__modes {
			justify-content: flex-start;
		}

		.site-header__menu {
			min-width: 11rem;
		}
	}
</style>
