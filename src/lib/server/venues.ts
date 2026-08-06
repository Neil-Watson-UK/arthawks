import { DISTRICT_COORDINATES, type BristolDistrict } from '$lib/data/simulated-users';
import { mailReplyAddress, sendEmailSafe } from '$lib/server/email';
import {
	venueActivatedOpsEmail,
	venueActivatedOwnerEmail
} from '$lib/server/email-templates';
import type { Database, VenuePartnerStatus } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

export type VenueRow = Database['public']['Tables']['venues']['Row'];

/** Owner hub: verified or active (not inactive). */
export async function getVenueOwnedBy(
	supabase: SupabaseClient<Database>,
	ownerId: string
): Promise<VenueRow | null> {
	const { data, error } = await supabase
		.from('venues')
		.select('*')
		.eq('owner_id', ownerId)
		.in('partner_status', ['verified', 'active'])
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (error) {
		/* partner_status column may be missing before migration */
		if (error.code === '42703') {
			const legacy = await supabase
				.from('venues')
				.select('*')
				.eq('owner_id', ownerId)
				.eq('is_active', true)
				.order('created_at', { ascending: true })
				.limit(1)
				.maybeSingle();
			if (legacy.error) {
				if (legacy.error.code === '42P01' || legacy.error.code === 'PGRST205') return null;
				throw new Error(legacy.error.message);
			}
			return legacy.data;
		}
		if (error.code === '42P01' || error.code === 'PGRST205') return null;
		throw new Error(error.message);
	}

	return data;
}

export async function getVenueById(
	supabase: SupabaseClient<Database>,
	venueId: string
): Promise<VenueRow | null> {
	const { data, error } = await supabase.from('venues').select('*').eq('id', venueId).maybeSingle();
	if (error) {
		if (error.code === '42P01' || error.code === 'PGRST205') return null;
		throw new Error(error.message);
	}
	return data;
}

export async function upsertVenueForOwner(
	supabase: SupabaseClient<Database>,
	input: {
		owner_id: string;
		id?: string;
		name: string;
		slug: string;
		bio?: string | null;
		website?: string | null;
		instagram?: string | null;
		image_url?: string | null;
		district?: BristolDistrict | string | null;
		postcode?: string | null;
		opening_hours?: string | null;
		geographic_location?: string | null;
		footfall?: string | null;
		aesthetic_tags?: string[];
		preferred_media?: string[];
		city_id?: string | null;
		partner_status?: VenuePartnerStatus;
		prospect_id?: string | null;
		/** When true, leave existing partner_status alone on conflict (default false for create). */
		preserve_partner_status?: boolean;
	}
): Promise<VenueRow | null> {
	const district = input.district as BristolDistrict | undefined;
	const legacyCoords = district ? DISTRICT_COORDINATES[district] : null;
	const geographic_location =
		input.geographic_location ??
		(legacyCoords ? `POINT(${legacyCoords.lng} ${legacyCoords.lat})` : null);

	const partner_status: VenuePartnerStatus = input.partner_status ?? 'verified';

	const payload: Record<string, unknown> = {
		id: input.id ?? input.owner_id,
		owner_id: input.owner_id,
		city_id: input.city_id ?? null,
		name: input.name,
		slug: input.slug,
		bio: input.bio ?? null,
		website: input.website ?? null,
		instagram: input.instagram ?? null,
		image_url: input.image_url ?? null,
		district: input.district ?? null,
		postcode: input.postcode ?? null,
		footfall: input.footfall ?? null,
		aesthetic_tags: input.aesthetic_tags ?? [],
		preferred_media: input.preferred_media ?? [],
		geographic_location,
		partner_status,
		is_active: partner_status === 'active',
		updated_at: new Date().toISOString(),
		...(input.opening_hours !== undefined ? { opening_hours: input.opening_hours } : {}),
		...(input.prospect_id !== undefined ? { prospect_id: input.prospect_id } : {})
	};

	if (input.preserve_partner_status) {
		const existing = await getVenueById(supabase, String(payload.id));
		if (existing) {
			delete payload.partner_status;
			delete payload.is_active;
		}
	}

	const { data, error } = await supabase
		.from('venues')
		.upsert(payload as never, { onConflict: 'id' })
		.select('*')
		.maybeSingle();

	if (error) {
		if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703') {
			console.warn('venues upsert skipped (schema not ready):', error.message);
			/* Retry without partner columns if migration not applied */
			if (error.code === '42703') {
				const legacyPayload = { ...payload };
				delete legacyPayload.partner_status;
				delete legacyPayload.prospect_id;
				legacyPayload.is_active = true;
				const retry = await supabase
					.from('venues')
					.upsert(legacyPayload as never, { onConflict: 'id' })
					.select('*')
					.maybeSingle();
				if (retry.error) {
					console.warn('venues legacy upsert failed:', retry.error.message);
					return null;
				}
				return retry.data;
			}
			return null;
		}
		throw new Error(error.message);
	}

	return data;
}

export function venueCanEditProfile(venue: VenueRow): boolean {
	const status = (venue as VenueRow & { partner_status?: string }).partner_status;
	if (!status) return venue.is_active;
	return status === 'verified' || status === 'active';
}

export function venueIsPartnerActive(venue: VenueRow): boolean {
	const status = (venue as VenueRow & { partner_status?: string }).partner_status;
	if (!status) return venue.is_active;
	return status === 'active';
}

/** Explicit opt-in after onboarding - sets partner_status=active. */
export async function activateVenuePartner(
	supabase: SupabaseClient<Database>,
	venueId: string,
	actorId: string
): Promise<VenueRow> {
	const venue = await getVenueById(supabase, venueId);
	if (!venue) throw new Error('Venue not found');
	if (venue.owner_id !== actorId) throw new Error('Not your venue');
	if (venue.partner_status === 'active') return venue;
	if (venue.partner_status === 'inactive') {
		throw new Error('This venue is inactive. Contact Art Hawks admin.');
	}
	if (!venue.geographic_location && !venue.postcode) {
		throw new Error('Add a postcode / location before activating');
	}

	const { data, error } = await supabase
		.from('venues')
		.update({
			partner_status: 'active',
			is_active: true,
			updated_at: new Date().toISOString()
		} as never)
		.eq('id', venueId)
		.select('*')
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!data) throw new Error('Activation failed');

	await supabase.from('venue_ownership_audit').insert({
		venue_id: venueId,
		actor_id: actorId,
		action: 'partner_activated',
		from_status: venue.partner_status,
		to_status: 'active',
		notes: 'Owner completed onboarding opt-in'
	} as never);

	const { data: owner } = await supabase
		.from('profiles')
		.select('full_name, email')
		.eq('id', actorId)
		.maybeSingle();

	const ownerEmail = owner?.email?.trim() || null;
	const ownerName = owner?.full_name?.trim() || venue.name;

	if (ownerEmail) {
		const ownerMail = venueActivatedOwnerEmail({
			venueName: data.name,
			ownerName
		});
		sendEmailSafe({
			to: ownerEmail,
			replyTo: 'venues',
			...ownerMail
		});
	}

	const opsMail = venueActivatedOpsEmail({
		venueName: data.name,
		ownerEmail
	});
	sendEmailSafe({
		to: mailReplyAddress('venues'),
		replyTo: 'venues',
		...opsMail
	});

	return data;
}
