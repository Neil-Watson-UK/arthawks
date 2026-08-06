/**
 * Google reCAPTCHA v3 server verification.
 * When RECAPTCHA_SECRET_KEY is unset, verification is skipped (local/dev).
 */
import { env as privateEnv } from '$env/dynamic/private';

export type RecaptchaVerifyResult =
	| { ok: true; score: number; action: string; skipped?: false }
	| { ok: true; skipped: true; reason: string }
	| { ok: false; error: string; score?: number };

const SITEVERIFY = 'https://www.google.com/recaptcha/api/siteverify';
const MIN_SCORE = 0.5;

function secret(): string {
	const value = privateEnv.RECAPTCHA_SECRET_KEY;
	return typeof value === 'string' ? value.trim() : '';
}

export function recaptchaConfigured(): boolean {
	return Boolean(secret());
}

export async function verifyRecaptchaV3(
	token: string | undefined | null,
	expectedAction = 'contact',
	remoteip?: string
): Promise<RecaptchaVerifyResult> {
	if (!recaptchaConfigured()) {
		return { ok: true, skipped: true, reason: 'RECAPTCHA_SECRET_KEY not set' };
	}

	const response = typeof token === 'string' ? token.trim() : '';
	if (!response) {
		return { ok: false, error: 'Missing captcha token' };
	}

	const body = new URLSearchParams();
	body.set('secret', secret());
	body.set('response', response);
	if (remoteip) body.set('remoteip', remoteip);

	try {
		const res = await fetch(SITEVERIFY, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body
		});
		if (!res.ok) {
			return { ok: false, error: `reCAPTCHA HTTP ${res.status}` };
		}

		const data = (await res.json()) as {
			success?: boolean;
			score?: number;
			action?: string;
			'error-codes'?: string[];
		};

		if (!data.success) {
			return {
				ok: false,
				error: (data['error-codes'] ?? ['verification_failed']).join(', ')
			};
		}

		const score = typeof data.score === 'number' ? data.score : 0;
		const action = typeof data.action === 'string' ? data.action : '';

		if (expectedAction && action && action !== expectedAction) {
			return { ok: false, error: `Unexpected action: ${action}`, score };
		}

		if (score < MIN_SCORE) {
			return { ok: false, error: 'Low reCAPTCHA score', score };
		}

		return { ok: true, score, action };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return { ok: false, error: message };
	}
}

/** Strip CR/LF and other controls that could break mail headers. */
export function sanitizeHeaderValue(value: string, maxLen = 200): string {
	return value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
