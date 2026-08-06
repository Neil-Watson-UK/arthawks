const SPRING_BACK_MS = 420;
const SWIPE_EXIT_MS = 380;

export const motion = {
	springBack: `transform ${SPRING_BACK_MS}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 280ms ease`,
	swipeExit: `transform ${SWIPE_EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease`,
	stackSettle: `transform 360ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 300ms ease`
} as const;

export function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function hapticTap(): void {
	if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		navigator.vibrate(8);
	}
}

export function hapticSwipe(direction: 'left' | 'right'): void {
	if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
		navigator.vibrate(direction === 'right' ? [12, 40, 18] : 10);
	}
}

export function computeExitVector(
	direction: 'left' | 'right',
	velocityX: number
): { x: number; y: number; rotation: number } {
	const baseX = direction === 'right' ? 540 : -540;
	const velocityBoost = Math.min(Math.abs(velocityX) * 0.35, 180);
	const x = direction === 'right' ? baseX + velocityBoost : baseX - velocityBoost;

	return {
		x,
		y: direction === 'right' ? 22 : -16,
		rotation: direction === 'right' ? 14 : -14
	};
}
