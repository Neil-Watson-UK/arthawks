import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mailReplyAddress, sendEmail, type MailRole } from '$lib/server/email';
import { sanitizeHeaderValue, verifyRecaptchaV3 } from '$lib/server/recaptcha';
import { createServiceClient } from '$lib/server/supabase';

const TOPICS = ['hello', 'artists', 'venues', 'support'] as const;
type Topic = (typeof TOPICS)[number];

const TOPIC_SUBJECT: Record<Topic, string> = {
	hello: '[Art Hawks · Hello] Website enquiry',
	artists: '[Art Hawks · Artists] Onboarding enquiry',
	venues: '[Art Hawks · Venues] Partnership enquiry',
	support: '[Art Hawks · Support] Help request'
};

/** Simple in-memory throttle: IP → timestamps */
const hits = new Map<string, number[]>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 8;

function clientIp(event: Parameters<RequestHandler>[0]): string {
	return (
		event.getClientAddress?.() ||
		event.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
		'unknown'
	);
}

function rateLimited(ip: string): boolean {
	const now = Date.now();
	const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	recent.push(now);
	hits.set(ip, recent);
	return recent.length > MAX_HITS;
}

export const POST: RequestHandler = async (event) => {
	let body: {
		topic?: string;
		name?: string;
		email?: string;
		message?: string;
		company?: string; // honeypot
		captchaToken?: string;
	};

	try {
		body = await event.request.json();
	} catch {
		throw error(400, { message: 'Invalid JSON' });
	}

	/* Honeypot - bots fill this; humans leave blank */
	if (body.company?.trim()) {
		return json({ ok: true });
	}

	const ip = clientIp(event);
	if (rateLimited(ip)) {
		throw error(429, { message: 'Too many messages. Please try again later.' });
	}

	const captcha = await verifyRecaptchaV3(body.captchaToken, 'contact', ip);
	if (!captcha.ok) {
		throw error(400, { message: 'Captcha failed. Please try again.' });
	}

	const topic = (body.topic?.trim().toLowerCase() ?? '') as Topic;
	if (!TOPICS.includes(topic)) {
		throw error(400, { message: 'topic must be hello, artists, venues, or support' });
	}

	const name = sanitizeHeaderValue(body.name ?? '', 120);
	const email = sanitizeHeaderValue(body.email?.trim().toLowerCase() ?? '', 254);
	const message = (body.message ?? '').trim();

	if (name.length < 2) throw error(400, { message: 'Name is required' });
	if (!email.includes('@')) throw error(400, { message: 'A valid email is required' });
	if (message.length < 10) throw error(400, { message: 'Please write a short message' });
	if (message.length > 4000) throw error(400, { message: 'Message is too long' });

	const role = topic as MailRole;
	const to = mailReplyAddress(role);
	const text = [
		`Topic: ${topic}`,
		`From: ${name} <${email}>`,
		`IP: ${ip}`,
		``,
		message
	].join('\n');

	const html = `<p><strong>From:</strong> ${escape(name)} &lt;${escape(email)}&gt;</p>
<p><strong>Topic:</strong> ${escape(topic)}</p>
<pre style="white-space:pre-wrap;font-family:inherit;">${escape(message)}</pre>`;

	const result = await sendEmail({
		to,
		replyTo: email,
		subject: `${TOPIC_SUBJECT[topic]} - ${name}`,
		text,
		html
	});

	if (!result.ok) {
		throw error(502, { message: 'Could not send message. Please email us directly.' });
	}

	const emailSkipped = 'skipped' in result && result.skipped === true;

	try {
		const supabase = createServiceClient();
		const { error: insertError } = await supabase.from('contact_submissions').insert({
			topic,
			name,
			email,
			message,
			ip: ip === 'unknown' ? null : ip,
			email_sent: !emailSkipped,
			email_skipped: emailSkipped,
			status: 'new'
		});
		if (insertError) {
			console.warn('[contact] persist failed:', insertError.message);
		}
	} catch (err) {
		console.warn('[contact] persist skipped:', err instanceof Error ? err.message : err);
	}

	return json({
		ok: true,
		skipped: emailSkipped
	});
};

function escape(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
