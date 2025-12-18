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

/**
 * Regex to match import/export specifiers that should be rewritten.
 *
 * Matches:
 * - import ... from './...'
 * - import ... from '../...'
 * - export ... from './...'
 * - export ... from '../...'
 * - import('./...')
 * - import('../...')
 *
 * Captures:
 * - Group 1: Context (import/from/import()
 * - Group 2: Quote type (' or ")
 * - Group 3: Specifier path (without query string)
 * - Group 4: Existing query string including ? (if any)
 *
 * The regex handles:
 * - Static imports: import x from './y.js'
 * - Named imports: import { a, b } from './y.js'
 * - Default + named: import x, { a } from './y.js'
 * - Side-effect imports: import './y.js'
 * - Re-exports: export { x } from './y.js'
 * - Dynamic imports: import('./y.js')
 */
const IMPORT_SPECIFIER_REGEX =
	/(import\s+(?:[\s\S]*?\s+from\s+)?|from\s+|export\s+(?:[\s\S]*?\s+from\s+)?|import\s*\(\s*)(['"])(\.\.?\/[^'"?#\n]*)(\?[^'"#\n]*)?\2/g

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
	// Must be relative
	if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
		return false
	}

	// Skip protocol imports (shouldn't appear in relative, but be safe)
	if (specifier.includes('://')) {
		return false
	}

	// Resolve and check if it stays within build directory
	// If the resolved path starts with '..', it escapes the build root
	const resolved = path.posix.normalize(path.posix.join(currentDir, specifier))
	if (resolved.startsWith('..')) {
		return false
	}

	return true
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
	return content.replace(
		IMPORT_SPECIFIER_REGEX,
		(match, context: string, quote: string, specifier: string, existingQuery: string | undefined) => {
			// Verify this is a local import that should be rewritten
			if (!shouldRewrite(specifier, currentDir)) {
				return match
			}

			// Handle existing query string
			let newQuery: string
			if (existingQuery) {
				// Check if robo_hmr already exists
				if (existingQuery.includes('robo_hmr=')) {
					// Replace existing robo_hmr value
					newQuery = existingQuery.replace(/robo_hmr=[^&'"]*/, `robo_hmr=${version}`)
				} else {
					// Append to existing query string
					newQuery = existingQuery + `&robo_hmr=${version}`
				}
			} else {
				// Add new query string
				newQuery = `?robo_hmr=${version}`
			}

			return `${context}${quote}${specifier}${newQuery}${quote}`
		}
	)
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
	// Reset regex state
	IMPORT_SPECIFIER_REGEX.lastIndex = 0
	return IMPORT_SPECIFIER_REGEX.test(content)
}
