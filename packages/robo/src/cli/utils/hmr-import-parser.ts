/**
 * HMR Import Parser
 *
 * Lightweight regex-based import parser for dependency graph building.
 * No external dependencies - uses only built-in regex capabilities.
 *
 * Parses build output (.js files) to extract import specifiers for:
 * - Static imports: import ... from 'specifier'
 * - Re-exports: export ... from 'specifier'
 * - Dynamic imports: import('specifier') with literal strings
 *
 * Skips non-local dependencies:
 * - Node built-ins (node:*)
 * - HTTP/HTTPS imports
 * - Bare package specifiers (npm packages)
 * - Unresolved path aliases (@/, ~/)
 */

export interface ParsedImport {
	/** The import specifier string (e.g., './utils/format.js' or 'discord.js') */
	specifier: string
	/** Whether this is a static or dynamic import */
	type: 'static' | 'dynamic'
	/** Whether this is a relative import (./ or ../) that we should track */
	isRelative: boolean
}

export interface ParseResult {
	/** All extracted imports */
	imports: ParsedImport[]
	/** Whether this module has dynamic imports with non-literal specifiers */
	hasUnresolvedDynamic: boolean
}

/**
 * Regex pattern for static imports and re-exports.
 *
 * Matches:
 * - import ... from 'specifier'
 * - import 'specifier'
 * - export ... from 'specifier'
 *
 * Handles imports that appear:
 * - At the start of the file
 * - After newlines, semicolons
 * - After multi-line comment endings - build tools may place imports on same line as comment end
 *
 * Captures the specifier string (group 1).
 */
const STATIC_IMPORT = /(?:^|[\n;]|\*\/)\s*(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g

/**
 * Regex pattern for dynamic imports with literal string specifiers.
 *
 * Matches:
 * - import('specifier')
 * - import("specifier")
 *
 * Captures the specifier string (group 1).
 */
const DYNAMIC_IMPORT_LITERAL = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Regex pattern to detect dynamic imports with non-literal specifiers.
 *
 * Matches:
 * - import(variable)
 * - import(expression)
 *
 * Used to flag modules that have unresolved dynamic imports.
 */
const DYNAMIC_IMPORT_EXPR = /\bimport\s*\(\s*(?!['"])/g

/**
 * Check if a specifier is a relative import that we should track.
 * Returns true only for ./ and ../ imports.
 *
 * Skips:
 * - Node built-ins (node:*)
 * - HTTP/HTTPS imports (Deno-style)
 * - Unresolved path aliases (@/, ~/)
 * - Bare package specifiers (npm packages)
 */
export function isRelativeSpecifier(specifier: string): boolean {
	// Skip node built-ins
	if (specifier.startsWith('node:')) {
		return false
	}

	// Skip HTTP/HTTPS imports (Deno-style)
	if (specifier.startsWith('http://') || specifier.startsWith('https://')) {
		return false
	}

	// Skip unresolved path aliases (shouldn't appear in build output, but handle gracefully)
	if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
		return false
	}

	// Only track relative imports
	return specifier.startsWith('./') || specifier.startsWith('../')
}

/**
 * Parse a JavaScript/TypeScript file content and extract all import specifiers.
 *
 * @param content - The file content to parse
 * @returns ParseResult with extracted imports and unresolved dynamic import flag
 */
export function parseImports(content: string): ParseResult {
	const imports: ParsedImport[] = []
	let hasUnresolvedDynamic = false

	// Track seen specifiers to avoid duplicates
	const seen = new Set<string>()

	// Extract static imports and re-exports
	for (const match of content.matchAll(STATIC_IMPORT)) {
		const specifier = match[1]
		const key = `static:${specifier}`

		if (!seen.has(key)) {
			seen.add(key)
			imports.push({
				specifier,
				type: 'static',
				isRelative: isRelativeSpecifier(specifier)
			})
		}
	}

	// Extract dynamic imports with literal strings
	for (const match of content.matchAll(DYNAMIC_IMPORT_LITERAL)) {
		const specifier = match[1]
		const key = `dynamic:${specifier}`

		if (!seen.has(key)) {
			seen.add(key)
			imports.push({
				specifier,
				type: 'dynamic',
				isRelative: isRelativeSpecifier(specifier)
			})
		}
	}

	// Check for unresolved dynamic imports (variable specifiers)
	// Reset regex lastIndex since we're using test() after matchAll()
	DYNAMIC_IMPORT_EXPR.lastIndex = 0
	if (DYNAMIC_IMPORT_EXPR.test(content)) {
		hasUnresolvedDynamic = true
	}

	return { imports, hasUnresolvedDynamic }
}

/**
 * Get only the relative imports from a parse result.
 * Convenience function for dependency graph building.
 */
export function getRelativeImports(result: ParseResult): ParsedImport[] {
	return result.imports.filter((imp) => imp.isRelative)
}
