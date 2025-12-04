/**
 * Performance metrics utility for CLI benchmarking.
 * Enabled via ROBO_PERF_METRICS=1 environment variable.
 */

export interface PerfSnapshot {
	timestamp: number
	memory: NodeJS.MemoryUsage
	cpu: NodeJS.CpuUsage
	uptime: number
}

export interface PhaseMetrics {
	name: string
	start: PerfSnapshot
	end?: PerfSnapshot
	duration?: number
	heapDelta?: number
}

export interface PerfReport {
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

// Check if performance metrics are enabled
export const PERF_ENABLED = process.env.ROBO_PERF_METRICS === '1'
export const PERF_JSON = process.env.ROBO_PERF_JSON === '1'
export const PERF_OUTPUT = process.env.ROBO_PERF_OUTPUT

// Internal state
let commandName = 'unknown'
let processStartSnapshot: PerfSnapshot | null = null
let importEndSnapshot: PerfSnapshot | null = null
const phases: Map<string, PhaseMetrics> = new Map()
let peakHeap = 0

/**
 * Captures a performance snapshot at the current moment.
 */
export function captureSnapshot(prevCpu?: NodeJS.CpuUsage): PerfSnapshot {
	const memory = process.memoryUsage()

	// Track peak heap
	if (memory.heapUsed > peakHeap) {
		peakHeap = memory.heapUsed
	}

	return {
		timestamp: performance.now(),
		memory,
		cpu: process.cpuUsage(prevCpu),
		uptime: process.uptime()
	}
}

// Type for globalThis perf data stored by bootstrap
interface PerfStartData {
	time: number
	mem: NodeJS.MemoryUsage
	cpu: NodeJS.CpuUsage
}

/**
 * Records the process start time. Should be called at the very beginning of CLI.
 * Reads pre-captured values from globalThis (set by bootstrap.ts before imports).
 */
export function recordProcessStart(): void {
	if (!PERF_ENABLED) return

	// Read pre-captured values from globalThis (set by bootstrap.ts)
	const perfStart = (globalThis as Record<string, unknown>).__robo_perf_start as PerfStartData | undefined

	if (perfStart) {
		// Track peak heap from pre-import memory
		if (perfStart.mem.heapUsed > peakHeap) {
			peakHeap = perfStart.mem.heapUsed
		}

		processStartSnapshot = {
			timestamp: perfStart.time,
			memory: perfStart.mem,
			cpu: perfStart.cpu,
			uptime: process.uptime()
		}
	} else {
		// Fallback: capture now (less accurate, but works if not using bootstrap)
		processStartSnapshot = captureSnapshot()
	}
}

/**
 * Records when imports are complete. Called after all static imports.
 */
export function recordImportsComplete(): void {
	if (!PERF_ENABLED || !processStartSnapshot) return
	importEndSnapshot = captureSnapshot(processStartSnapshot.cpu)
}

/**
 * Sets the current command name being executed.
 */
export function setCommandName(name: string): void {
	commandName = name
}

/**
 * Starts tracking a named phase.
 */
export function startPhase(name: string): void {
	if (!PERF_ENABLED) return

	phases.set(name, {
		name,
		start: captureSnapshot()
	})
}

/**
 * Ends tracking a named phase.
 */
export function endPhase(name: string): void {
	if (!PERF_ENABLED) return

	const phase = phases.get(name)
	if (!phase) return

	phase.end = captureSnapshot(phase.start.cpu)
	phase.duration = phase.end.timestamp - phase.start.timestamp
	phase.heapDelta = phase.end.memory.heapUsed - phase.start.memory.heapUsed
}

/**
 * Generates a performance report.
 */
export function generateReport(): PerfReport {
	const endSnapshot = captureSnapshot(processStartSnapshot?.cpu)

	const phaseResults: PerfReport['phases'] = {}

	for (const [name, phase] of phases) {
		if (phase.end) {
			phaseResults[name] = {
				duration: Math.round(phase.duration || 0),
				heapDelta: phase.heapDelta || 0,
				heapPeak: phase.end.memory.heapUsed
			}
		}
	}

	// Add import phase if tracked
	if (processStartSnapshot && importEndSnapshot) {
		phaseResults['imports'] = {
			duration: Math.round(importEndSnapshot.timestamp - processStartSnapshot.timestamp),
			heapDelta: importEndSnapshot.memory.heapUsed - processStartSnapshot.memory.heapUsed,
			heapPeak: importEndSnapshot.memory.heapUsed
		}
	}

	const totalDuration = processStartSnapshot
		? Math.round(endSnapshot.timestamp - processStartSnapshot.timestamp)
		: 0

	return {
		command: commandName,
		timestamp: new Date().toISOString(),
		phases: phaseResults,
		totals: {
			duration: totalDuration,
			peakHeap: peakHeap,
			cpuUser: endSnapshot.cpu.user,
			cpuSystem: endSnapshot.cpu.system
		}
	}
}

/**
 * Formats bytes to a human-readable string.
 */
function formatBytes(bytes: number): string {
	const mb = bytes / 1024 / 1024
	return `${mb.toFixed(1)} MB`
}

/**
 * Formats microseconds to milliseconds string.
 */
function formatMicros(micros: number): string {
	return `${Math.round(micros / 1000)}ms`
}

/**
 * Prints the performance report to console.
 */
export function printReport(): void {
	if (!PERF_ENABLED) return

	const report = generateReport()

	console.log('')
	console.log('\x1b[36m[perf]\x1b[0m Performance Report')
	console.log('\x1b[36m[perf]\x1b[0m ─────────────────────────────────────────')

	// Print import phase first if available
	if (report.phases['imports']) {
		const phase = report.phases['imports']
		const heapSign = phase.heapDelta >= 0 ? '+' : ''
		console.log(
			`\x1b[36m[perf]\x1b[0m Import Phase: \x1b[33m${phase.duration}ms\x1b[0m | ` +
			`heap: ${formatBytes(phase.heapPeak)} (${heapSign}${formatBytes(phase.heapDelta)})`
		)
	}

	// Print other phases
	for (const [name, phase] of Object.entries(report.phases)) {
		if (name === 'imports') continue

		const heapSign = phase.heapDelta >= 0 ? '+' : ''
		console.log(
			`\x1b[36m[perf]\x1b[0m ${name}: \x1b[33m${phase.duration}ms\x1b[0m | ` +
			`heap: ${formatBytes(phase.heapPeak)} (${heapSign}${formatBytes(phase.heapDelta)})`
		)
	}

	console.log('\x1b[36m[perf]\x1b[0m ─────────────────────────────────────────')
	console.log(
		`\x1b[36m[perf]\x1b[0m \x1b[1mTotal:\x1b[0m \x1b[32m${report.totals.duration}ms\x1b[0m | ` +
		`peak heap: ${formatBytes(report.totals.peakHeap)} | ` +
		`CPU user: ${formatMicros(report.totals.cpuUser)} | ` +
		`CPU sys: ${formatMicros(report.totals.cpuSystem)}`
	)
	console.log('')
}

/**
 * Exports the report to a JSON file.
 */
export async function exportReport(outputPath?: string): Promise<void> {
	if (!PERF_ENABLED) return

	const path = outputPath || PERF_OUTPUT
	if (!path) return

	const report = generateReport()
	const fs = await import('node:fs/promises')

	await fs.writeFile(path, JSON.stringify(report, null, 2))
}

/**
 * Prints JSON report to stdout (for benchmark aggregation).
 */
export function printJsonReport(): void {
	if (!PERF_ENABLED || !PERF_JSON) return

	const report = generateReport()
	console.log('__PERF_JSON_START__')
	console.log(JSON.stringify(report))
	console.log('__PERF_JSON_END__')
}

/**
 * Finalizes and outputs the performance report.
 * Should be called before process exit.
 */
export async function finalize(): Promise<void> {
	if (!PERF_ENABLED) return

	if (PERF_JSON) {
		printJsonReport()
	} else {
		printReport()
	}

	if (PERF_OUTPUT) {
		await exportReport()
	}
}

/**
 * Resets all metrics (useful for testing).
 */
export function reset(): void {
	commandName = 'unknown'
	processStartSnapshot = null
	importEndSnapshot = null
	phases.clear()
	peakHeap = 0
}
