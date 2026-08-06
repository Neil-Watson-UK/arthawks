import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { WALL_REQUEST_TEMPLATES } from '$lib/constants/wall-templates';
import { requireApiProfile } from '$lib/server/api-auth';
import {
	insertProposal,
	SchemaNotReadyError,
	updateProposalStatus
} from '$lib/server/rotations-db';
import { createServiceClient } from '$lib/server/supabase';
import type { ProposalType } from '$lib/types/rotations';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROPOSAL_TYPES: ProposalType[] = ['swap', 'mood', 'size', 'hang'];

export const POST: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, ['artist', 'venue']);

	let body: {
		from_profile_id?: string;
		to_profile_id?: string;
		artwork_id?: string;
		match_id?: string | null;
		proposal_type?: string;
		message?: string;
		requested_mood?: string;
		requested_min_cm?: number;
		requested_max_cm?: number;
		template_id?: string;
	};

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (
		!body.from_profile_id ||
		!body.to_profile_id ||
		!body.artwork_id ||
		!UUID_RE.test(body.from_profile_id) ||
		!UUID_RE.test(body.to_profile_id) ||
		!UUID_RE.test(body.artwork_id)
	) {
		throw error(400, { message: 'from_profile_id, to_profile_id, and artwork_id are required' });
	}

	if (body.from_profile_id !== profile.id && profile.user_type !== 'admin') {
		throw error(403, { message: 'from_profile_id must be your own account' });
	}

	const template = WALL_REQUEST_TEMPLATES.find((item) => item.id === body.template_id);
	const proposalType = (
		PROPOSAL_TYPES.includes(body.proposal_type as ProposalType)
			? body.proposal_type
			: 'hang'
	) as ProposalType;

	try {
		const proposal = await insertProposal({
			from_profile_id: profile.id,
			to_profile_id: body.to_profile_id,
			artwork_id: body.artwork_id,
			match_id: body.match_id ?? null,
			proposal_type: proposalType,
			message: body.message?.trim() || template?.message || null,
			requested_mood: body.requested_mood ?? template?.mood ?? null,
			requested_min_cm: body.requested_min_cm ?? template?.min_cm ?? null,
			requested_max_cm: body.requested_max_cm ?? template?.max_cm ?? null
		});
		return json({ proposal });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to create proposal'
		});
	}
};

export const PATCH: RequestHandler = async (event) => {
	const profile = requireApiProfile(event, ['artist', 'venue']);

	let body: { proposal_id?: string; status?: string };

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Request body must be valid JSON' });
	}

	if (!body.proposal_id || !UUID_RE.test(body.proposal_id)) {
		throw error(400, { message: 'proposal_id must be a valid UUID' });
	}

	if (
		body.status !== 'accepted' &&
		body.status !== 'declined' &&
		body.status !== 'withdrawn'
	) {
		throw error(400, { message: 'status must be accepted, declined, or withdrawn' });
	}

	const supabase = createServiceClient();
	const { data: existing, error: qErr } = await supabase
		.from('placement_proposals')
		.select('id, from_profile_id, to_profile_id')
		.eq('id', body.proposal_id)
		.maybeSingle();

	if (qErr && !qErr.message?.includes('does not exist')) {
		throw error(500, { message: 'Failed to load proposal' });
	}
	if (!existing) {
		throw error(404, { message: 'Proposal not found' });
	}

	const isParticipant =
		profile.user_type === 'admin' ||
		existing.from_profile_id === profile.id ||
		existing.to_profile_id === profile.id;
	if (!isParticipant) {
		throw error(403, { message: 'Not a participant on this proposal' });
	}

	if (body.status === 'withdrawn' && existing.from_profile_id !== profile.id && profile.user_type !== 'admin') {
		throw error(403, { message: 'Only the sender can withdraw a proposal' });
	}

	try {
		const proposal = await updateProposalStatus(body.proposal_id, body.status);
		return json({ proposal });
	} catch (err) {
		if (err instanceof SchemaNotReadyError) {
			throw error(503, { message: err.message });
		}
		throw error(500, {
			message: err instanceof Error ? err.message : 'Failed to update proposal'
		});
	}
};
