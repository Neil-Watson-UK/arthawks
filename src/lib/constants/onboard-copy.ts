/**
 * Registration marketing: one pitch per audience.
 * Keep benefit lines short; they sit beside the form, not as cards.
 */
export const ONBOARD_COPY = {
	artist: {
		eyebrow: 'For artists',
		title: 'Get your work on living walls',
		pitch:
			'Art Hawks places your catalogue in cafés, bars, and neighbourhood spaces so people meet your work in the wild, not only online.',
		benefits: [
			'Upload once; venues nearby can match and hang your pieces',
			'Auto Amor boards make install plug-and-play for partner spaces',
			'Follow rotations, proposals, and wall stories from your studio'
		],
		cta: 'Create artist studio',
		formEyebrow: 'Open your studio'
	},
	venue: {
		eyebrow: 'For venues',
		title: 'Fill your walls with local art',
		pitch:
			'Turn empty walls into a rotating gallery. Match with Bristol artists, curate a collection, and give guests something to discover while they stay.',
		benefits: [
			'Swipe or let Curate for Me suggest works that fit your space',
			'Calendar and Pulse keep rotations and footfall stories clear',
			'A public room page showcases what’s hanging right now'
		],
		cta: 'Open your venue room',
		formEyebrow: 'Register your space'
	},
	buyer: {
		eyebrow: 'For explorers',
		title: 'Discover art where you already go',
		pitch:
			'Art Hawks is a distributed gallery across the city. Browse Discover and the map freely; create an account when you want to save spottings and taste preferences.',
		benefits: [
			'Browse Discover and the map for what’s showing nearby (no account required)',
			'Tell us the styles you love; we shape recommendations around them',
			'Create an account to log spottings and keep your taste across visits'
		],
		cta: 'Join as an explorer',
		formEyebrow: 'Create your account (optional)'
	}
} as const;

export type OnboardAudience = keyof typeof ONBOARD_COPY;
