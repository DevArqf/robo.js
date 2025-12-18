/**
 * HMR Manifest Utilities
 *
 * Helper functions for incremental manifest updates during HMR.
 * Supports multiple: true routes (like events) where multiple handlers can share a key.
 */

import path from 'node:path'
import type { HmrMapping } from './hmr-mapper.js'

/**
 * Handler entry type for manifest entries.
 * Supports multiple handlers per key (for events with multiple: true).
 */
export interface ManifestEntry {
	id: string
	key: string
	path: string
	source: string
	plugin: string | null
	exports?: { default?: boolean; config?: boolean; named?: string[] }
	metadata?: Record<string, unknown>
	index?: number
}

/**
 * Convert an HmrMapping to its build path.
 * Used for matching entries by path instead of key.
 *
 * @param mapping - The HMR mapping to convert
 * @returns The build path (e.g., "events/messageCreate/chat.js")
 */
export function toBuildPath(mapping: HmrMapping): string {
	const relativePath = path
		.relative(mapping.sourceDir, mapping.filePath)
		.replace(/\.(ts|tsx|mts)$/, '.js')
	return path.join(mapping.route, relativePath).replace(/\\/g, '/')
}

/**
 * Reindex manifest entries to assign proper id and index values.
 * For routes with multiple handlers per key, entries get:
 * - id: "{key}:{globalIndex}" format
 * - index: global position in the array
 *
 * For routes with single handler per key:
 * - id: "{key}" format
 * - no index field
 *
 * @param entries - The manifest entries to reindex (modified in place)
 */
export function reindexEntries(entries: ManifestEntry[]): void {
	// Count entries per key to determine if multiple handlers share a key
	const keyCounts = new Map<string, number>()
	for (const entry of entries) {
		keyCounts.set(entry.key, (keyCounts.get(entry.key) ?? 0) + 1)
	}

	// Assign id and index based on whether key has multiple handlers
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i]
		const count = keyCounts.get(entry.key) ?? 1

		if (count > 1) {
			// Multiple handlers share this key: use indexed id format
			entry.id = `${entry.key}:${i}`
			entry.index = i
		} else {
			// Single handler for this key: simple id format
			entry.id = entry.key
			delete entry.index
		}
	}
}
