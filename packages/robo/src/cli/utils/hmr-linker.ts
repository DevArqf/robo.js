/**
 * HMR Linker
 *
 * Rewrites import specifiers in build output to include cache-busting query parameters.
 * This ensures that when utility files change, handlers get fresh copies of dependencies
 * instead of stale cached versions from Node's ESM loader.
 *
 * The linker adds `?robo_hmr=<version>` to relative import specifiers, causing Node
 * to treat them as different modules and fetch fresh code.
 */

import fs from 'node:fs'
import path from 'node:path'

export interface LinkOptions {
	/** Build mode (development, production, etc.) */
	mode: string
	/** HMR version (timestamp or counter) for cache busting */
	version: number | string
	/** Build-relative paths to rewrite (e.g., ['utils/format.js', 'events/ready.js']) */
	modules: string[]
}

export interface LinkResult {
	/** Whether linking completed without fatal errors */
	success: boolean
	/** Number of files that were rewritten */
	linkedCount: number
	/** Any errors encountered during linking */
	errors: string[]
}

type Quote = "'" | '"'

interface SpecifierRef {
	/** Index of the specifier content start (after the opening quote) */
	start: number
	/** Index of the specifier content end (before the closing quote) */
	end: number
	/** Raw specifier as written in source (no unescaping) */
	specifier: string
	/** Quote used for the string literal */
	quote: Quote
}

const KEYWORDS_ALLOWING_REGEX_START = new Set([
	'return',
	'throw',
	'case',
	'else',
	'do',
	'yield',
	'await',
	'typeof',
	'void',
	'delete',
	'new',
	'in',
	'instanceof'
])

function isWhitespace(ch: string): boolean {
	return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v'
}

function isIdentStart(ch: string): boolean {
	return (
		(ch >= 'A' && ch <= 'Z') ||
		(ch >= 'a' && ch <= 'z') ||
		ch === '_' ||
		ch === '$'
	)
}

function isIdentPart(ch: string): boolean {
	return isIdentStart(ch) || (ch >= '0' && ch <= '9')
}

function stripQueryAndHash(specifier: string): string {
	const beforeHash = specifier.split('#')[0]
	return beforeHash.split('?')[0]
}

function skipLineComment(content: string, start: number): number {
	let i = start + 2
	while (i < content.length && content[i] !== '\n') i++
	return i
}

function skipBlockComment(content: string, start: number): number {
	let i = start + 2
	while (i < content.length) {
		if (content[i] === '*' && content[i + 1] === '/') {
			return i + 2
		}
		i++
	}
	return content.length
}

function skipStringLiteral(content: string, start: number, quote: Quote): number {
	let i = start + 1
	while (i < content.length) {
		const ch = content[i]
		if (ch === '\\') {
			i += 2
			continue
		}
		if (ch === quote) {
			return i + 1
		}
		i++
	}
	return content.length
}

function skipRegexLiteral(content: string, start: number): number {
	let i = start + 1
	let inCharClass = false

	while (i < content.length) {
		const ch = content[i]
		if (ch === '\\') {
			i += 2
			continue
		}
		if (ch === '[') {
			inCharClass = true
			i++
			continue
		}
		if (ch === ']') {
			inCharClass = false
			i++
			continue
		}
		if (ch === '/' && !inCharClass) {
			i++ // consume closing slash
			break
		}
		i++
	}

	// Skip flags
	while (i < content.length && (content[i] >= 'a' && content[i] <= 'z')) {
		i++
	}

	return i
}

