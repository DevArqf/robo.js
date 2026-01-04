#!/usr/bin/env node
import { spawn } from 'child_process'
import { Env } from '../core/env.js'
import { IS_WINDOWS, packageJson } from './utils/utils.js'
import { logger as defaultLogger } from '../core/logger.js'
import { color } from '../core/color.js'
import { parseScriptArgs, runScript, runEval } from './utils/script-runner.js'

// Handle --version and --help directly
const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-V')) {
	console.log(packageJson.version)
	process.exit(0)
}

if (args.includes('--help') || args.includes('-h')) {
	printHelp()
	process.exit(0)
}

// Run the main handler
handler().catch((error) => {
	console.error(error)
	process.exit(1)
})

function printHelp() {
	console.log(`
${color.bold('robox')} - Execute scripts and commands with Robo environment variables

${color.bold('Usage:')}
  robox <script>           Run a script with env vars loaded
  robox <robo-command>     Run a robo command with env vars
  robox -- <command>       Run any command with env vars

${color.bold('Options:')}
  -w, --watch              Watch for changes and restart (scripts only)
  -e <code>                Evaluate code
  -v, --verbose            Enable verbose logging
  -V, --version            Show version
  -h, --help               Show this help

${color.bold('Examples:')}
  robox script.ts              Run TypeScript file
  robox seed.ts --dry-run      Run with args passed to script
  robox build                  Run robo build
  robox -- npm test            Run npm test with env
  robox -w migrate.ts          Watch mode
  robox -e "console.log(process.env.NODE_ENV)"

${color.bold('TypeScript Support:')}
  Node 22.6+    Native support via --experimental-strip-types
  Node 23+      Full support (recommended)
`)
}

async function handler() {
	// Parse arguments to determine mode
	const parsed = parseScriptArgs(process.argv)
	const logger = defaultLogger({ level: parsed.verbose ? 'debug' : 'info' }).fork('robox')

	// Infer environment mode from robo subcommand (dev → development, others → production)
	// This ensures the correct .env.{mode} file is loaded before spawning the child process
	const roboSubcommand = parsed.mode === 'robo' ? parsed.command?.[0] : undefined
	const envMode = roboSubcommand === 'dev' ? 'development' : 'production'

	// Load environment variables first
	logger.debug('Loading environment variables...')
	await Env.load({ mode: envMode })

	switch (parsed.mode) {
		case 'script':
			// Run script file with args
			await runScript({
				scriptPath: parsed.scriptPath!,
				args: parsed.scriptArgs ?? [],
				watch: parsed.watch,
				verbose: parsed.verbose
			})
			break

		case 'eval':
			// Evaluate inline code
			await runEval(parsed.code!, parsed.verbose)
			break

		case 'command':
			// Explicit command: robox -- npm start
			await runCommand(parsed.command ?? [], logger)
			break

		case 'robo':
		default:
			// Pass to robo CLI: robox build → robo build
			await runCommand(['robo', ...(parsed.command ?? [])], logger)
			break
	}
}

async function runCommand(args: string[], logger: ReturnType<typeof defaultLogger>): Promise<void> {
	if (args.length === 0) {
		logger.error('No command specified')
		process.exit(1)
	}

	logger.debug(color.bold('> ' + args.join(' ')))

	const child = spawn(args[0], args.slice(1), {
		stdio: 'inherit',
		shell: IS_WINDOWS
	})

	process.on('SIGINT', () => child.kill('SIGINT'))
	process.on('SIGTERM', () => child.kill('SIGTERM'))
	process.on('exit', () => child.kill())

	child.on('close', (code) => process.exit(code ?? 0))
}
