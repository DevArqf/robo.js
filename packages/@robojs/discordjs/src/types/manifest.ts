/**
 * Manifest metadata types for @robojs/discordjs
 *
 * Defines the structure of aggregated metadata stored in:
 * - metadata/discordjs.json (aggregated from all sources)
 * - metadata/raw/discordjs.{source}.json (per-source breakdown)
 */

import type { AggregatedMetadata } from 'robo.js'

/**
 * Aggregated Discord metadata with full traceability.
 * Combines requirements from project + plugins.
 */
export interface DiscordjsAggregatedMetadata extends AggregatedMetadata {
	namespace: 'discordjs'

	/**
	 * Required gateway intents.
	 */
	intents: {
		/** Intents that must be enabled */
		required: string[]
		/** Intents that are recommended but not required */
		optional: string[]
		/** Breakdown by source (project or plugin name) */
		bySource: Record<
			string,
			{
				inferred: string[]
				explicit: string[]
			}
		>
		/** Map of intent name to handler paths that require it */
		byHandler: Record<string, string[]>
	}

	/**
	 * Required bot permissions.
	 */
	permissions: {
		/** All permissions the bot needs */
		bot: string[]
		/** Breakdown by source */
		bySource: Record<string, string[]>
		/** Map of permission to handler paths that require it */
		byHandler: Record<string, string[]>
	}

	/**
	 * Required OAuth scopes.
	 */
	scopes: {
		/** Required scopes */
		required: string[]
		/** Optional scopes */
		optional: string[]
		/** Breakdown by source */
		bySource: Record<string, string[]>
	}

	/**
	 * Registration statistics.
	 */
	registration: {
		/** Slash command counts */
		commands: {
			total: number
			bySource: Record<string, number>
		}
		/** Context menu counts */
		contextMenus: {
			total: number
			bySource: Record<string, number>
		}
	}
}
