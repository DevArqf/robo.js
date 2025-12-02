// CLI primitives for building standalone CLIs
export { Command } from './dist/cli/utils/cli-handler.js'
export { parseCliOptions, type ParseCliOptionsConfig } from './dist/cli/utils/cli-shared.js'
export { runSetupHook } from './dist/cli/utils/setup-hook.js'

// Type-safe config helper
export { createCliCommandConfig } from './dist/core/cli-config-helpers.js'

// Re-export CLI types
export type {
	CliAfterHook,
	CliBeforeHook,
	CliCommandConfig,
	CliCommandEntry,
	CliCommandModule,
	CliContext,
	CliExtendConfig,
	CliExtendModule,
	CliExtensionEntry,
	CliHandler,
	CliManifest,
	CliOptionConfig,
	CliOptionsFromConfig,
	CliOptionTypeMap,
	ExtractOptionName,
	LoadedCliCommand,
	LoadedCliExtension,
	SmartCliCommandConfig,
	ValueOfCliOption
} from './dist/types/cli.js'
