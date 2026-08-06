<script lang="ts">
	import { goto } from '$app/navigation';
	import { ROUTES, spaceRoute } from '$lib/constants/routes';

	let { data } = $props();

	let fullName = $state(data.profile.full_name ?? '');
	let role = $state('');
	let workEmail = $state(data.profile.email ?? '');
	let verification = $state('');
	let message = $state('');
	let errorMessage = $state<string | null>(null);
	let busy = $state(false);

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (busy) return;
		busy = true;
		errorMessage = null;
		try {
			const response = await fetch('/api/venues/claim', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					prospect_id: data.prospect.id,
					full_name: fullName,
					role_at_venue: role,
					work_email: workEmail,
					verification_info: verification,
					message: message || undefined
				})
			});
			const payload = await response.json().catch(() => null);
			if (!response.ok) {
				errorMessage = payload?.message ?? 'Could not submit claim';
				return;
			}
			await goto(spaceRoute(data.prospect.id), { invalidateAll: true });
		} catch {
			errorMessage = 'Network error';
		} finally {
			busy = false;
		}
	}
</script>

<section class="claim">
	<p class="claim__eyebrow">Claim request</p>
	<h1 class="claim__title">{data.prospect.name}</h1>
	<p class="claim__lead">
		Tell us how you represent this space. An Art Hawks admin will review before you can edit the
		profile. The venue stays inactive until you complete onboarding and opt in.
	</p>

	{#if data.profile.user_type === 'artist'}
		<p class="claim__warn" role="alert">
			Artist accounts cannot claim venues. Use a venue or buyer account, or
			<a href={ROUTES.onboardVenue}>register a venue account</a>.
		</p>
	{:else}
		<form class="claim__form" onsubmit={submit}>
			<label>Full name <input required bind:value={fullName} /></label>
			<label>Role at the venue <input required bind:value={role} placeholder="Owner, manager…" /></label>
			<label>Work email <input type="email" required bind:value={workEmail} /></label>
			<label>
				Website or verification info
				<textarea required rows="3" bind:value={verification} placeholder="Venue website, Companies House, etc."
				></textarea>
			</label>
			<label>Optional message <textarea rows="2" bind:value={message}></textarea></label>
			{#if errorMessage}<p class="claim__err" role="alert">{errorMessage}</p>{/if}
			<button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit claim'}</button>
		</form>
	{/if}

	<p><a href={spaceRoute(data.prospect.id)}>← Back</a></p>
</section>

<style>
	.claim {
		max-width: 28rem;
		margin: 0 auto;
		padding: 2rem 1.25rem 4rem;
	}
	.claim__eyebrow {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		opacity: 0.55;
	}
	.claim__title {
		margin: 0.35rem 0 0;
		font-family: var(--font-display);
		font-size: 1.8rem;
		font-weight: 500;
	}
	.claim__lead {
		opacity: 0.85;
		line-height: 1.45;
	}
	.claim__warn {
		padding: 0.75rem;
		background: rgb(194 65 12 / 0.1);
	}
	.claim__form {
		display: grid;
		gap: 0.75rem;
		margin: 1.25rem 0;
	}
	.claim__form label {
		display: grid;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.claim__form input,
	.claim__form textarea {
		font: inherit;
		padding: 0.5rem 0.6rem;
		border: 1px solid rgb(30 41 59 / 0.2);
		border-radius: 0.25rem;
	}
	.claim__form button {
		font: inherit;
		font-weight: 600;
		padding: 0.65rem 1rem;
		background: #1e293b;
		color: #faf9f6;
		border: none;
		cursor: pointer;
	}
	.claim__err {
		color: #9a3412;
	}
</style>