function skipJsExpression(content: string, start: number): number {
	let i = start
	let depth = 1
	let canStartRegex = true

	while (i < content.length && depth > 0) {
		const ch = content[i]
		const next = content[i + 1]

		if (isWhitespace(ch)) {
			i++
			continue
		}

		if (ch === '/' && next === '/') {
			i = skipLineComment(content, i)
			continue
		}
		if (ch === '/' && next === '*') {
			i = skipBlockComment(content, i)
			continue
		}

		if (ch === "'" || ch === '"') {
			i = skipStringLiteral(content, i, ch)
			canStartRegex = false
			continue
		}
		if (ch === '`') {
			i = skipTemplateLiteral(content, i)
			canStartRegex = false
			continue
		}

		if (ch === '/' && canStartRegex && next !== '/' && next !== '*') {
			i = skipRegexLiteral(content, i)
			canStartRegex = false
			continue
		}

		if (ch === '{') {
			depth++
			canStartRegex = true
			i++
			continue
		}
		if (ch === '}') {
			depth--
			canStartRegex = false
			i++
			continue
		}

		if (isIdentStart(ch)) {
			const startWord = i
			i++
			while (i < content.length && isIdentPart(content[i])) i++
			const word = content.slice(startWord, i)
			canStartRegex = KEYWORDS_ALLOWING_REGEX_START.has(word)
			continue
		}

		// Digits (numbers)
		if (ch >= '0' && ch <= '9') {
			i++
			while (i < content.length && /[0-9._]/.test(content[i])) i++
			canStartRegex = false
			continue
		}

		if (')]}'.includes(ch)) {
			canStartRegex = false
			i++
			continue
		}
		if ('([{,;:?'.includes(ch)) {
			canStartRegex = true
			i++
			continue
		}
		if ('=+-*%!~&|^<>'.includes(ch)) {
			canStartRegex = true
			i++
			continue
		}
		if (ch === '.') {
			canStartRegex = false
			i++
			continue
		}

		i++
	}

	return i
}

function skipTemplateLiteral(content: string, start: number): number {
	let i = start + 1
	while (i < content.length) {
		const ch = content[i]
		const next = content[i + 1]

		if (ch === '\\') {
			i += 2
			continue
		}
		if (ch === '`') {
			return i + 1
		}
		if (ch === '$' && next === '{') {
			// Skip expression inside ${ ... }
			i = skipJsExpression(content, i + 2)
			continue
		}
		i++
	}
	return content.length
}

/**
 * Check if an import specifier should be rewritten.
 *
 * Returns false for:
 * - Non-relative imports (shouldn't match regex anyway)
 * - Protocol imports (http://, https://, node:, etc.)
 * - Paths that would escape the build root via ../
 *
 * @param specifier - The import specifier (e.g., './utils/format.js')
 * @param currentDir - Directory of the file being processed (relative to build root)
 */
function shouldRewrite(specifier: string, currentDir: string): boolean {
	const clean = stripQueryAndHash(specifier)

	// Must be relative
	if (!clean.startsWith('./') && !clean.startsWith('../')) {
		return false
	}

	// Skip protocol imports (shouldn't appear in relative, but be safe)
	if (clean.includes('://')) {
		return false
	}

	// Resolve and check if it stays within build directory
	// If the resolved path starts with '..', it escapes the build root
	const resolved = path.posix.normalize(path.posix.join(currentDir, clean))
	if (resolved.startsWith('..')) {
		return false
	}

	return true
}

function rewriteSpecifier(specifier: string, version: string): string {
	const [beforeHash, hashPart = ''] = specifier.split('#')
	const hashSuffix = hashPart ? `#${hashPart}` : ''

	const [base, queryPart = ''] = beforeHash.split('?')

	if (!queryPart) {
		return `${base}?robo_hmr=${version}${hashSuffix}`
	}

	const params = queryPart.split('&').filter(Boolean)
	let found = false
	const updated = params.map((p) => {
		if (p === 'robo_hmr' || p.startsWith('robo_hmr=')) {
			found = true
			return `robo_hmr=${version}`
		}
		return p
	})

	if (!found) {
		updated.push(`robo_hmr=${version}`)
	}

	return `${base}?${updated.join('&')}${hashSuffix}`
}

function parseStringAt(content: string, start: number): { ref: SpecifierRef; endIndex: number } | null {
	const quote = content[start]
	if (quote !== "'" && quote !== '"') return null

	const endIndex = skipStringLiteral(content, start, quote)
	if (endIndex <= start + 1) return null

	const endQuoteIndex = endIndex - 1
	const specifier = content.slice(start + 1, endQuoteIndex)

	return {
		ref: { start: start + 1, end: endQuoteIndex, specifier, quote },
		endIndex
	}
}

