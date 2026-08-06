import { createHash, randomBytes, randomInt } from 'node:crypto';
import { env as privateEnv } from '$env/dynamic/private';
import Stripe from 'stripe';

export function getStripe(): Stripe {
	const key = privateEnv.STRIPE_SECRET_KEY;
	if (!key) {
		throw new Error('STRIPE_SECRET_KEY is not configured');
	}
	return new Stripe(key, {
		apiVersion: '2026-07-29.dahlia'
	});
}

export function hasStripeEnv(): boolean {
	return Boolean(privateEnv.STRIPE_SECRET_KEY);
}

export function stripeWebhookSecret(): string {
	const secret = privateEnv.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
	}
	return secret;
}

/** Six-digit numeric code - easy to read aloud at the wall. */
export function generatePickupCode(): string {
	return String(randomInt(100000, 1000000));
}

/** URL-safe token for public verify QR (not the 6-digit code). */
export function generatePickupVerifyToken(): string {
	return randomBytes(24).toString('base64url');
}

export function hashPickupCode(code: string): string {
	const pepper = privateEnv.PURCHASE_CODE_PEPPER || privateEnv.STRIPE_SECRET_KEY || 'arthawks';
	return createHash('sha256').update(`${pepper}:${code.trim()}`).digest('hex');
}

export function defaultCodeExpiry(): string {
	const expires = new Date();
	expires.setUTCDate(expires.getUTCDate() + 2);
	return expires.toISOString();
}
