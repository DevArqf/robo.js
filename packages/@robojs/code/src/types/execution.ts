/**
 * Execution provider interfaces for @robojs/code SDK
 *
 * ExecutionProvider is the authoritative interface for filesystem and command execution.
 * LocalServiceDiscovery handles WebContainer service URL resolution.
 */

import type {
	DirEntry,
	FileStat,
	RunOptions,
	RunResult,
	SearchOptions,
	SearchResult,
	ServiceStartOptions,
	SnapshotOptions,
	TerminalChunk,
	TerminalSessionHandle
} from './terminal.js'

/**
 * The ExecutionProvider is the authoritative interface for:
 * - Project filesystem operations
 * - Terminal/command execution
 * - Long-running session management
 *
 * Implementations:
 * - WebContainerProvider (primary, browser)
 * - NodeProvider (secondary, Node.js)
 */
export interface ExecutionProvider {
	// File operations
	readFile(path: string): Promise<string>
	writeFile(path: string, content: string): Promise<void>
	deletePath(path: string, opts?: { recursive?: boolean }): Promise<void>
	exists(path: string): Promise<boolean>
	readdir(path: string, opts?: { recursive?: boolean }): Promise<DirEntry[]>
	mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>
	search(pattern: string, opts?: SearchOptions): Promise<SearchResult[]>
	snapshot(opts?: SnapshotOptions): Promise<Record<string, string>>

	// Scale-friendly file operations
	stat(path: string): Promise<FileStat>

	// One-shot command execution (no shell interpolation)
	run(command: string, args: string[], opts?: RunOptions): Promise<RunResult>

	// Streaming command execution
	runStream(command: string, args: string[], opts?: RunOptions): AsyncIterable<TerminalChunk>

	// Long-running session management
	startSession(command: string, args: string[], opts?: RunOptions): Promise<TerminalSessionHandle>
	stopSession(handle: TerminalSessionHandle): Promise<void>
	streamSession(handle: TerminalSessionHandle): AsyncIterable<TerminalChunk>
}

/**
 * Service types that can be discovered via LocalServiceDiscovery
 */
export type ServiceType = 'mock' | 'mcp' | 'dev'

/**
 * LocalServiceDiscovery handles WebContainer service URL resolution.
 *
 * WebContainer-hosted servers (dev server, mock server, local MCP server)
 * must not be addressed as 127.0.0.1:PORT. This interface provides:
 * 1. Start a process in a terminal session
 * 2. Wait for WebContainer port readiness events
 * 3. Return an externally reachable URL
 *
 * Must handle:
 * - Port collisions (mock/dev commonly default to 3000)
 * - Multiple concurrent services
 * - Cleanup on completion/abort
 */
export interface LocalServiceDiscovery {
	/**
	 * Start a named service in the container
	 * @param service - Service type (mock, mcp, dev)
	 * @param opts - Optional start options including port hints
	 * @returns Service ID for tracking
	 */
	start(service: ServiceType, opts?: ServiceStartOptions): Promise<{ serviceId: string }>

	/**
	 * Wait for the service to be ready and return its externally reachable URL
	 * @param serviceId - Service ID from start()
	 * @returns The discovered URL
	 */
	waitForUrl(serviceId: string): Promise<{ url: string }>

	/**
	 * Stop a running service and clean up resources
	 * @param serviceId - Service ID from start()
	 */
	stop(serviceId: string): Promise<void>
}
