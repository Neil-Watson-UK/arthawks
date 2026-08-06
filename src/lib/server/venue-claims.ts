import { BRISTOL_CITY_ID } from '$lib/constants/geo';
import { mailFounderBcc, mailReplyAddress, sendEmailSafe } from '$lib/server/email';
import {
	claimApprovedEmail,
	claimRejectedEmail,
	claimSubmittedAdminEmail,
	claimSubmittedClaimantEmail
} from '$lib/server/email-templates';
import { pointWkt } from '$lib/server/postcode';
import type { Database, VenueClaimStatus } from '$lib/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProspectById, updateProspect } from '$lib/server/venue-prospects';
import { upsertVenueForOwner } from '$lib/server/venues';

export type VenueClaimRow = Database['public']['Tables']['venue_claims']['Row'];

function slugFromName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, 40) || 'venue';
}

async function writeAudit(
	supabase: SupabaseClient<Database>,
	row: Database['public']['Tables']['venue_ownership_audit']['Insert']
): Promise<void> {
	const { error } = await supabase.from('venue_ownership_audit').insert(row as never);
	if (error) {
		console.warn('venue_ownership_audit insert failed:', error.message);
	}
}

export async function listClaims(
	supabase: SupabaseClient<Database>,
	opts: { status?: VenueClaimStatus; limit?: number } = {}
): Promise<VenueClaimRow[]> {
	let q = supabase
		.from('venue_claims')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(opts.limit ?? 200);
	if (opts.status) q = q.eq('status', opts.status);
	const { data, error } = await q;
	if (error) throw new Error(error.message);
	return data ?? [];
}

export async function getClaimById(
	supabase: SupabaseClient<Database>,
	id: string
): Promise<VenueClaimRow | null> {
	const { data, error } = await supabase.from('venue_claims').select('*').eq('id', id).maybeSingle();
	if (error) throw new Error(error.message);
	return data;
}

export async function submitVenueClaim(
	supabase: SupabaseClient<Database>,
	input: {
		prospect_id: string;
		claimant_user_id: string;
		full_name: string;
		role_at_venue: string;
		work_email: string;
		verification_info: string;
		message?: string | null;
		claimant_user_type: string;
	}
): Promise<VenueClaimRow> {
	if (input.claimant_user_type === 'artist') {
		throw new Error(
			'Artist accounts cannot claim venues. Sign in with a venue or buyer account, or create a new account for this space.'
		);
	}
	if (input.claimant_user_type === 'admin') {
		throw new Error('Use the admin console to manage venues directly.');
	}

	const prospect = await getProspectById(supabase, input.prospect_id);
	if (!prospect) throw new Error('Venue prospect not found');
	if (prospect.lifecycle_status !== 'unclaimed' && prospect.lifecycle_status !== 'claim_pending') {
		throw new Error('This space is not open for claims');
	}
	if (prospect.linked_venue_id) {
		throw new Error('This space has already been linked to an Art Hawks venue');
	}

	const { data: existingPending } = await supabase
		.from('venue_claims')
		.select('id')
		.eq('prospect_id', input.prospect_id)
		.eq('status', 'pending')
		.maybeSingle();

	if (existingPending) {
		throw new Error('A claim is already pending for this space');
	}

	const workEmail = input.work_email.trim().toLowerCase();
	if (!workEmail.includes('@')) throw new Error('A valid work email is required');

	const { data, error } = await supabase
		.from('venue_claims')
		.insert({
			prospect_id: input.prospect_id,
			claimant_user_id: input.claimant_user_id,
			full_name: input.full_name.trim(),
			role_at_venue: input.role_at_venue.trim(),
			work_email: workEmail,
			verification_info: input.verification_info.trim(),
			message: input.message?.trim() || null,
			status: 'pending'
		} as never)
		.select('*')
		.maybeSingle();

	if (error) {
		if (error.code === '23505') throw new Error('A claim is already pending for this space');
		throw new Error(error.message);
	}
	if (!data) throw new Error('Could not create claim');

	await updateProspect(supabase, input.prospect_id, { lifecycle_status: 'claim_pending' });

	await writeAudit(supabase, {
		prospect_id: input.prospect_id,
		claim_id: data.id,
		actor_id: input.claimant_user_id,
		action: 'claim_submitted',
		to_status: 'claim_pending',
		notes: `Claim by ${workEmail}`
	});

	const venuesInbox = mailReplyAddress('venues');
	const founderBcc = mailFounderBcc();
	const adminMail = claimSubmittedAdminEmail({
		prospectName: prospect.name,
		claimantName: input.full_name.trim(),
		roleAtVenue: input.role_at_venue.trim(),
		workEmail,
		verificationInfo: input.verification_info.trim(),
		message: input.message
	});
	sendEmailSafe({
		to: venuesInbox,
		replyTo: 'venues',
		bcc: founderBcc ?? undefined,
		...adminMail
	});

	const claimantMail = claimSubmittedClaimantEmail({
		prospectName: prospect.name,
		fullName: input.full_name.trim()
	});
	sendEmailSafe({
		to: workEmail,
		replyTo: 'venues',
		...claimantMail
	});

	return data;
}

