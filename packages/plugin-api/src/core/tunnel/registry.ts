/**
 * Tunnel Registry
 *
 * Manages persistent storage of running tunnel information using Nanocore.
 * Stores all tunnels in a single key for simplicity.
 */
import { Nanocore } from 'robo.js/unstable.js'
import { logger } from '../logger.js'
import { isProcessAlive, generateId } from './utils.js'

const STORAGE_KEY = 'server/tunnels'

/**
 * Stored tunnel record
 */
export interface TunnelRecord {
	id: string
	pid: number
	port: number
	url: string
	startedAt: number
	provider: 'cloudflare' | 'mock'
}

interface TunnelStorage {
	tunnels: TunnelRecord[]
}

/**
 * Get all tunnels from storage
 */
async function getStorage(): Promise<TunnelStorage> {
	const data = await Nanocore.get(STORAGE_KEY)
	return (data as TunnelStorage) ?? { tunnels: [] }
}

/**
 * Save tunnels to storage
 */
async function setStorage(storage: TunnelStorage): Promise<void> {
	await Nanocore.set(STORAGE_KEY, storage)
}

/**
 * Register a new tunnel in the registry.
 */
async function register(record: Omit<TunnelRecord, 'id'>): Promise<TunnelRecord> {
	logger.debug('Registering tunnel...')

	const id = generateId()
	const fullRecord: TunnelRecord = { ...record, id }
	logger.debug(`Generated tunnel ID: ${id}`)

	const storage = await getStorage()
	storage.tunnels.push(fullRecord)
	await setStorage(storage)

	logger.debug(`Registered tunnel ${id} (PID ${record.pid}, port ${record.port})`)
	return fullRecord
}

/**
 * Get all registered tunnels, with automatic cleanup of dead processes.
 * Any tunnel whose PID is no longer alive will be removed from the registry.
 */
async function getAll(): Promise<TunnelRecord[]> {
	const storage = await getStorage()
	logger.debug(`Tunnel registry has ${storage.tunnels.length} entries`)

	const aliveTunnels: TunnelRecord[] = []
	let hasDeadTunnels = false

	for (const record of storage.tunnels) {
		const alive = isProcessAlive(record.pid)
		logger.debug(`Tunnel ${record.id} (PID ${record.pid}, port ${record.port}) alive=${alive}`)

		if (alive) {
			aliveTunnels.push(record)
		} else {
			logger.debug(`Tunnel ${record.id} (PID ${record.pid}) is dead, cleaning up`)
			hasDeadTunnels = true
		}
	}

	// Clean up dead entries
	if (hasDeadTunnels) {
		await setStorage({ tunnels: aliveTunnels })
	}

	return aliveTunnels
}

/**
 * Get a specific tunnel by ID.
 * Validates the PID is still alive and auto-cleans if dead.
 */
async function get(id: string): Promise<TunnelRecord | null> {
	const storage = await getStorage()
	const record = storage.tunnels.find((t) => t.id === id)

	if (!record) {
		return null
	}

	if (!isProcessAlive(record.pid)) {
		logger.debug(`Tunnel ${id} (PID ${record.pid}) is dead, cleaning up`)
		await remove(id)
		return null
	}

	return record
}

/**
 * Remove a tunnel entry from the registry.
 */
async function remove(id: string): Promise<boolean> {
	const storage = await getStorage()
	const newTunnels = storage.tunnels.filter((t) => t.id !== id)

	if (newTunnels.length === storage.tunnels.length) {
		return false // Not found
	}

	await setStorage({ tunnels: newTunnels })
	logger.debug(`Removed tunnel ${id} from registry`)
	return true
}

/**
 * Kill a tunnel process and remove it from the registry.
 * Uses SIGTERM first, then SIGKILL after a timeout if still alive.
 */
async function kill(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<boolean> {
	const record = await get(id)
	if (!record) {
		return false
	}

	try {
		// Send initial signal
		process.kill(record.pid, signal)
		logger.debug(`Sent ${signal} to tunnel ${id} (PID ${record.pid})`)

		// Wait for graceful shutdown
		await new Promise((r) => setTimeout(r, 1000))

		// Force kill if still alive
		if (isProcessAlive(record.pid)) {
			logger.debug(`Tunnel ${id} still alive, sending SIGKILL`)
			process.kill(record.pid, 'SIGKILL')
		}
	} catch {
		// Process already dead, that's fine
		logger.debug(`Tunnel ${id} process already dead`)
	}

	await remove(id)
	return true
}

/**
 * Kill all registered tunnels.
 */
async function killAll(): Promise<number> {
	const tunnels = await getAll()
	let count = 0

	for (const tunnel of tunnels) {
		const success = await kill(tunnel.id)
		if (success) {
			count++
		}
	}

	return count
}

export const TunnelRegistry = {
	register,
	getAll,
	get,
	remove,
	kill,
	killAll
}

// Re-export isProcessAlive for backward compatibility
export { isProcessAlive } from './utils.js'
