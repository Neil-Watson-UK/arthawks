export function formatPrice(pence: number): string {
	return new Intl.NumberFormat('en-GB', {
		style: 'currency',
		currency: 'GBP',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(pence / 100);
}

/** Balance / ledger amounts - always show pence. */
export function formatBalance(pence: number): string {
	return new Intl.NumberFormat('en-GB', {
		style: 'currency',
		currency: 'GBP',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(pence / 100);
}

export function formatDimensions(height: number | null, width: number | null): string {
	if (!height || !width) return 'Dimensions unavailable';
	return `${height} × ${width} cm`;
}

export function formatArtistName(fullName: string | null, username: string): string {
	return fullName ?? `@${username}`;
}

export function formatDistance(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)} m away`;
	return `${(meters / 1000).toFixed(1)} km away`;
}
