/**
 * @robojs/cli
 *
 * A Robo.js plugin that enables projects to create standalone CLIs.
 * Define commands in src/robo/cli/commands/ and this plugin generates
 * an executable entry point during build.
 *
 * The build/complete.ts hook runs after Robo builds and generates
 * .robo/build/cli.js from the CLI manifest entries.
 */

// Re-export CLI primitives from robo.js for convenience
export { Command, parseCliOptions } from 'robo.js/cli.js'
export type {
	CliCommandConfig,
	CliContext,
	CliHandler,
	CliOptionConfig,
	ParseCliOptionsConfig
} from 'robo.js/cli.js'