function skipSpacesAndComments(content: string, start: number): number {
	let i = start
	while (i < content.length) {
		const ch = content[i]
		const next = content[i + 1]

		if (isWhitespace(ch)) {
			i++
			continue
		}
		if (ch === '/' && next === '/') {
			i = skipLineComment(content, i)
			continue
		}
		if (ch === '/' && next === '*') {
			i = skipBlockComment(content, i)
			continue
		}
		break
	}
	return i
}

function collectSpecifierAfterFromKeyword(content: string, start: number): SpecifierRef | null {
	let i = start

	while (i < content.length) {
		i = skipSpacesAndComments(content, i)
		if (i >= content.length) break

		const ch = content[i]
		const next = content[i + 1]

		if (ch === ';') return null

		// Look for "from" keyword followed by a string literal
		if (isIdentStart(ch)) {
			const wordStart = i
			i++
			while (i < content.length && isIdentPart(content[i])) i++
			const word = content.slice(wordStart, i)

			if (word === 'from') {
				const afterFrom = skipSpacesAndComments(content, i)
				const parsed = parseStringAt(content, afterFrom)
				if (parsed) {
					return parsed.ref
				}
			}

			continue
		}

		// Skip string/template literals within the statement (e.g. import attributes)
		if (ch === "'" || ch === '"') {
			i = skipStringLiteral(content, i, ch)
			continue
		}
		if (ch === '`') {
			i = skipTemplateLiteral(content, i)
			continue
		}

		// Skip comments inside the statement
		if (ch === '/' && next === '/') {
			i = skipLineComment(content, i)
			continue
		}
		if (ch === '/' && next === '*') {
			i = skipBlockComment(content, i)
			continue
		}

		i++
	}

	return null
}

function collectModuleSpecifiers(content: string): SpecifierRef[] {
	const refs: SpecifierRef[] = []
	let i = 0
	let canStartRegex = true

	while (i < content.length) {
		const ch = content[i]
		const next = content[i + 1]

		if (isWhitespace(ch)) {
			i++
			continue
		}

		if (ch === '/' && next === '/') {
			i = skipLineComment(content, i)
			continue
		}
		if (ch === '/' && next === '*') {
			i = skipBlockComment(content, i)
			continue
		}

		if (ch === "'" || ch === '"') {
			i = skipStringLiteral(content, i, ch)
			canStartRegex = false
			continue
		}
		if (ch === '`') {
			i = skipTemplateLiteral(content, i)
			canStartRegex = false
			continue
		}

		if (ch === '/' && canStartRegex && next !== '/' && next !== '*') {
			i = skipRegexLiteral(content, i)
			canStartRegex = false
			continue
		}

		if (isIdentStart(ch)) {
			const wordStart = i
			i++
			while (i < content.length && isIdentPart(content[i])) i++
			const word = content.slice(wordStart, i)

			// Adjust regex-start heuristic for certain keywords
			canStartRegex = KEYWORDS_ALLOWING_REGEX_START.has(word)

			if (word !== 'import' && word !== 'export') {
				continue
			}

			// Parse import/export module specifier strings
			let cursor = skipSpacesAndComments(content, i)
			if (cursor >= content.length) continue

			// Ignore import.meta
			if (word === 'import' && content[cursor] === '.') {
				continue
			}

			// import('...') dynamic
			if (word === 'import' && content[cursor] === '(') {
				cursor = skipSpacesAndComments(content, cursor + 1)
				const parsed = parseStringAt(content, cursor)
				if (parsed) {
					refs.push(parsed.ref)
					i = parsed.endIndex
					continue
				}
				continue
			}

			// import '...'
			if (word === 'import' && (content[cursor] === "'" || content[cursor] === '"')) {
				const parsed = parseStringAt(content, cursor)
				if (parsed) {
					refs.push(parsed.ref)
					i = parsed.endIndex
					continue
				}
				continue
			}

			// import ... from '...' OR export ... from '...'
			const fromRef = collectSpecifierAfterFromKeyword(content, cursor)
			if (fromRef) {
				refs.push(fromRef)
			}

			continue
		}

		// Numbers (rough skip)
		if (ch >= '0' && ch <= '9') {
			i++
			while (i < content.length && /[0-9._]/.test(content[i])) i++
			canStartRegex = false
			continue
		}

		if (')]}'.includes(ch)) {
			canStartRegex = false
			i++
			continue
		}
		if ('([{,;:?'.includes(ch)) {
			canStartRegex = true
			i++
			continue
		}
		if ('=+-*%!~&|^<>'.includes(ch)) {
			canStartRegex = true
			i++
			continue
		}
		if (ch === '.') {
			canStartRegex = false
			i++
			continue
		}

		i++
	}

	return refs
}

