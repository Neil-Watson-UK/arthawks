<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { ROUTES } from '$lib/constants/routes';

	let { data } = $props();

	let inviteEmail = $state('');
	let invitePassword = $state('');
	let inviteName = $state('');
	let inviteRole = $state<'artist' | 'venue' | 'buyer' | 'admin'>('buyer');
	let message = $state<string | null>(null);
	let errorMessage = $state<string | null>(null);
	let busyId = $state<string | null>(null);

	async function createUser(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		errorMessage = null;
		message = null;
		const response = await fetch('/api/admin/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: inviteEmail,
				password: invitePassword,
				full_name: inviteName,
				user_type: inviteRole
			})
		});
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		if (!response.ok) {
			errorMessage = payload?.message ?? 'Could not create user';
			return;
		}
		message = 'User created.';
		inviteEmail = '';
		invitePassword = '';
		inviteName = '';
		await invalidateAll();
	}

	async function setActive(id: string, is_active: boolean): Promise<void> {
		busyId = id;
		await fetch(`/api/admin/users/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ is_active })
		});
		busyId = null;
		await invalidateAll();
	}

	async function sendReset(id: string): Promise<void> {
		busyId = id;
		const response = await fetch(`/api/admin/users/${id}/reset-password`, { method: 'POST' });
		const payload = (await response.json().catch(() => null)) as { message?: string } | null;
		message = response.ok ? (payload?.message ?? 'Reset email sent.') : payload?.message ?? 'Failed';
		busyId = null;
	}
</script>

<section class="users">
	<p class="users__eyebrow">Directory</p>
	<h2 class="users__title">Users</h2>

	<div class="users__filters">
		<a href={ROUTES.adminUsers} class:active={!data.filter}>All</a>
		{#each ['artist', 'venue', 'buyer', 'admin'] as role}
			<a href={`${ROUTES.adminUsers}?role=${role}`} class:active={data.filter === role}>{role}</a>
		{/each}
	</div>

	<form class="users__invite" onsubmit={createUser}>
		<h3>Create account</h3>
		<input placeholder="Full name" bind:value={inviteName} required />
		<input type="email" placeholder="Email" bind:value={inviteEmail} required />
		<input type="password" placeholder="Temp password (8+)" bind:value={invitePassword} required minlength="8" />
		<select bind:value={inviteRole}>
			<option value="buyer">buyer</option>
			<option value="artist">artist</option>
			<option value="venue">venue</option>
			<option value="admin">admin</option>
		</select>
		<button type="submit">Create</button>
	</form>

	{#if message}<p class="users__ok">{message}</p>{/if}
	{#if errorMessage}<p class="users__err">{errorMessage}</p>{/if}

	<div class="users__table">
		{#each data.users as user (user.id)}
			<article class="users__row">
				<div>
					<strong>{user.full_name ?? user.username}</strong>
					<span>{user.email ?? '-'} · {user.user_type}</span>
				</div>
				<div class="users__actions">
					<span class:off={!user.is_active}>{user.is_active ? 'Active' : 'Off'}</span>
					<button type="button" disabled={busyId === user.id} onclick={() => setActive(user.id, !user.is_active)}>
						{user.is_active ? 'Deactivate' : 'Activate'}
					</button>
					<button type="button" disabled={busyId === user.id} onclick={() => sendReset(user.id)}>
						Reset password
					</button>
				</div>
			</article>
		{/each}
	</div>
</section>

<style>
	.users__eyebrow { margin: 0; font-size: 0.7rem; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.55; }
	.users__title { margin: 0.35rem 0 0; font-family: var(--font-display); font-size: 2rem; font-weight: 500; }
	.users__filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; }
	.users__filters a {
		padding: 0.3rem 0.65rem; border-radius: 0.3rem; text-decoration: none; color: inherit;
		font-size: 0.8rem; font-weight: 600; border: 1px solid rgb(30 41 59 / 0.12);
	}
	.users__filters a.active { background: var(--color-indigo); color: var(--color-cream); }
	.users__invite {
		display: grid; gap: 0.5rem; max-width: 28rem; margin: 1.25rem 0;
		padding: 1rem; border: 1px solid rgb(30 41 59 / 0.1); border-radius: 0.4rem;
	}
	.users__invite h3 { margin: 0 0 0.25rem; font-size: 0.95rem; }
	.users__invite input, .users__invite select {
		padding: 0.55rem 0.7rem; border: 1px solid rgb(30 41 59 / 0.18); border-radius: 0.3rem; font: inherit;
	}
	.users__invite button {
		padding: 0.6rem; border: none; border-radius: 0.3rem; background: var(--color-indigo); color: var(--color-cream); font-weight: 600;
	}
	.users__ok { color: var(--color-indigo); font-size: 0.85rem; }
	.users__err { color: var(--color-burnt); font-size: 0.85rem; }
	.users__table { display: grid; gap: 0.5rem; margin-top: 1rem; }
	.users__row {
		display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.75rem;
		padding: 0.85rem 1rem; border: 1px solid rgb(30 41 59 / 0.08); border-radius: 0.35rem; background: rgb(250 249 246 / 0.9);
	}
	.users__row strong { display: block; }
	.users__row span { font-size: 0.8rem; opacity: 0.7; }
	.users__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }
	.users__actions .off { color: var(--color-burnt); }
	.users__actions button {
		padding: 0.35rem 0.55rem; border: 1px solid rgb(30 41 59 / 0.15); border-radius: 0.25rem;
		background: transparent; font-size: 0.75rem; cursor: pointer;
	}
</style>
