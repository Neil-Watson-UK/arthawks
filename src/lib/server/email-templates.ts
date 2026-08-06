import { ROUTES } from '$lib/constants/routes';
import { siteOrigin } from '$lib/server/email';

function wrapHtml(title: string, bodyHtml: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f3efe6;color:#1e293b;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:36rem;margin:0 auto;padding:2rem 1.25rem;">
    <p style="margin:0 0 1rem;font-size:0.75rem;letter-spacing:0.12em;text-transform:uppercase;opacity:0.6;">Art Hawks</p>
    <h1 style="margin:0 0 1rem;font-size:1.5rem;font-weight:500;">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="margin:2rem 0 0;font-size:0.85rem;opacity:0.65;">Bristol’s living gallery · arthawks.com</p>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function p(text: string): string {
	return `<p style="margin:0 0 0.85rem;line-height:1.5;">${escapeHtml(text)}</p>`;
}

function link(href: string, label: string): string {
	return `<p style="margin:1.25rem 0;"><a href="${escapeHtml(href)}" style="color:#c2410c;">${escapeHtml(label)}</a></p>`;
}

export function claimSubmittedAdminEmail(input: {
	prospectName: string;
	claimantName: string;
	roleAtVenue: string;
	workEmail: string;
	verificationInfo: string;
	message?: string | null;
}) {
	const adminUrl = `${siteOrigin()}${ROUTES.adminClaims}`;
	const subject = `[Art Hawks · Venues] Claim pending: ${input.prospectName}`;
	const text = [
		`A venue claim was submitted.`,
		``,
		`Space: ${input.prospectName}`,
		`Claimant: ${input.claimantName}`,
		`Role: ${input.roleAtVenue}`,
		`Work email: ${input.workEmail}`,
		`Verification: ${input.verificationInfo}`,
		input.message ? `Message: ${input.message}` : null,
		``,
		`Review: ${adminUrl}`
	]
		.filter((line) => line !== null)
		.join('\n');

	const html = wrapHtml(
		'Venue claim pending',
		[
			p(`Space: ${input.prospectName}`),
			p(`Claimant: ${input.claimantName} (${input.roleAtVenue})`),
			p(`Work email: ${input.workEmail}`),
			p(`Verification: ${input.verificationInfo}`),
			input.message ? p(`Message: ${input.message}`) : '',
			link(adminUrl, 'Open claims queue')
		].join('')
	);

	return { subject, text, html };
}

export function claimSubmittedClaimantEmail(input: { prospectName: string; fullName: string }) {
	const subject = `We received your claim for ${input.prospectName}`;
	const text = [
		`Hi ${input.fullName},`,
		``,
		`Thanks for claiming ${input.prospectName} on Art Hawks.`,
		`Our venues team will review your request. You’ll hear from us when it’s approved or if we need more detail.`,
		``,
		`- Art Hawks`
	].join('\n');

	const html = wrapHtml(
		'Claim received',
		[
			p(`Hi ${input.fullName},`),
			p(`Thanks for claiming ${input.prospectName} on Art Hawks.`),
			p(
				`Our venues team will review your request. You’ll hear from us when it’s approved or if we need more detail.`
			)
		].join('')
	);

	return { subject, text, html };
}

export function claimApprovedEmail(input: { prospectName: string; fullName: string }) {
	const venueUrl = `${siteOrigin()}${ROUTES.venue}`;
	const subject = `Approved: ${input.prospectName} on Art Hawks`;
	const text = [
		`Hi ${input.fullName},`,
		``,
		`Your claim for ${input.prospectName} is approved. You can edit the venue profile now.`,
		`When you’re ready to hang work and appear as a partner, activate Art Hawks from your venue hub.`,
		``,
		`Open venue hub: ${venueUrl}`,
		``,
		`- Art Hawks`
	].join('\n');

	const html = wrapHtml(
		'Claim approved',
		[
			p(`Hi ${input.fullName},`),
			p(`Your claim for ${input.prospectName} is approved. You can edit the venue profile now.`),
			p(
				`When you’re ready to hang work and appear as a partner, activate Art Hawks from your venue hub.`
			),
			link(venueUrl, 'Open venue hub')
		].join('')
	);

	return { subject, text, html };
}

export function claimRejectedEmail(input: {
	prospectName: string;
	fullName: string;
	notes?: string | null;
}) {
	const subject = `Update on your claim for ${input.prospectName}`;
	const text = [
		`Hi ${input.fullName},`,
		``,
		`We weren’t able to approve the claim for ${input.prospectName} at this time.`,
		input.notes ? `Note from the team: ${input.notes}` : null,
		`If you represent this space, reply to this email with more verification detail.`,
		``,
		`- Art Hawks`
	]
		.filter((line) => line !== null)
		.join('\n');

	const html = wrapHtml(
		'Claim update',
		[
			p(`Hi ${input.fullName},`),
			p(`We weren’t able to approve the claim for ${input.prospectName} at this time.`),
			input.notes ? p(`Note from the team: ${input.notes}`) : '',
			p(`If you represent this space, reply to this email with more verification detail.`)
		].join('')
	);

	return { subject, text, html };
}

export function venueActivatedOwnerEmail(input: { venueName: string; ownerName: string }) {
	const mapUrl = `${siteOrigin()}${ROUTES.map}`;
	const subject = `${input.venueName} is live on Art Hawks`;
	const text = [
		`Hi ${input.ownerName},`,
		``,
		`${input.venueName} is now an active Art Hawks partner venue.`,
		`You can match art, hang work, and appear on the city map.`,
		``,
		`Map: ${mapUrl}`,
		``,
		`- Art Hawks`
	].join('\n');

	const html = wrapHtml(
		'Venue activated',
		[
			p(`Hi ${input.ownerName},`),
			p(`${input.venueName} is now an active Art Hawks partner venue.`),
			p(`You can match art, hang work, and appear on the city map.`),
			link(mapUrl, 'Open the city map')
		].join('')
	);

	return { subject, text, html };
}

export function venueActivatedOpsEmail(input: { venueName: string; ownerEmail?: string | null }) {
	const subject = `[Art Hawks · Venues] Activated: ${input.venueName}`;
	const text = [
		`${input.venueName} opted in and is now partner_status=active.`,
		input.ownerEmail ? `Owner email: ${input.ownerEmail}` : null
	]
		.filter((line) => line !== null)
		.join('\n');

	const html = wrapHtml(
		'Venue activated',
		[
			p(`${input.venueName} opted in and is now an active partner.`),
			input.ownerEmail ? p(`Owner email: ${input.ownerEmail}`) : ''
		].join('')
	);

	return { subject, text, html };
}
