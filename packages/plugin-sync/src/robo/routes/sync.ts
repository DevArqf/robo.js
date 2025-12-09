/**
 * Route definition for sync handlers.
 * Directory inferred from filename: /src/sync/
 *
 * Sync handlers provide server-side validation, transformation, and RPC
 * capabilities for @robojs/sync state management.
 */
import type { RouteConfig, ScannedEntry, ProcessedEntry, PortalAPI, HandlerRecord } from 'robo.js'
import { registerHandler, registerMiddleware } from '../../server/handlers.js'
import type { SyncHandlerModule, SyncMiddlewareModule, SyncHandlerRecord, SyncMiddlewareRecord } from '../../server/types.js'

/**
 * Reserved export names that are not RPC methods.
 */
const RESERVED_EXPORTS = ['schema', 'validate', 'transform', 'onUpdate', 'before', 'after', 'default', 'config']

/**
 * Sync handler module type.
 */
export type Handler = SyncHandlerModule

/**
 * Controller for sync handler access.
 */
export interface SyncController {
	key: string
	getHandler: () => SyncHandlerModule | null
}

/**
 * Controller factory for runtime (per-handler).
 */
export function controller(key: string, record: HandlerRecord, _pluginState: unknown): SyncController {
	return {
		key,
		getHandler() {
			return record.handler as SyncHandlerModule | null
		}
	}
}

/**
 * Namespace controller for portal.sync.syncs.
 */
export interface SyncNamespaceController {
	get(key: string): Promise<SyncHandlerModule | null>
	list(): string[]
}

/**
 * Namespace controller factory for portal access.
 */
export const NamespaceController = (portal: PortalAPI): SyncNamespaceController => ({
	async get(key: string): Promise<SyncHandlerModule | null> {
		try {
			const handler = await portal.getHandler('sync', 'sync', key)
			return handler as SyncHandlerModule | null
		} catch {
			return null
		}
	},

	list(): string[] {
		const portalApi = portal as unknown as { getByType: (type: string) => Record<string, unknown> }
		const syncData = portalApi.getByType('sync:sync')
		return Object.keys(syncData)
	}
})

/**
 * Initialize sync handlers from loaded manifest entries.
 * Called during plugin startup.
 */
export async function initializeSyncHandlers(portal: PortalAPI): Promise<void> {
	const portalApi = portal as unknown as {
		getByType: (type: string) => Record<string, HandlerRecord>
		importRecord: (record: HandlerRecord) => Promise<void>
	}
	const syncData = portalApi.getByType('sync:sync')

	for (const [key, record] of Object.entries(syncData)) {
		// Check if this is a middleware file (supports both 'middleware' and '_middleware' naming)
		const isMiddleware = key.endsWith('/middleware') || key === 'middleware' ||
		                     key.endsWith('/_middleware') || key === '_middleware'

		// Pre-import the handler module using portal (handles path resolution)
		try {
			await portalApi.importRecord(record)
		} catch (error) {
			// Log but continue - handler can be loaded lazily later if needed
			console.warn(`Failed to pre-import sync handler: ${key}`, error)
			continue
		}

		if (isMiddleware) {
			const middlewareRecord: SyncMiddlewareRecord = {
				path: key,
				exports: {
					before: record.exports.named?.includes('before'),
					after: record.exports.named?.includes('after')
				},
				// Store pre-loaded handler reference from portal
				handler: record.handler as SyncMiddlewareModule
			}
			// Middleware path is the directory it applies to
			const dirPath = key.replace(/\/(middleware|_middleware)$/, '').replace(/^(middleware|_middleware)$/, '')
			registerMiddleware({ ...middlewareRecord, path: dirPath || '' })
		} else {
			// Regular handler - extract dynamic params from metadata if available
			const metadata = record.metadata as Record<string, unknown> | undefined
			const params = (metadata?.params as string[]) || undefined

			const handlerRecord: SyncHandlerRecord = {
				key,
				path: record.path,
				exports: {
					schema: record.exports.named?.includes('schema'),
					validate: record.exports.named?.includes('validate'),
					transform: record.exports.named?.includes('transform'),
					onUpdate: record.exports.named?.includes('onUpdate'),
					named: (record.exports.named || []).filter((e) => !RESERVED_EXPORTS.includes(e))
				},
				params,
				// Store pre-loaded handler reference from portal
				handler: record.handler as SyncHandlerModule
			}
			registerHandler(handlerRecord)
		}
	}
}

/**
 * Route configuration - how to scan and process files.
 */
export const config: RouteConfig = {
	key: {
		style: 'filepath',
		separator: '/' // game/[roomId]/position.ts → "game/[roomId]/position"
	},
	nesting: {
		maxDepth: 10,
		allowIndex: true, // index.ts → ""
		dynamicSegment: /\[([^\]]+)\]/, // [param] → :param
		catchAllSegment: /\[\.\.\.\w+\]/, // [...path] → *
		optionalCatchAll: /\[\[\.\.\.(\w+)\]\]/ // [[...path]] → *?
	},
	exports: {
		// All exports we care about
		named: ['schema', 'validate', 'transform', 'onUpdate', 'before', 'after'],
		default: 'optional',
		config: 'optional'
	},
	description: 'Sync state handlers'
}

/**
 * Process each scanned sync handler entry.
 */
export default function (entry: ScannedEntry): ProcessedEntry {
	// Detect if this is a middleware file (supports both 'middleware' and '_middleware' naming)
	const isMiddleware = entry.key.endsWith('/middleware') || entry.key === 'middleware' ||
	                     entry.key.endsWith('/_middleware') || entry.key === '_middleware'

	// Get all exports (including RPC methods which are any function exports)
	const allExports = Object.keys(entry.exports).filter((k) => k !== 'default' && k !== 'config')

	// Separate reserved from RPC exports
	const reservedExports = allExports.filter((e) => RESERVED_EXPORTS.includes(e))
	const rpcExports = allExports.filter((e) => !RESERVED_EXPORTS.includes(e))

	return {
		key: entry.key,
		path: entry.filePath.replace(/\.ts$/, '.js'),
		exports: {
			default: 'default' in entry.exports,
			config: 'config' in entry.exports,
			named: [...reservedExports, ...rpcExports]
		},
		metadata: {
			isMiddleware,
			reservedExports,
			rpcExports
		},
		extra: entry.dynamicSegments
			? {
					params: entry.dynamicSegments.params,
					...(entry.dynamicSegments.catchAll && { catchAll: entry.dynamicSegments.catchAll })
				}
			: undefined
	}
}