/**
 * Rewrite import specifiers in file content to include HMR cache buster.
 *
 * @param content - The file content to rewrite
 * @param version - The HMR version to add
 * @param currentDir - Directory of the file being processed (relative to build root)
 * @returns The rewritten content
 */
function rewriteImports(content: string, version: string, currentDir: string): string {
	const refs = collectModuleSpecifiers(content)
	if (refs.length === 0) return content

	const ops: Array<{ start: number; end: number; replacement: string }> = []
	for (const ref of refs) {
		if (!shouldRewrite(ref.specifier, currentDir)) continue
		const updated = rewriteSpecifier(ref.specifier, version)
		if (updated === ref.specifier) continue
		ops.push({ start: ref.start, end: ref.end, replacement: updated })
	}

	if (ops.length === 0) return content

	ops.sort((a, b) => a.start - b.start)

	let out = ''
	let last = 0
	for (const op of ops) {
		out += content.slice(last, op.start) + op.replacement
		last = op.end
	}
	out += content.slice(last)
	return out
}

/**
 * Link modules by rewriting their import specifiers to include cache-busting query parameters.
 *
 * This function processes the specified build output files and rewrites all relative
 * import specifiers to include `?robo_hmr=<version>`. This ensures that when Node's
 * ESM loader imports these files, it treats the dependencies as new modules and
 * fetches fresh code instead of returning cached versions.
 *
 * @param options - Link options including mode, version, and modules to process
 * @returns LinkResult with success status, count of linked files, and any errors
 */
export async function linkModules(options: LinkOptions): Promise<LinkResult> {
	const { mode, version, modules } = options
	const buildRoot = path.join(process.cwd(), '.robo', 'build', mode)

	const result: LinkResult = {
		success: true,
		linkedCount: 0,
		errors: []
	}

	// Validate build directory exists
	if (!fs.existsSync(buildRoot)) {
		result.success = false
		result.errors.push(`Build directory not found: ${buildRoot}`)
		return result
	}

	// Process each module
	for (const modulePath of modules) {
		const fullPath = path.join(buildRoot, modulePath)

		try {
			// Skip if file doesn't exist (might have been deleted)
			if (!fs.existsSync(fullPath)) {
				continue
			}

			// Only process JavaScript files
			if (!modulePath.endsWith('.js') && !modulePath.endsWith('.mjs')) {
				continue
			}

			const content = await fs.promises.readFile(fullPath, 'utf-8')
			const currentDir = path.posix.dirname(modulePath)

			const rewritten = rewriteImports(content, String(version), currentDir)

			// Only write if changed
			if (rewritten !== content) {
				await fs.promises.writeFile(fullPath, rewritten, 'utf-8')
				result.linkedCount++
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			result.errors.push(`Failed to link ${modulePath}: ${errorMessage}`)
			// Continue processing other files - don't fail the whole operation
		}
	}

	return result
}

/**
 * Check if a string contains relative imports that would be rewritten.
 * Useful for testing or pre-checking files before linking.
 */
export function hasRelativeImports(content: string): boolean {
	for (const ref of collectModuleSpecifiers(content)) {
		const clean = stripQueryAndHash(ref.specifier)
		if (clean.startsWith('./') || clean.startsWith('../')) {
			return true
		}
	}
	return false
}
