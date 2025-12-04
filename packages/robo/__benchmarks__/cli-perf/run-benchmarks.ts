/**
 * CLI Performance Benchmark Runner
 *
 * Runs CLI commands multiple times and aggregates performance metrics.
 * Outputs results in both console and markdown format.
 *
 * Usage:
 *   npx tsx run-benchmarks.ts
 *
 * Environment:
 *   BENCHMARK_ITERATIONS - Number of iterations per command (default: 10)
 *   BENCHMARK_FIXTURE - Path to test fixture (default: ../../../__tests__/fixtures/build-test-project)
 */

import { spawn, execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const ITERATIONS = parseInt(process.env.BENCHMARK_ITERATIONS || '10', 10)
const FIXTURE_PATH = process.env.BENCHMARK_FIXTURE || path.resolve(__dirname, '../../__tests__/fixtures/build-test-project')
const OUTPUT_PATH = path.resolve(__dirname, 'baseline-results.md')

interface PerfReport {
	command: string
	timestamp: string
	phases: Record<string, { duration: number; heapDelta: number; heapPeak: number }>
	totals: {
		duration: number
		peakHeap: number
		cpuUser: number
		cpuSystem: number
	}
}

interface BenchmarkResult {
	command: string
	iterations: PerfReport[]
	stats: {
		duration: { min: number; max: number; avg: number; stdDev: number }
		importPhase: { min: number; max: number; avg: number; stdDev: number }
		peakHeap: { min: number; max: number; avg: number; stdDev: number }
		cpuUser: { min: number; max: number; avg: number; stdDev: number }
	}
}

// Commands to benchmark
const COMMANDS = [
	{ name: 'build', args: ['build'], timeout: 60000 },
	{ name: 'build --dev', args: ['build', '--dev'], timeout: 60000 },
	{ name: 'start', args: ['start'], timeout: 30000, needsBuild: true },
]

function calculateStats(values: number[]): { min: number; max: number; avg: number; stdDev: number } {
	if (values.length === 0) {
		return { min: 0, max: 0, avg: 0, stdDev: 0 }
	}

	const min = Math.min(...values)
	const max = Math.max(...values)
	const avg = values.reduce((a, b) => a + b, 0) / values.length
	const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length
	const stdDev = Math.sqrt(variance)

	return { min, max, avg: Math.round(avg), stdDev: Math.round(stdDev) }
}

function parseJsonFromOutput(output: string): PerfReport | null {
	const startMarker = '__PERF_JSON_START__'
	const endMarker = '__PERF_JSON_END__'

	const startIdx = output.indexOf(startMarker)
	const endIdx = output.indexOf(endMarker)

	if (startIdx === -1 || endIdx === -1) {
		return null
	}

	const jsonStr = output.slice(startIdx + startMarker.length, endIdx).trim()

	try {
		return JSON.parse(jsonStr)
	} catch {
		console.error('Failed to parse perf JSON:', jsonStr.slice(0, 100))
		return null
	}
}

async function runCommand(
	cwd: string,
	args: string[],
	timeout: number
): Promise<{ output: string; exitCode: number }> {
	return new Promise((resolve) => {
		let output = ''
		let timeoutId: NodeJS.Timeout | null = null

		const proc = spawn('node', ['node_modules/robo.js/dist/cli/bootstrap.js', ...args], {
			cwd,
			env: {
				...process.env,
				ROBO_PERF_METRICS: '1',
				ROBO_PERF_JSON: '1',
				NODE_ENV: args.includes('--dev') ? 'development' : 'production',
			},
			stdio: ['ignore', 'pipe', 'pipe'],
		})

		proc.stdout.on('data', (data) => {
			output += data.toString()
		})

		proc.stderr.on('data', (data) => {
			output += data.toString()
		})

		// For start command, we need to kill it after startup
		if (args[0] === 'start') {
			timeoutId = setTimeout(() => {
				proc.kill('SIGTERM')
			}, 5000) // Give 5 seconds for startup metrics
		}

		proc.on('close', (code) => {
			if (timeoutId) clearTimeout(timeoutId)
			resolve({ output, exitCode: code || 0 })
		})

		proc.on('error', (err) => {
			if (timeoutId) clearTimeout(timeoutId)
			console.error('Process error:', err)
			resolve({ output, exitCode: 1 })
		})

		// Overall timeout
		setTimeout(() => {
			proc.kill('SIGKILL')
			resolve({ output, exitCode: 124 }) // timeout exit code
		}, timeout)
	})
}

async function ensureBuild(cwd: string): Promise<void> {
	console.log('  Building project first...')
	execSync('node node_modules/robo.js/dist/cli/bootstrap.js build', {
		cwd,
		stdio: 'ignore',
		env: { ...process.env, NODE_ENV: 'production' },
	})
}

async function runBenchmark(
	command: { name: string; args: string[]; timeout: number; needsBuild?: boolean }
): Promise<BenchmarkResult> {
	console.log(`\nBenchmarking: ${command.name}`)
	console.log(`  Iterations: ${ITERATIONS}`)

	const iterations: PerfReport[] = []

	// Ensure build exists for start command
	if (command.needsBuild) {
		await ensureBuild(FIXTURE_PATH)
	}

	for (let i = 0; i < ITERATIONS; i++) {
		process.stdout.write(`  Run ${i + 1}/${ITERATIONS}...`)

		const { output, exitCode } = await runCommand(FIXTURE_PATH, command.args, command.timeout)
		const report = parseJsonFromOutput(output)

		if (report) {
			iterations.push(report)
			console.log(` ${report.totals.duration}ms (heap: ${Math.round(report.totals.peakHeap / 1024 / 1024)}MB)`)
		} else {
			console.log(` [no metrics - exit code: ${exitCode}]`)
			// Log first 500 chars of output for debugging
			if (output.length > 0) {
				console.log(`    Output preview: ${output.slice(0, 200).replace(/\n/g, ' ')}...`)
			}
		}

		// Small delay between runs
		await new Promise((r) => setTimeout(r, 500))
	}

	// Calculate stats
	const durations = iterations.map((r) => r.totals.duration)
	const importPhases = iterations
		.filter((r) => r.phases['imports'])
		.map((r) => r.phases['imports'].duration)
	const peakHeaps = iterations.map((r) => r.totals.peakHeap / 1024 / 1024) // Convert to MB
	const cpuUsers = iterations.map((r) => r.totals.cpuUser / 1000) // Convert to ms

	return {
		command: command.name,
		iterations,
		stats: {
			duration: calculateStats(durations),
			importPhase: calculateStats(importPhases),
			peakHeap: calculateStats(peakHeaps),
			cpuUser: calculateStats(cpuUsers),
		},
	}
}

function getEnvironmentInfo(): string {
	const nodeVersion = process.version
	const platform = os.platform()
	const osRelease = os.release()
	const cpuModel = os.cpus()[0]?.model || 'Unknown'
	const totalMem = Math.round(os.totalmem() / 1024 / 1024 / 1024)

	return `- **Node.js:** ${nodeVersion}
- **OS:** ${platform} ${osRelease}
- **CPU:** ${cpuModel}
- **RAM:** ${totalMem} GB
- **Date:** ${new Date().toISOString().split('T')[0]}`
}

function generateMarkdown(results: BenchmarkResult[]): string {
	let md = `# CLI Performance Baseline

## Environment
${getEnvironmentInfo()}

## Test Configuration
- **Fixture:** build-test-project
- **Iterations:** ${ITERATIONS} per command

## Results

`

	for (const result of results) {
		md += `### ${result.command}

| Metric | Min | Max | Avg | StdDev |
|--------|-----|-----|-----|--------|
| Total Time (ms) | ${result.stats.duration.min} | ${result.stats.duration.max} | ${result.stats.duration.avg} | ${result.stats.duration.stdDev} |
| Import Phase (ms) | ${result.stats.importPhase.min} | ${result.stats.importPhase.max} | ${result.stats.importPhase.avg} | ${result.stats.importPhase.stdDev} |
| Peak Heap (MB) | ${result.stats.peakHeap.min.toFixed(1)} | ${result.stats.peakHeap.max.toFixed(1)} | ${result.stats.peakHeap.avg.toFixed(1)} | ${result.stats.peakHeap.stdDev.toFixed(1)} |
| CPU User (ms) | ${result.stats.cpuUser.min.toFixed(0)} | ${result.stats.cpuUser.max.toFixed(0)} | ${result.stats.cpuUser.avg.toFixed(0)} | ${result.stats.cpuUser.stdDev.toFixed(0)} |

`
	}

	md += `## Raw Data

<details>
<summary>Click to expand raw iteration data</summary>

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

</details>

---

*Generated by CLI Performance Benchmark Runner*
`

	return md
}

async function main() {
	console.log('='.repeat(60))
	console.log('CLI Performance Benchmark Runner')
	console.log('='.repeat(60))
	console.log(`\nFixture: ${FIXTURE_PATH}`)
	console.log(`Iterations: ${ITERATIONS}`)

	// Verify fixture exists
	try {
		await fs.access(FIXTURE_PATH)
	} catch {
		console.error(`\nError: Fixture not found at ${FIXTURE_PATH}`)
		console.error('Make sure the test fixture exists and has dependencies installed.')
		process.exit(1)
	}

	// Check if robo.js is linked/installed in fixture
	try {
		await fs.access(path.join(FIXTURE_PATH, 'node_modules/robo.js'))
	} catch {
		console.error('\nError: robo.js not found in fixture node_modules.')
		console.error('Run "pnpm install" in the fixture directory first.')
		process.exit(1)
	}

	const results: BenchmarkResult[] = []

	for (const command of COMMANDS) {
		const result = await runBenchmark(command)
		results.push(result)
	}

	// Generate and save markdown report
	const markdown = generateMarkdown(results)
	await fs.writeFile(OUTPUT_PATH, markdown)

	console.log('\n' + '='.repeat(60))
	console.log('Benchmark Complete!')
	console.log('='.repeat(60))
	console.log(`\nResults saved to: ${OUTPUT_PATH}`)

	// Print summary
	console.log('\nSummary:')
	for (const result of results) {
		console.log(`  ${result.command}: avg ${result.stats.duration.avg}ms (${result.iterations.length} successful runs)`)
	}
}

main().catch(console.error)
