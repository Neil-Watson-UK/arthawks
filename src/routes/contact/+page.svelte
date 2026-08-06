<script lang="ts">
	import ContactForm from '$lib/components/contact/ContactForm.svelte';
	import { page } from '$app/stores';

	const topicParam = $derived($page.url.searchParams.get('topic'));
	const topic = $derived(
		topicParam === 'artists' ||
			topicParam === 'venues' ||
			topicParam === 'support' ||
			topicParam === 'hello'
			? topicParam
			: 'hello'
	);

	const copy = $derived.by(() => {
		switch (topic) {
			case 'artists':
				return {
					heading: 'Artists',
					lede: 'Questions about exhibiting on living walls? Write to artists@arthawks.com via this form.'
				};
			case 'venues':
				return {
					heading: 'Venues',
					lede: 'Partnerships and hosting - we’ll reply from venues@arthawks.com.'
				};
			case 'support':
				return {
					heading: 'Support',
					lede: 'Account, collect, or platform help - support@arthawks.com.'
				};
			default:
				return {
					heading: 'Hello',
					lede: 'General enquiries - hello@arthawks.com.'
				};
		}
	});
</script>

<section class="contact-page">
	<p class="contact-page__eyebrow">Art Hawks</p>
	<h1 class="contact-page__title">Contact</h1>
	<nav class="contact-page__tabs" aria-label="Inbox">
		<a href="/contact?topic=hello" class:active={topic === 'hello'}>Hello</a>
		<a href="/contact?topic=artists" class:active={topic === 'artists'}>Artists</a>
		<a href="/contact?topic=venues" class:active={topic === 'venues'}>Venues</a>
		<a href="/contact?topic=support" class:active={topic === 'support'}>Support</a>
	</nav>
	<ContactForm topic={topic} heading={copy.heading} lede={copy.lede} />
</section>

<style>
	.contact-page {
		max-width: 36rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}
	.contact-page__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.contact-page__title {
		margin: 0.35rem 0 1rem;
		font-family: var(--font-display);
		font-size: clamp(1.8rem, 4vw, 2.4rem);
		font-weight: 500;
	}
	.contact-page__tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
	}
	.contact-page__tabs a {
		color: inherit;
		opacity: 0.55;
		text-decoration: none;
		font-weight: 600;
	}
	.contact-page__tabs a.active,
	.contact-page__tabs a:hover {
		opacity: 1;
		text-decoration: underline;
	}
</style>
