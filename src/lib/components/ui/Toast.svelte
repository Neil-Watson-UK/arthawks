<script lang="ts">
	interface Props {
		message: string;
	}

	let { message }: Props = $props();
</script>

<div class="toast" role="status" aria-live="polite">{message}</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: max(1.25rem, env(safe-area-inset-bottom));
		transform: translateX(-50%);
		padding: 0.75rem 1.1rem;
		border: 1px solid rgb(30 41 59 / 0.1);
		background: rgb(251 237 224 / 0.96);
		box-shadow: 0 12px 32px rgb(30 41 59 / 0.12);
		font-family: var(--font-sans, 'DM Sans', system-ui, sans-serif);
		font-size: 0.8125rem;
		font-weight: 500;
		color: #1e293b;
		animation: toast-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes toast-in {
		from {
			opacity: 0;
			transform: translateX(-50%) translateY(12px);
		}

		to {
			opacity: 1;
			transform: translateX(-50%) translateY(0);
		}
	}
</style>
