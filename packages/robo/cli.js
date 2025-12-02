// CLI primitives for building standalone CLIs
export { Command } from './dist/cli/utils/cli-handler.js'
export { parseCliOptions } from './dist/cli/utils/cli-shared.js'
export { runSetupHook } from './dist/cli/utils/setup-hook.js'

// Re-export types at runtime (for type-checking with JSDoc)
export {}
