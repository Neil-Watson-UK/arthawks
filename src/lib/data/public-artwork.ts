/*
 * Client helper - path only. Artwork pages load via `$lib/server/public-artwork`.
 */
export function artworkPath(id: string): string {
	return `/art/${id}`;
}
