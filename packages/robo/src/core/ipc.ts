import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * IPC Event that flows between app and host
 */
export interface IpcEvent {
	/** Unique event ID in format: {counter}-{sessionId} */
	id: string
	/** Event type (namespaced with colon, e.g., "open:url") */
	type: string
	/** Event payload */
	data: unknown
	/** Unix timestamp in milliseconds */
	ts: number
	/** Optional: target window/panel */
	target?: string
	/** Optional: reference to previous event ID */
	ref?: string
}

/**
 * Host state and capabilities
 */
export interface IpcState {
	/** Protocol version (currently 1) */
	version: number
	/** Supported event types */
	capabilities: string[]
	/** Available targets for open:url */
	targets: string[]
	/** Host environment info */
	env: {
		/** Host environment identifier */
		type: string
		/** Optional platform info */
		platform?: string
	}
}

/**
 * Options for emit()
 */
export interface IpcEmitOptions {
	/** Target window/panel for the event */
	target?: string
	/** Reference to a previous event ID */
	ref?: string
}

// Module state
let _counter = 0
let _sessionId: string | null = null

const IPC_DIR = join(process.cwd(), '.robo', 'ipc')
const OUTBOX = join(IPC_DIR, 'outbox.jsonl')
const STATE = join(IPC_DIR, 'state.json')

function ensureDir(): void {
	if (!existsSync(IPC_DIR)) {
		mkdirSync(IPC_DIR, { recursive: true })
	}
}

/**
 * Emits an IPC event to the outbox for the host to process.
 *
 * @param type - Event type (e.g., "open:url", "notify")
 * @param data - Event payload
 * @param options - Optional target and ref
 * @returns The generated event ID
 *
 * @example
 * ```ts
 * import { emit } from 'robo.js/ipc'
 *
 * emit('open:url', { url: 'https://example.com' })
 * emit('notify', { level: 'info', title: 'Hello!' })
 * ```
 */
export function emit(type: string, data: unknown, options?: IpcEmitOptions): string {
	if (!_sessionId) {
		_sessionId = Math.random().toString(36).slice(2, 6)
	}

	ensureDir()
	const id = `${++_counter}-${_sessionId}`
	const event: IpcEvent = {
		id,
		type,
		data,
		ts: Date.now(),
		...(options?.target && { target: options.target }),
		...(options?.ref && { ref: options.ref })
	}
	appendFileSync(OUTBOX, JSON.stringify(event) + '\n')
	return id
}

/**
 * Gets the current IPC state from state.json written by the host.
 *
 * @returns The IPC state or null if not available
 *
 * @example
 * ```ts
 * import { getState } from 'robo.js/ipc'
 *
 * const state = getState()
 * if (state) {
 *   console.log(`Running in ${state.env.type}`)
 * }
 * ```
 */
export function getState(): IpcState | null {
	try {
		return JSON.parse(readFileSync(STATE, 'utf-8'))
	} catch {
		return null
	}
}

/**
 * Checks if a capability/event type is supported by the host.
 *
 * @param type - The event type to check
 * @returns true if the capability is supported
 *
 * @example
 * ```ts
 * import { isCapable, emit } from 'robo.js/ipc'
 *
 * if (isCapable('open:url')) {
 *   emit('open:url', { url: 'https://example.com' })
 * }
 * ```
 */
export function isCapable(type: string): boolean {
	const state = getState()
	return state?.capabilities?.includes(type) ?? false
}

/**
 * Robo IPC Protocol for host-app communication.
 *
 * @example
 * ```ts
 * import { Ipc } from 'robo.js/ipc'
 *
 * if (Ipc.isCapable('open:url')) {
 *   Ipc.emit('open:url', { url: 'https://example.com' })
 * }
 *
 * const state = Ipc.getState()
 * console.log(state?.env.type)
 * ```
 */
export const Ipc = {
	emit,
	getState,
	isCapable
}