export async function rejectClaim(
	supabase: SupabaseClient<Database>,
	claimId: string,
	adminId: string,
	notes?: string
): Promise<VenueClaimRow> {
	const claim = await getClaimById(supabase, claimId);
	if (!claim) throw new Error('Claim not found');
	if (claim.status !== 'pending') throw new Error('Claim is not pending');

	const { data, error } = await supabase
		.from('venue_claims')
		.update({
			status: 'rejected',
			reviewed_by: adminId,
			reviewed_at: new Date().toISOString(),
			review_notes: notes?.trim() || null,
			updated_at: new Date().toISOString()
		} as never)
		.eq('id', claimId)
		.select('*')
		.maybeSingle();

	if (error) throw new Error(error.message);
	if (!data) throw new Error('Claim update failed');

	const { data: otherPending } = await supabase
		.from('venue_claims')
		.select('id')
		.eq('prospect_id', claim.prospect_id)
		.eq('status', 'pending')
		.limit(1);

	if (!otherPending?.length) {
		await updateProspect(supabase, claim.prospect_id, { lifecycle_status: 'unclaimed' });
	}

	await writeAudit(supabase, {
		prospect_id: claim.prospect_id,
		claim_id: claimId,
		actor_id: adminId,
		action: 'claim_rejected',
		from_status: 'pending',
		to_status: 'rejected',
		notes: notes ?? null
	});

	const prospect = await getProspectById(supabase, claim.prospect_id);
	const rejectMail = claimRejectedEmail({
		prospectName: prospect?.name ?? 'your venue',
		fullName: claim.full_name,
		notes
	});
	sendEmailSafe({
		to: claim.work_email,
		replyTo: 'venues',
		...rejectMail
	});

	return data;
}

export async function approveClaim(
	supabase: SupabaseClient<Database>,
	claimId: string,
	adminId: string,
	notes?: string
): Promise<{ claim: VenueClaimRow; venue_id: string }> {
	const claim = await getClaimById(supabase, claimId);
	if (!claim) throw new Error('Claim not found');
	if (claim.status !== 'pending') throw new Error('Claim is not pending');

	const prospect = await getProspectById(supabase, claim.prospect_id);
	if (!prospect) throw new Error('Prospect not found');

	const { data: profile, error: profileErr } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', claim.claimant_user_id)
		.maybeSingle();

	if (profileErr || !profile) throw new Error('Claimant profile not found');
	if (profile.user_type === 'artist') {
		throw new Error('Cannot approve: claimant is an artist account');
	}

	if (profile.user_type !== 'venue') {
		const { error: typeErr } = await supabase
			.from('profiles')
			.update({ user_type: 'venue', updated_at: new Date().toISOString() } as never)
			.eq('id', profile.id);
		if (typeErr) throw new Error(typeErr.message);
	}

	const slugBase = slugFromName(prospect.name);
	let slug = slugBase;
	for (let i = 0; i < 8; i++) {
		const { data: clash } = await supabase
			.from('venues')
			.select('id')
			.eq('slug', slug)
			.maybeSingle();
		if (!clash || clash.id === claim.claimant_user_id) break;
		slug = `${slugBase}_${i + 2}`;
	}

	const geo = pointWkt(prospect.latitude, prospect.longitude);
	const venue = await upsertVenueForOwner(supabase, {
		id: claim.claimant_user_id,
		owner_id: claim.claimant_user_id,
		name: prospect.name,
		slug,
		website: prospect.website,
		postcode: prospect.postcode,
		geographic_location: geo,
		city_id: BRISTOL_CITY_ID,
		district: prospect.locality,
		partner_status: 'verified',
		prospect_id: prospect.id,
		aesthetic_tags: ['contemporary'],
		preferred_media: []
	});

	if (!venue) throw new Error('Failed to create venue for approved claim');

	const { data: updatedClaim, error: claimErr } = await supabase
		.from('venue_claims')
		.update({
			status: 'approved',
			reviewed_by: adminId,
			reviewed_at: new Date().toISOString(),
			review_notes: notes?.trim() || null,
			updated_at: new Date().toISOString()
		} as never)
		.eq('id', claimId)
		.select('*')
		.maybeSingle();

	if (claimErr || !updatedClaim) throw new Error(claimErr?.message ?? 'Claim update failed');

	await updateProspect(supabase, prospect.id, {
		lifecycle_status: 'verified',
		linked_venue_id: venue.id
	});

	/* Reject other pending claims on same prospect */
	const { data: others } = await supabase
		.from('venue_claims')
		.select('id')
		.eq('prospect_id', prospect.id)
		.eq('status', 'pending');

	for (const other of others ?? []) {
		await supabase
			.from('venue_claims')
			.update({
				status: 'rejected',
				reviewed_by: adminId,
				reviewed_at: new Date().toISOString(),
				review_notes: 'Another claim was approved for this space',
				updated_at: new Date().toISOString()
			} as never)
			.eq('id', other.id);
	}

	await writeAudit(supabase, {
		venue_id: venue.id,
		prospect_id: prospect.id,
		claim_id: claimId,
		actor_id: adminId,
		action: 'claim_approved',
		to_owner_id: claim.claimant_user_id,
		from_status: 'claim_pending',
		to_status: 'verified',
		notes: notes ?? null
	});

	const approveMail = claimApprovedEmail({
		prospectName: prospect.name,
		fullName: claim.full_name
	});
	sendEmailSafe({
		to: claim.work_email,
		replyTo: 'venues',
		...approveMail
	});

	return { claim: updatedClaim, venue_id: venue.id };
}
