#!/usr/bin/env node
/**
 * CLI Bootstrap Entry Point
 *
 * This file captures performance timing BEFORE any other modules are loaded.
 * ESM hoists static imports, so we use dynamic import to ensure timing capture
 * happens first.
 */

// Capture timing at the absolute earliest moment - before ANY imports
const __perfStartTime = performance.now()
const __perfStartMem = process.memoryUsage()
const __perfStartCpu = process.cpuUsage()

// Suppress warnings
process.removeAllListeners('warning')

// Store in globalThis so perf-metrics can access it
;(globalThis as Record<string, unknown>).__robo_perf_start = {
	time: __perfStartTime,
	mem: __perfStartMem,
	cpu: __perfStartCpu
}

// Now dynamically import the main CLI
import('./index.js')
