/*
 * Shared visual language for catalogue, gateway taste, and venue curation.
 * Keep this list short - classification should feel human, not taxonomic sprawl.
 */
export const ART_STYLES = [
	'landscape',
	'figurative',
	'graphic',
	'portrait',
	'abstract'
] as const;

export type ArtStyle = (typeof ART_STYLES)[number];

export const ART_STYLE_LABELS: Record<ArtStyle, string> = {
	landscape: 'Landscape',
	figurative: 'Figurative',
	graphic: 'Graphic',
	portrait: 'Portrait',
	abstract: 'Abstract'
};

const STYLE_ALIASES: Record<ArtStyle, string[]> = {
	landscape: ['landscape', 'landscapes', 'scenic', 'seascape', 'cityscape', 'vista'],
	figurative: ['figurative', 'figure', 'figures', 'people', 'human form', 'narrative'],
	graphic: ['graphic', 'graphics', 'illustration', 'poster', 'bold line', 'print'],
	portrait: ['portrait', 'portraits', 'face', 'likeness', 'sitter'],
	abstract: ['abstract', 'abstraction', 'non-representational', 'geometric', 'colour field']
};

export function isArtStyle(value: string): value is ArtStyle {
	return (ART_STYLES as readonly string[]).includes(value);
}

/*
 * Pull style signals from free text - gateway answers, venue briefs, spot notes.
 */
export function extractArtStyles(input: string): ArtStyle[] {
	const normalized = input.trim().toLowerCase();
	if (!normalized) return [];

	const found: ArtStyle[] = [];

	for (const style of ART_STYLES) {
		const aliases = STYLE_ALIASES[style];
		if (aliases.some((alias) => normalized.includes(alias))) {
			found.push(style);
		}
	}

	return found;
}

export function formatArtStyle(style: ArtStyle | string | null | undefined): string {
	if (!style) return 'Unclassified';
	if (isArtStyle(style)) return ART_STYLE_LABELS[style];
	return style;
}
