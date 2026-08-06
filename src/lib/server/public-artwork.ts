import { createServiceClient, hasPublicSupabaseEnv } from '$lib/server/supabase';
import { mockFallbacksAllowed } from '$lib/server/mock-fallbacks';
import {
	artworkImageUrl,
	getArtistById,
	mockArtworkListings
} from '$lib/data/mock-artists';
import type { ArtworkStatus } from '$lib/types/database';

export interface PublicArtwork {
	id: string;
	artist_id: string;
	title: string;
	medium: string | null;
	description: string | null;
	price: number;
	height_cm: number | null;
	width_cm: number | null;
	image_url: string;
	status: ArtworkStatus;
	created_at: string;
	artist_username: string;
	artist_full_name: string | null;
}

/*
 * Server-side art door. Uses service role then enforces active-artist visibility
 * so Discover/Find cannot link to quarantined seed works that anon RLS hides.
 */
export async function loadPublicArtwork(id: string): Promise<PublicArtwork | null> {
	if (hasPublicSupabaseEnv()) {
		try {
			const supabase = createServiceClient();
			const { data, error } = await supabase
				.from('artworks')
				.select('*')
				.eq('id', id)
				.maybeSingle();

			if (error) {
				console.error('loadPublicArtwork failed:', error.message);
				return null;
			}

			if (!data) {
				/* Fall through to mock only when explicitly allowed */
			} else {
				const { data: artist, error: artistError } = await supabase
					.from('profiles')
					.select('username, full_name, is_active, user_type')
					.eq('id', data.artist_id)
					.maybeSingle();

				if (artistError) {
					console.error('loadPublicArtwork artist failed:', artistError.message);
					return null;
				}

				if (!artist || artist.user_type !== 'artist' || artist.is_active === false) {
					return null;
				}

				return {
					id: data.id,
					artist_id: data.artist_id,
					title: data.title,
					medium: data.medium,
					description: data.description,
					price: data.price_pence,
					height_cm: data.height_cm,
					width_cm: data.width_cm,
					image_url: data.image_url || '',
					status: data.status,
					created_at: data.created_at,
					artist_username: artist.username,
					artist_full_name: artist.full_name
				};
			}
		} catch (err) {
			console.error('loadPublicArtwork service client failed:', err);
			if (!mockFallbacksAllowed()) return null;
		}
	}

	if (!mockFallbacksAllowed()) return null;

	const seed = mockArtworkListings.find((artwork) => artwork.id === id);
	if (!seed) return null;

	const artist = getArtistById(seed.artist_id);
	return {
		id: seed.id,
		artist_id: seed.artist_id,
		title: seed.title,
		medium: seed.medium,
		description: seed.description ?? null,
		price: seed.price,
		height_cm: seed.height_cm,
		width_cm: seed.width_cm,
		image_url: artworkImageUrl(seed.image_filename),
		status: 'available',
		created_at: '2026-07-01T10:00:00Z',
		artist_username: artist?.username ?? 'artist',
		artist_full_name: artist?.full_name ?? null
	};
}
