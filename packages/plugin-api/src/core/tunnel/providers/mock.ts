/**
 * Mock Tunnel Provider
 *
 * A test-only tunnel provider that does NOT make any network calls
 * or spawn real processes. Used for unit and E2E testing.
 */
import { EventEmitter } from 'node:events'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { TunnelProvider, TunnelInstance, TunnelProviderConfig } from '../types.js'

/**
 * Tracked method call for test assertions
 */
export interface MockCall {
	method: string
	args: unknown[]
}

/**
 * Mock tunnel provider for testing.
 * Does NOT make any network calls or spawn real processes.
 */
export class MockTunnelProvider implements TunnelProvider {
	name = 'mock'

	/** Track method calls for test assertions */
	calls: MockCall[] = []

	/** Configurable mock URL to return (generic, not cloudflare-specific) */
	mockUrl = 'https://mock-tunnel.example.com'

	/** Set to true to spawn a real subprocess that can be safely killed */
	useRealProcess = true

	/** Set to true to simulate start() failure */
	shouldFailStart = false

	/** Set to true to simulate install() failure */
	shouldFailInstall = false

	/** Set to true to simulate isInstalled() returning false */
	shouldBeUninstalled = false

	/** Set to true to simulate initialize() failure */
	shouldFailInitialize = false

	isInstalled(): boolean {
		this.calls.push({ method: 'isInstalled', args: [] })
		return !this.shouldBeUninstalled
	}

	async install(): Promise<void> {
		this.calls.push({ method: 'install', args: [] })
		if (this.shouldFailInstall) {
			throw new Error('Mock install failure')
		}
	}

	async initialize(config: TunnelProviderConfig): Promise<boolean> {
		this.calls.push({ method: 'initialize', args: [config] })
		if (this.shouldFailInitialize) {
			return false
		}
		return true
	}

	async start(url: string, config?: TunnelProviderConfig): Promise<TunnelInstance> {
		this.calls.push({ method: 'start', args: [url, config] })

		if (this.shouldFailStart) {
			throw new Error('Mock start failure')
		}

		// Spawn a real subprocess that can be safely killed by TunnelRegistry
		// This avoids killing the Jest worker when tests call TunnelRegistry.kill()
		if (this.useRealProcess) {
			const realProcess = spawn('sleep', ['3600'], {
				detached: true,
				stdio: 'ignore'
			})
			realProcess.unref()

			return {
				process: realProcess,
				url: this.mockUrl,
				provider: this.name
			}
		}

		// Create a mock ChildProcess using EventEmitter (for unit tests that don't call kill)
		const mockProcess = new EventEmitter() as ChildProcess & {
			pid: number
			exitCode: number | null
			killed: boolean
		}

		// Use Object.defineProperty to set read-only properties
		// Use a fake PID (not process.pid) to avoid accidentally killing Jest
		Object.defineProperty(mockProcess, 'pid', { value: 99999, writable: true })
		Object.defineProperty(mockProcess, 'exitCode', { value: null, writable: true })
		Object.defineProperty(mockProcess, 'killed', { value: false, writable: true })

		// Mock kill method
		mockProcess.kill = (signal?: NodeJS.Signals | number) => {
			mockProcess.killed = true
			mockProcess.exitCode = 0
			mockProcess.emit('exit', 0, signal)
			return true
		}

		// Mock unref method (used in detached mode)
		mockProcess.unref = () => {}

		return {
			process: mockProcess,
			url: this.mockUrl,
			provider: this.name
		}
	}

	async stop(instance: TunnelInstance, signal?: NodeJS.Signals): Promise<void> {
		this.calls.push({ method: 'stop', args: [instance, signal] })
		instance.process?.kill(signal)
	}

	/**
	 * Reset mock state for test isolation
	 */
	reset(): void {
		this.calls = []
		this.mockUrl = 'https://mock-tunnel.example.com'
		this.useRealProcess = true
		this.shouldFailStart = false
		this.shouldFailInstall = false
		this.shouldBeUninstalled = false
		this.shouldFailInitialize = false
	}

	/**
	 * Check if a specific method was called
	 */
	wasCalled(method: string): boolean {
		return this.calls.some((c) => c.method === method)
	}

	/**
	 * Get all calls to a specific method
	 */
	getCallsTo(method: string): MockCall[] {
		return this.calls.filter((c) => c.method === method)
	}
}
