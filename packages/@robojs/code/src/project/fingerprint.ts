/**
 * Fingerprint computation for project drift detection
 *
 * Produces stable content-based fingerprints for detecting changes
 * in project files. Works in both browser and Node environments.
 */

import { INDEX_CAPS } from './caps.js'

/**
 * File data used for fingerprint computation
 */
export interface FileFingerprint {
	path: string
	size: number
	mtimeMs?: number
	contentHash?: string
}

/**
 * Simple but effective hash function for strings (djb2 variant)
 * Works in both browser and Node without crypto dependencies
 */
function hashString(str: string): string {
	let hash = 5381
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0
	}
	return hash.toString(16).padStart(8, '0')
}

/**
 * Hash content to produce a content fingerprint
 * Uses multiple passes for better distribution
 */
export function hashContent(content: string): string {
	// Use multiple hash values for better collision resistance
	let h1 = 5381
	let h2 = 0x811c9dc5 // FNV offset basis

	for (let i = 0; i < content.length; i++) {
		const c = content.charCodeAt(i)
		// djb2
		h1 = ((h1 << 5) + h1 + c) >>> 0
		// FNV-1a
		h2 = ((h2 ^ c) * 0x01000193) >>> 0
	}

	return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/**
 * Compute a stable fingerprint for a set of files
 *
 * Files are sorted by path for stability. Each file contributes:
 * - path
 * - size
 * - contentHash (if provided) or mtimeMs (for large files)
 *
 * @param files - Array of file fingerprint data
 * @returns Stable fingerprint string
 */
export function computeFingerprint(files: FileFingerprint[]): string {
	if (files.length === 0) {
		return hashString('empty-project')
	}

	// Sort by path for stability
	const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))

	// Build fingerprint data string
	const parts: string[] = []
	for (const file of sorted) {
		// Include path and size always
		let entry = `${file.path}:${file.size}`

		// Include content hash if available, otherwise mtime
		if (file.contentHash) {
			entry += `:${file.contentHash}`
		} else if (file.mtimeMs !== undefined) {
			entry += `:m${file.mtimeMs}`
		}

		parts.push(entry)
	}

	// Combine all parts and hash
	const combined = parts.join('\n')
	return hashContent(combined)
}

/**
 * Compute a fingerprint for a single file's content
 *
 * For small files, compute full content hash.
 * For large files (>threshold), use size+mtime placeholder.
 *
 * @param path - File path
 * @param content - File content (or null for large files)
 * @param size - File size in bytes
 * @param mtimeMs - File modification time (optional)
 * @param threshold - Size threshold for content hashing (default from caps)
 * @returns FileFingerprint data
 */
export function computeFileFingerprint(
	path: string,
	content: string | null,
	size: number,
	mtimeMs?: number,
	threshold: number = INDEX_CAPS.largeFileThreshold
): FileFingerprint {
	const result: FileFingerprint = { path, size, mtimeMs }

	if (content !== null && size <= threshold) {
		result.contentHash = hashContent(content)
	}

	return result
}

/**
 * Check if a fingerprint has changed
 *
 * @param oldFingerprint - Previous fingerprint
 * @param newFingerprint - New fingerprint
 * @returns true if fingerprints differ (drift detected)
 */
export function hasFingerprintChanged(oldFingerprint: string, newFingerprint: string): boolean {
	return oldFingerprint !== newFingerprint
}

/**
 * Create a quick fingerprint from file paths and sizes only
 * Useful for fast dirty checks before full content scan
 *
 * @param files - Array of file info with path and size
 * @returns Quick fingerprint string
 */
export function computeQuickFingerprint(files: Array<{ path: string; size: number }>): string {
	if (files.length === 0) {
		return hashString('empty-project-quick')
	}

	const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path))
	const combined = sorted.map((f) => `${f.path}:${f.size}`).join('\n')
	return 'q-' + hashContent(combined)
}
