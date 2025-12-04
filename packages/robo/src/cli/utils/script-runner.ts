/**
 * Script Runner
 *
 * Executes scripts with environment variables loaded.
 * Supports TypeScript natively (Node 22.6+) and watch mode.
 */

import { spawn, ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import Watcher from './watcher.js'
import { logger as createLogger } from '../../core/logger.js'
import { color } from '../../core/color.js'
import { IS_WINDOWS } from './utils.js'

interface RunScriptOptions {
	scriptPath: string
	args: string[]
	watch?: boolean
	verbose?: boolean
}

interface ParsedArgs {
	mode: 'script' | 'eval' | 'command' | 'robo'
	scriptPath?: string
	scriptArgs?: string[]
	code?: string
	command?: string[]
	watch?: boolean
	verbose?: boolean
}

const SCRIPT_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/

/**
 * Check if an argument looks like a script file.
 */
export function isScriptFile(arg: string): boolean {
	return SCRIPT_EXTENSIONS.test(arg)
}

/**
 * Parse command line arguments to determine execution mode.
 */
export function parseScriptArgs(argv: string[]): ParsedArgs {
	const args = argv.slice(2)

	// Flags that robox consumes (must come before script)
	let watch = false
	let verbose = false
	let evalCode: string | null = null

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		if (arg === '-w' || arg === '--watch') {
			watch = true
		} else if (arg === '-v' || arg === '--verbose') {
			verbose = true
		} else if (arg === '-e' && args[i + 1]) {
			evalCode = args[++i]
		} else if (arg === '--') {
			// Explicit command mode: robox -- npm start
			return { mode: 'command', command: args.slice(i + 1), watch, verbose }
		} else if (!arg.startsWith('-')) {
			// First non-flag arg
			if (isScriptFile(arg)) {
				// Script mode: robox script.ts --dry-run
				return {
					mode: 'script',
					scriptPath: arg,
					scriptArgs: args.slice(i + 1), // Everything after script
					watch,
					verbose
				}
			} else {
				// Not a file → robo command
				return { mode: 'robo', command: args.slice(i), watch, verbose }
			}
		}
	}

	if (evalCode) {
		return { mode: 'eval', code: evalCode, watch, verbose }
	}

	// No script or command found - pass everything to robo
	return { mode: 'robo', command: args, watch, verbose }
}

/**
 * Check if the current Node version supports native TypeScript execution.
 * Returns { supported: boolean, flags: string[] }
 */
export function getTypeScriptSupport(): { supported: boolean; flags: string[] } {
	const [major, minor] = process.versions.node.split('.').map(Number)

	// Node 23+ has full TypeScript support
	if (major >= 23) {
		return {
			supported: true,
			flags: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
		}
	}

	// Node 22.7+ supports enums/namespaces
	if (major === 22 && minor >= 7) {
		return {
			supported: true,
			flags: [
				'--experimental-strip-types',
				'--experimental-transform-types',
				'--disable-warning=ExperimentalWarning'
			]
		}
	}

	// Node 22.6+ has basic TypeScript support
	if (major === 22 && minor >= 6) {
		return {
			supported: true,
			flags: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning']
		}
	}

	// Not supported
	return { supported: false, flags: [] }
}

/**
 * Prompt the user with a yes/no question.
 */
function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})

	return new Promise((resolve) => {
		rl.question(question, (input) => {
			rl.close()
			resolve(input)
		})
	})
}

/**
 * Check TypeScript support and prompt user if not available.
 * Returns true if TypeScript can be executed, false otherwise.
 */
async function ensureTypeScriptSupport(logger: ReturnType<typeof createLogger>): Promise<boolean> {
	const tsSupport = getTypeScriptSupport()

	if (tsSupport.supported) {
		return true
	}

	// TypeScript not supported - prompt user
	const nodeVersion = process.versions.node
	logger.error(`TypeScript execution requires Node 22.6 or higher`)
	logger.info('')
	logger.info(`Current version: ${color.bold(nodeVersion)}`)
	logger.info(`Required: ${color.bold('22.6+')} (recommended: ${color.bold('23+')} for full support)`)
	logger.info('')
	logger.info('To upgrade Node.js:')
	logger.info(`  ${color.dim('# Using nvm')}`)
	logger.info(`  nvm install 22`)
	logger.info(`  nvm use 22`)
	logger.info('')
	logger.info(`  ${color.dim('# Or download from')}`)
	logger.info(`  https://nodejs.org/`)
	logger.info('')

	// Ask if they want to continue with JS only
	const answer = await prompt('Continue with JavaScript files only? [y/N]: ')

	return answer.toLowerCase() === 'y'
}

/**
 * Build Node.js arguments for running a script.
 */
