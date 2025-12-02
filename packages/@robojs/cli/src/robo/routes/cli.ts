/**
 * Route definition for CLI commands.
 * Directory inferred from filename: /src/cli/
 */
import type { PortalAPI, RouteConfig, ScannedEntry, ProcessedEntry } from 'robo.js'
import type { CliCommandConfig, CliHandler } from 'robo.js/cli.js'

/**
 * Handler type for data access (portal.cli.cli)
 */
export type Handler = CliHandler

/**
 * Controller type - not needed for CLI commands
 */
export type Controller = null

/**
 * Namespace controller factory for portal access.
 * Provides get, list methods for all CLI commands.
 */
export const NamespaceController = (portal: PortalAPI) => ({
	async get(name: string): Promise<CliHandler | null> {
		try {
			const handler = await portal.getHandler('cli', 'cli', name)
			return (handler as { default?: CliHandler })?.default ?? null
		} catch {
			return null
		}
	},

	list(): string[] {
		const portalApi = portal as unknown as { getByType: (type: string) => Record<string, unknown> }
		const cliData = portalApi.getByType('cli:cli')
		return Object.keys(cliData)
	}
})

/**
 * Route configuration - how to scan and process files.
 */
export const config: RouteConfig = {
	key: {
		style: 'filepath',
		separator: ' ' // config/set.ts → "config set"
	},
	nesting: {
		maxDepth: 3,
		allowIndex: false
	},
	exports: {
		named: [],
		default: 'required',
		config: 'optional'
	},
	description: 'CLI commands'
}

/**
 * Process each scanned CLI command entry.
 */
export default function (entry: ScannedEntry): ProcessedEntry {
	const handlerConfig = entry.exports.config as CliCommandConfig | undefined

	// Determine command hierarchy
	const keyParts = entry.key.split(' ')
	const isSubcommand = keyParts.length > 1
	const parent = isSubcommand ? keyParts.slice(0, -1).join(' ') : undefined

	return {
		key: entry.key,
		path: entry.filePath.replace(/\.ts$/, '.js'),
		exports: {
			default: 'default' in entry.exports,
			config: 'config' in entry.exports,
			named: Object.keys(entry.exports).filter((k) => !['default', 'config'].includes(k))
		},
		metadata: {
			description: handlerConfig?.description ?? '',
			options: handlerConfig?.options ?? [],
			positionalArgs: handlerConfig?.positionalArgs ?? false
		},
		extra: isSubcommand ? { parent } : undefined
	}
}
