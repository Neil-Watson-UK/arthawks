import type { SwipeableArtwork } from '$lib/types/database';

export interface ArtworkSpotting {
	username: string;
	venue_name: string;
	location: string;
}

export interface SwipeCard extends SwipeableArtwork {
	spottings?: ArtworkSpotting[];
}

export type SwipeAction = 'left' | 'right';

export interface SwipeEventDetail {
	card: SwipeCard;
	direction: SwipeAction;
}
