/**
 * Short explorer copy that turns discovery into footfall.
 */
export function visitCueLine(input: {
	opening_hours?: string | null;
	showing_count?: number;
}): string | null {
	const hours = input.opening_hours?.trim() || null;
	const showing = input.showing_count ?? 0;

	if (hours && showing > 0) return `Go there now · ${hours}`;
	if (hours) return `Open · ${hours}`;
	if (showing > 0) return 'Art on the walls - get directions';
	return null;
}

export function directionsUrl(lat: number, lng: number): string {
	return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
