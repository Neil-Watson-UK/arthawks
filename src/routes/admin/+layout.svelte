<script lang="ts">
	import { page } from '$app/stores';
	import { ROUTES } from '$lib/constants/routes';

	let { children } = $props();

	const pathname = $derived($page.url.pathname);

	const links = [
		{ href: ROUTES.admin, label: 'Dashboard', exact: true },
		{ href: ROUTES.adminUsers, label: 'Users' },
		{ href: ROUTES.adminVenues, label: 'Venues' },
		{ href: ROUTES.adminProspects, label: 'Prospects' },
		{ href: ROUTES.adminClaims, label: 'Claims' },
		{ href: ROUTES.adminInbox, label: 'Inbox' },
		{ href: ROUTES.adminArtworks, label: 'Artworks' },
		{ href: ROUTES.adminMatches, label: 'Matches' },
		{ href: ROUTES.adminFinance, label: 'Finance' }
	] as const;

	function isActive(href: string, exact?: boolean): boolean {
		if (exact) return pathname === href;
		return pathname.startsWith(href);
	}
</script>

<div class="admin">
	<aside class="admin__nav">
		<p class="admin__eyebrow">Console</p>
		<h1 class="admin__brand">Art Hawks</h1>
		<nav aria-label="Admin">
			{#each links as link}
				<a
					class="admin__link"
					class:admin__link--active={isActive(link.href, 'exact' in link && link.exact)}
					href={link.href}
				>
					{link.label}
				</a>
			{/each}
		</nav>
	</aside>
	<main class="admin__main">
		{@render children()}
	</main>
</div>

<style>
	.admin {
		display: grid;
		min-height: calc(100dvh - 4rem);
		background:
			radial-gradient(ellipse 80% 50% at 10% 0%, rgb(194 65 12 / 0.08), transparent),
			linear-gradient(180deg, #faf9f6 0%, #f3efe6 100%);
	}
	.admin__nav {
		padding: 1.5rem 1.25rem;
		border-bottom: 1px solid rgb(30 41 59 / 0.08);
	}
	.admin__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.admin__brand {
		margin: 0.25rem 0 1rem;
		font-family: var(--font-display);
		font-size: 30pt;
		font-weight: 500;
		line-height: 1;
	}
	.admin__link {
		display: block;
		padding: 0.45rem 0.55rem;
		margin-bottom: 0.15rem;
		border-radius: 0.3rem;
		text-decoration: none;
		color: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		opacity: 0.7;
	}
	.admin__link--active,
	.admin__link:hover {
		opacity: 1;
		background: rgb(30 41 59 / 0.06);
	}
	.admin__main {
		padding: 1.5rem 1.25rem 3rem;
	}
	@media (min-width: 900px) {
		.admin {
			grid-template-columns: 14rem 1fr;
		}
		.admin__nav {
			border-bottom: none;
			border-right: 1px solid rgb(30 41 59 / 0.08);
			min-height: 100%;
		}
	}
</style>
