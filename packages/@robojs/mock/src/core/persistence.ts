import { mkdir, writeFile, readFile, readdir, unlink, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { mockLogger } from './logger.js'
import { serializeSessionState } from '../session/state.js'
import { generateSessionSummary, type SessionSummary } from './summary.js'
import type { Session } from '../session/session.js'
import type { RecordedAction, SerializedSessionState } from '../types/index.js'

/**
 * Persisted session data structure.
 * Contains all information needed for replay and analysis.
 */
export interface PersistedSession {
	/** Session metadata */
	id: string
	name?: string
	createdAt: number
	endedAt: number

	/** Session summary statistics */
	summary: SessionSummary

	/** All recorded actions (chronological order) */
	actions: RecordedAction[]

	/** Final session state snapshot */
	state: SerializedSessionState
}

/**
 * Gets the path to the mock data directory.
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns Absolute path to .robo/{dataDirectory}
 */
export function getMockDataDir(dataDirectory: string = 'mock'): string {
	return path.join(process.cwd(), '.robo', dataDirectory)
}

/**
 * Gets the path to a specific session's data file.
 * @param sessionId - The session ID
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns Absolute path to the session JSON file
 */
export function getSessionFilePath(sessionId: string, dataDirectory: string = 'mock'): string {
	return path.join(getMockDataDir(dataDirectory), `${sessionId}.json`)
}

/**
 * Ensures the mock data directory exists.
 * @param dataDirectory - Custom directory name (default: 'mock')
 */
export async function ensureMockDataDir(dataDirectory: string = 'mock'): Promise<void> {
	const dir = getMockDataDir(dataDirectory)
	if (!existsSync(dir)) {
		await mkdir(dir, { recursive: true })
		mockLogger.debug(`Created mock data directory: ${dir}`)
	}
}

/**
 * Persists a session to disk for later replay and analysis.
 * Called when a mock session ends (on shutdown or explicit cleanup).
 *
 * @param session - The session to persist
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns The path to the persisted file
 */
export async function persistSession(session: Session, dataDirectory: string = 'mock'): Promise<string> {
	await ensureMockDataDir(dataDirectory)

	const filePath = getSessionFilePath(session.id, dataDirectory)
	const summary = generateSessionSummary(session)

	// Get recorded actions from the session via the public getActions() method
	const actions = session.getActions()

	const persistedData: PersistedSession = {
		id: session.id,
		name: session.name,
		createdAt: session.createdAt,
		endedAt: Date.now(),
		summary,
		actions,
		state: serializeSessionState(session.state)
	}

	await writeFile(filePath, JSON.stringify(persistedData, null, 2), 'utf-8')
	mockLogger.debug(`Persisted session ${session.id} to ${filePath}`)

	return filePath
}

/**
 * Loads a persisted session from disk.
 *
 * @param sessionId - The session ID to load
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns The persisted session data, or null if not found
 */
export async function loadPersistedSession(
	sessionId: string,
	dataDirectory: string = 'mock'
): Promise<PersistedSession | null> {
	const filePath = getSessionFilePath(sessionId, dataDirectory)

	if (!existsSync(filePath)) {
		return null
	}

	try {
		const content = await readFile(filePath, 'utf-8')
		return JSON.parse(content) as PersistedSession
	} catch (error) {
		mockLogger.warn(`Failed to load persisted session ${sessionId}:`, error)
		return null
	}
}

/**
 * Lists all persisted sessions.
 *
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns Array of session IDs and their metadata
 */
export async function listPersistedSessions(
	dataDirectory: string = 'mock'
): Promise<Array<{ id: string; name?: string; createdAt: number; endedAt: number; filePath: string }>> {
	const dir = getMockDataDir(dataDirectory)

	if (!existsSync(dir)) {
		return []
	}

	const files = await readdir(dir)
	const sessions: Array<{ id: string; name?: string; createdAt: number; endedAt: number; filePath: string }> = []

	for (const file of files) {
		if (!file.endsWith('.json')) {
			continue
		}

		const filePath = path.join(dir, file)
		try {
			const content = await readFile(filePath, 'utf-8')
			const data = JSON.parse(content) as PersistedSession
			sessions.push({
				id: data.id,
				name: data.name,
				createdAt: data.createdAt,
				endedAt: data.endedAt,
				filePath
			})
		} catch {
			// Skip invalid files
		}
	}

	// Sort by creation time (newest first)
	return sessions.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Deletes a persisted session from disk.
 *
 * @param sessionId - The session ID to delete
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns True if deleted, false if not found
 */
export async function deletePersistedSession(sessionId: string, dataDirectory: string = 'mock'): Promise<boolean> {
	const filePath = getSessionFilePath(sessionId, dataDirectory)

	if (!existsSync(filePath)) {
		return false
	}

	await unlink(filePath)
	mockLogger.debug(`Deleted persisted session ${sessionId}`)
	return true
}

/**
 * Cleans up old persisted sessions, keeping only the most recent N sessions.
 *
 * @param keepCount - Number of sessions to keep (default: 10)
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns Number of sessions deleted
 */
export async function cleanupOldSessions(keepCount: number = 10, dataDirectory: string = 'mock'): Promise<number> {
	const sessions = await listPersistedSessions(dataDirectory)

	if (sessions.length <= keepCount) {
		return 0
	}

	// Sessions are already sorted by creation time (newest first)
	// Delete everything after keepCount
	const toDelete = sessions.slice(keepCount)
	let deleted = 0

	for (const session of toDelete) {
		try {
			await unlink(session.filePath)
			deleted++
		} catch {
			// Ignore errors
		}
	}

	if (deleted > 0) {
		mockLogger.debug(`Cleaned up ${deleted} old persisted session(s)`)
	}

	return deleted
}

/**
 * Gets the total size of all persisted sessions.
 *
 * @param dataDirectory - Custom directory name (default: 'mock')
 * @returns Total size in bytes
 */
export async function getPersistedSessionsSize(dataDirectory: string = 'mock'): Promise<number> {
	const dir = getMockDataDir(dataDirectory)

	if (!existsSync(dir)) {
		return 0
	}

	const files = await readdir(dir)
	let totalSize = 0

	for (const file of files) {
		if (!file.endsWith('.json')) {
			continue
		}

		try {
			const filePath = path.join(dir, file)
			const stats = await stat(filePath)
			totalSize += stats.size
		} catch {
			// Ignore errors
		}
	}

	return totalSize
}