function buildNodeArgs(scriptPath: string, isTypeScript: boolean): string[] {
	const nodeArgs: string[] = []

	if (isTypeScript) {
		const tsSupport = getTypeScriptSupport()
		nodeArgs.push(...tsSupport.flags)
	}

	nodeArgs.push(scriptPath)
	return nodeArgs
}

/**
 * Run a script once without watching.
 */
async function runOnce(
	scriptPath: string,
	args: string[],
	isTypeScript: boolean,
	logger: ReturnType<typeof createLogger>
): Promise<number> {
	const nodeArgs = buildNodeArgs(scriptPath, isTypeScript)

	logger.debug(color.bold(`> node ${nodeArgs.join(' ')} ${args.join(' ')}`))

	return new Promise((resolve) => {
		const child = spawn('node', [...nodeArgs, ...args], {
			stdio: 'inherit',
			shell: IS_WINDOWS
		})

		child.on('close', (code) => resolve(code ?? 0))
	})
}

/**
 * Run a script with file watching.
 */
async function runWithWatch(
	scriptPath: string,
	args: string[],
	isTypeScript: boolean,
	logger: ReturnType<typeof createLogger>
): Promise<void> {
	const scriptDir = path.dirname(scriptPath)

	const watcher = new Watcher([scriptDir], {
		exclude: ['node_modules', '.git', 'dist', '.robo', 'build']
	})

	let child: ChildProcess | null = null
	let isRestarting = false

	const run = async () => {
		if (child) {
			child.kill('SIGTERM')
			// Wait for process to exit
			await new Promise<void>((resolve) => {
				if (!child) return resolve()
				const timeout = setTimeout(resolve, 1000) // Timeout fallback
				child.on('close', () => {
					clearTimeout(timeout)
					resolve()
				})
			})
		}

		const nodeArgs = buildNodeArgs(scriptPath, isTypeScript)
		logger.debug(color.bold(`> node ${nodeArgs.join(' ')} ${args.join(' ')}`))

		child = spawn('node', [...nodeArgs, ...args], {
			stdio: 'inherit',
			shell: IS_WINDOWS
		})

		child.on('close', (code) => {
			if (code !== null && code !== 0 && !isRestarting) {
				logger.warn(`Script exited with code ${code}`)
			}
		})
	}

	// Initial run
	await run()
	logger.ready(`Watching for changes...`)

	// Watch for changes
	watcher.start(async (changes) => {
		if (isRestarting) return
		isRestarting = true

		const changedFiles = changes.map((c) => path.basename(c.filePath)).join(', ')
		logger.wait(`Change detected (${changedFiles}). Restarting...`)

		await run()
		logger.ready(`Script restarted`)

		isRestarting = false
	})

	// Cleanup
	const cleanup = () => {
		watcher.stop()
		child?.kill()
		process.exit(0)
	}

	process.on('SIGINT', cleanup)
	process.on('SIGTERM', cleanup)

	// Keep process alive
	await new Promise(() => {})
}

/**
 * Run a script with environment variables loaded.
 */
export async function runScript(options: RunScriptOptions): Promise<void> {
	const { scriptPath, args, watch, verbose } = options
	const logger = createLogger({ level: verbose ? 'debug' : 'info' }).fork('robox')
	const resolvedPath = path.resolve(scriptPath)

	if (!existsSync(resolvedPath)) {
		// Use console.error since logger is async and won't flush before process.exit
		console.error(`${color.red('error')} - Script not found: ${scriptPath}`)
		process.exit(1)
	}

	const isTypeScript = /\.tsx?$/.test(scriptPath)

	if (isTypeScript) {
		const tsSupport = getTypeScriptSupport()
		if (!tsSupport.supported) {
			const canContinue = await ensureTypeScriptSupport(logger)
			if (!canContinue) {
				process.exit(1)
			}
			// User chose to continue with JS only - but script is TS
			console.error(`${color.red('error')} - Cannot run TypeScript file without Node 22.6+: ${scriptPath}`)
			process.exit(1)
		}
	}

	if (watch) {
		await runWithWatch(resolvedPath, args, isTypeScript, logger)
	} else {
		const exitCode = await runOnce(resolvedPath, args, isTypeScript, logger)
		process.exit(exitCode)
	}
}

/**
 * Evaluate code inline.
 */
export async function runEval(code: string, verbose?: boolean): Promise<void> {
	const logger = createLogger({ level: verbose ? 'debug' : 'info' }).fork('robox')
	const tsSupport = getTypeScriptSupport()
	const nodeArgs: string[] = []

	// Add TS support flags if available (eval might contain TS)
	if (tsSupport.supported) {
		nodeArgs.push(...tsSupport.flags)
	}

	nodeArgs.push('-e', code)

	logger.debug(color.bold(`> node ${nodeArgs.join(' ')}`))

	const child = spawn('node', nodeArgs, {
		stdio: 'inherit',
		shell: IS_WINDOWS
	})

	child.on('close', (code) => process.exit(code ?? 0))
}
