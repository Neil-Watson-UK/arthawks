import { get } from 'svelte/store';
import { artworkImageUrl, getArtistById } from '$lib/data/mock-artists';
import { venueCuratedCollection, type NetworkArtwork } from '$lib/stores/network';
import type { SwipeCard } from '$lib/types/swipe';

export interface CuratedArtwork {
	id: string;
	title: string;
	artistName: string;
	price: number;
	imageUrl: string;
	description: string | null;
}

function resolveCuratedImageUrl(input: SwipeCard | NetworkArtwork): string {
	if (input.image_url) return input.image_url;
	if ('image_filename' in input) return artworkImageUrl(input.image_filename);
	return '';
}

export function toCuratedArtwork(input: SwipeCard | NetworkArtwork): CuratedArtwork {
	const artist = getArtistById(input.artist_id);

	return {
		id: input.id,
		title: input.title,
		artistName: artist?.full_name ?? 'Unknown artist',
		price: input.price,
		imageUrl: resolveCuratedImageUrl(input),
		description: input.description ?? null
	};
}

/** Snapshot helper for non-reactive contexts */
export function getAvailableCuratedCollection(): CuratedArtwork[] {
	return get(venueCuratedCollection).map(toCuratedArtwork);
}
