import { useMemo } from 'react'

// ANSI escape code regex for parsing
const ANSI_PATTERN = /\x1b\[([0-9;]+)m/g

// ANSI regex for stripping (exported for use in copy/search)
export const ANSI_REGEX = /\x1b\[.*?m/g

/**
 * Strip ANSI escape codes from text (for copy, search, etc.)
 */
export function stripAnsi(text: string): string {
	return text.replace(ANSI_REGEX, '')
}

interface TextSegment {
	text: string
	style: React.CSSProperties
}

/**
 * Dims a hex color by a given factor
 */
function dimColor(col: string, factor: number = 0.6): string {
	if (col.startsWith('#') && (col.length === 7 || col.length === 4)) {
		if (col.length === 7) {
			const r = parseInt(col.slice(1, 3), 16)
			const g = parseInt(col.slice(3, 5), 16)
			const b = parseInt(col.slice(5, 7), 16)
			const nr = Math.round(r * factor)
			const ng = Math.round(g * factor)
			const nb = Math.round(b * factor)
			return '#' + [nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('')
		} else if (col.length === 4) {
			// Expand short hex notation (#rgb)
			const r = parseInt(col.charAt(1) + col.charAt(1), 16)
			const g = parseInt(col.charAt(2) + col.charAt(2), 16)
			const b = parseInt(col.charAt(3) + col.charAt(3), 16)
			const nr = Math.round(r * factor)
			const ng = Math.round(g * factor)
			const nb = Math.round(b * factor)
			return '#' + [nr, ng, nb].map((x) => x.toString(16).padStart(2, '0')).join('')
		}
	}
	return col
}

/**
 * Merges text-decoration values
 */
function mergeTextDecoration(current: string | undefined, addition: string): string {
	if (!current || current === 'none') {
		return addition
	}
	const parts = current.split(/\s+/)
	if (parts.includes(addition)) return current
	return parts.concat(addition).join(' ')
}

/**
 * Removes a specific text-decoration from the current decoration
 */
function removeTextDecoration(current: string | undefined, removal: string): string {
	if (!current) return ''
	const parts = current.split(/\s+/).filter((p) => p !== removal)
	return parts.join(' ')
}

/**
 * Updates the style object based on a single ANSI code
 * Supports merging of effects such as bold and underline
 */
function updateStyle(style: React.CSSProperties, code: string): React.CSSProperties {
	const newStyle = { ...style }

	switch (code) {
		case '0':
			// Reset all styles
			return {}
		case '1':
			newStyle.fontWeight = 'bold'
			break
		case '2':
			// Dim - if a color is already set, adjust it
			if (newStyle.color && typeof newStyle.color === 'string') {
				newStyle.color = dimColor(newStyle.color, 0.6)
			} else {
				newStyle.color = '#999999'
			}
			break
		case '3':
			newStyle.fontStyle = 'italic'
			break
		case '4':
			newStyle.textDecoration = mergeTextDecoration(newStyle.textDecoration as string, 'underline')
			break
		case '7':
			newStyle.filter = 'invert(100%)'
			break
		case '8':
			newStyle.visibility = 'hidden'
			break
		case '9':
			newStyle.textDecoration = mergeTextDecoration(newStyle.textDecoration as string, 'line-through')
			break
		case '22':
			// Reset bold/dim
			delete newStyle.fontWeight
			break
		case '23':
			delete newStyle.fontStyle
			break
		case '24':
			newStyle.textDecoration = removeTextDecoration(newStyle.textDecoration as string, 'underline')
			break
		case '27':
			delete newStyle.filter
			break
		case '28':
			newStyle.visibility = 'visible'
			break
		case '29':
			newStyle.textDecoration = removeTextDecoration(newStyle.textDecoration as string, 'line-through')
			break
		// Foreground colors (standard)
		case '30':
			newStyle.color = '#333333' // black, slightly visible on dark bg
			break
		case '31':
			newStyle.color = '#F44336' // red
			break
		case '32':
			newStyle.color = '#4CAF50' // green
			break
		case '33':
			newStyle.color = '#FFEB3B' // yellow
			break
		case '34':
			newStyle.color = '#2196F3' // blue
			break
		case '35':
			newStyle.color = '#FF4081' // magenta
			break
		case '36':
			newStyle.color = '#00E5FF' // cyan
			break
		case '37':
			newStyle.color = '#FFFFFF' // white
			break
		case '39':
			newStyle.color = 'inherit' // default
			break
		// Bright foreground colors
		case '90':
			newStyle.color = '#9E9E9E' // bright black (gray)
			break
		case '91':
			newStyle.color = '#FF5252' // bright red
			break
		case '92':
			newStyle.color = '#69F0AE' // bright green
			break
		case '93':
			newStyle.color = '#FFD700' // bright yellow
			break
		case '94':
			newStyle.color = '#448AFF' // bright blue
			break
		case '95':
			newStyle.color = '#EA80FC' // bright magenta
			break
		case '96':
			newStyle.color = '#18FFFF' // bright cyan
			break
		case '97':
			newStyle.color = '#FFFFFF' // bright white
			break
		// Background colors (standard)
		case '40':
			newStyle.backgroundColor = '#333333' // black
			break
		case '41':
			newStyle.backgroundColor = '#F44336' // red
			break
		case '42':
			newStyle.backgroundColor = '#4CAF50' // green
			break
		case '43':
			newStyle.backgroundColor = '#FFEB3B' // yellow
			break
		case '44':
			newStyle.backgroundColor = '#2196F3' // blue
			break
		case '45':
			newStyle.backgroundColor = '#E91E63' // magenta
			break
		case '46':
			newStyle.backgroundColor = '#00E5FF' // cyan
			break
		case '47':
			newStyle.backgroundColor = '#FFFFFF' // white
			break
		case '49':
			newStyle.backgroundColor = 'inherit' // default
			break
		// Bright background colors
		case '100':
			newStyle.backgroundColor = '#9E9E9E' // bright black (gray)
			break
		case '101':
			newStyle.backgroundColor = '#FF5252' // bright red
			break
		case '102':
			newStyle.backgroundColor = '#69F0AE' // bright green
			break
		case '103':
			newStyle.backgroundColor = '#FFD700' // bright yellow
			break
		case '104':
			newStyle.backgroundColor = '#448AFF' // bright blue
			break
		case '105':
			newStyle.backgroundColor = '#EA80FC' // bright magenta
			break
		case '106':
			newStyle.backgroundColor = '#18FFFF' // bright cyan
			break
		case '107':
			newStyle.backgroundColor = '#FFFFFF' // bright white
			break
		default:
			// For unrecognized codes, do nothing
			break
	}

	return newStyle
}

/**
 * Parses an ANSI-coded string into segments with styles
 */
function parseAnsiToSegments(text: string): TextSegment[] {
	const segments: TextSegment[] = []
	let lastIndex = 0
	let currentStyle: React.CSSProperties = {}

	// Reset the regex lastIndex
	ANSI_PATTERN.lastIndex = 0
	let match: RegExpExecArray | null

	while ((match = ANSI_PATTERN.exec(text)) !== null) {
		// Add any plain text preceding the ANSI sequence
		if (match.index > lastIndex) {
			const plainText = text.slice(lastIndex, match.index)
			if (plainText) {
				segments.push({ text: plainText, style: { ...currentStyle } })
			}
		}

		// Process the ANSI sequence codes
		const codes = match[1].split(';')
		for (const code of codes) {
			currentStyle = updateStyle(currentStyle, code)
		}

		lastIndex = ANSI_PATTERN.lastIndex
	}

	// Add any trailing text
	if (lastIndex < text.length) {
		const trailingText = text.slice(lastIndex)
		if (trailingText) {
			segments.push({ text: trailingText, style: { ...currentStyle } })
		}
	}

	// If no segments were created (no ANSI codes), return the whole text as one segment
	if (segments.length === 0 && text) {
		segments.push({ text, style: {} })
	}

	return segments
}

interface AnsiTextProps {
	/** Text that may contain ANSI escape codes */
	text: string
	/** Additional className for the container */
	className?: string
}

/**
 * Renders text with ANSI escape codes as styled React elements.
 * Converts ANSI color codes to inline CSS styles.
 */
export function AnsiText({ text, className }: AnsiTextProps) {
	const segments = useMemo(() => parseAnsiToSegments(text), [text])

	// If there are no styles being applied, just return plain text
	const hasStyles = segments.some((s) => Object.keys(s.style).length > 0)
	if (!hasStyles) {
		return <span className={className}>{text}</span>
	}

	return (
		<span className={className}>
			{segments.map((segment, index) => {
				if (Object.keys(segment.style).length === 0) {
					return <span key={index}>{segment.text}</span>
				}
				return (
					<span key={index} style={segment.style}>
						{segment.text}
					</span>
				)
			})}
		</span>
	)
}
