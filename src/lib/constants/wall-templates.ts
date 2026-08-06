import type { WallRequestTemplate } from '$lib/types/rotations';

/*
 * Shared request language for venue mood/size asks and artist swap replies.
 */
export const WALL_REQUEST_TEMPLATES: WallRequestTemplate[] = [
	{
		id: 'warm-abstract-east',
		label: 'Warm abstract · east wall',
		mood: 'Warm abstract',
		min_cm: 80,
		max_cm: 100,
		message: 'Warm abstract, 80×100cm, for the east wall - soft light, afternoon footfall.'
	},
	{
		id: 'figurative-conversation',
		label: 'Figurative · conversation corner',
		mood: 'Figurative',
		min_cm: 50,
		max_cm: 70,
		message: 'Figurative work, roughly 50-70cm, for the conversation corner.'
	},
	{
		id: 'graphic-bar-back',
		label: 'Graphic · bar back',
		mood: 'Graphic',
		min_cm: 60,
		max_cm: 90,
		message: 'Bold graphic piece, 60-90cm, for the bar back wall.'
	},
	{
		id: 'landscape-quiet',
		label: 'Landscape · quiet alcove',
		mood: 'Landscape',
		min_cm: 40,
		max_cm: 80,
		message: 'Calm landscape, under 80cm on the long edge, for the quiet alcove.'
	},
	{
		id: 'portrait-entrance',
		label: 'Portrait · entrance',
		mood: 'Portrait',
		min_cm: 45,
		max_cm: 65,
		message: 'Portrait presence, about 45-65cm, to greet people at the entrance.'
	}
];
