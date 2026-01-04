/**
 * Recording Storage Module
 *
 * Provides functions to save/load session recordings to disk for post-test analysis.
 * Recordings are stored in `.robo/mock/recordings/<sessionId>.json`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { mockLogger } from '../core/logger.js'
import type { SessionRecording, RecordingMetadata } from '../types/index.js'

// ============================================================================
// Constants
// ============================================================================

const RECORDINGS_DIR = 'mock/recordings'

// ============================================================================
// Path Helpers
// ============================================================================

/**
 * Get the recordings directory path
 */
export function getRecordingsDir(projectRoot?: string): string {
	const root = projectRoot ?? process.cwd()
	return join(root, '.robo', RECORDINGS_DIR)
}

/**
 * Get the path for a specific recording file
 */
export function getRecordingPath(sessionId: string, projectRoot?: string): string {
	return join(getRecordingsDir(projectRoot), `${sessionId}.json`)
}

// ============================================================================
// Storage Operations
// ============================================================================

/**
 * Save a session recording to disk
 */
export function saveRecording(sessionId: string, recording: SessionRecording, projectRoot?: string): void {
	const recordingsDir = getRecordingsDir(projectRoot)
	const recordingPath = getRecordingPath(sessionId, projectRoot)

	// Ensure recordings directory exists
	if (!existsSync(recordingsDir)) {
		mkdirSync(recordingsDir, { recursive: true })
	}

	try {
		writeFileSync(recordingPath, JSON.stringify(recording, null, 2), 'utf-8')
		mockLogger.debug(`Saved recording for session ${sessionId} to ${recordingPath}`)
	} catch (error) {
		mockLogger.error(`Failed to save recording for session ${sessionId}: ${(error as Error).message}`)
		throw error
	}
}

/**
 * Load a session recording from disk
 */
export function loadRecording(sessionId: string, projectRoot?: string): SessionRecording | null {
	const recordingPath = getRecordingPath(sessionId, projectRoot)

	if (!existsSync(recordingPath)) {
		mockLogger.debug(`Recording not found for session ${sessionId}`)
		return null
	}

	try {
		const content = readFileSync(recordingPath, 'utf-8')
		return JSON.parse(content) as SessionRecording
	} catch (error) {
		mockLogger.warn(`Failed to load recording for session ${sessionId}: ${(error as Error).message}`)
		return null
	}
}

/**
 * List all saved recordings with their metadata
 */
export function listRecordings(projectRoot?: string): Array<{ sessionId: string; metadata: RecordingMetadata }> {
	const recordingsDir = getRecordingsDir(projectRoot)

	if (!existsSync(recordingsDir)) {
		return []
	}

	const files = readdirSync(recordingsDir).filter((f) => f.endsWith('.json'))
	const recordings: Array<{ sessionId: string; metadata: RecordingMetadata }> = []

	for (const file of files) {
		const sessionId = basename(file, '.json')
		const filePath = join(recordingsDir, file)

		try {
			const content = readFileSync(filePath, 'utf-8')
			const recording = JSON.parse(content) as SessionRecording
			recordings.push({
				sessionId,
				metadata: recording.metadata
			})
		} catch (error) {
			mockLogger.warn(`Failed to read recording metadata for ${sessionId}: ${(error as Error).message}`)
		}
	}

	// Sort by start time (newest first)
	recordings.sort((a, b) => b.metadata.startTime - a.metadata.startTime)

	return recordings
}

/**
 * Delete a session recording from disk
 */
export function deleteRecording(sessionId: string, projectRoot?: string): boolean {
	const recordingPath = getRecordingPath(sessionId, projectRoot)

	if (!existsSync(recordingPath)) {
		return false
	}

	try {
		unlinkSync(recordingPath)
		mockLogger.debug(`Deleted recording for session ${sessionId}`)
		return true
	} catch (error) {
		mockLogger.warn(`Failed to delete recording for session ${sessionId}: ${(error as Error).message}`)
		return false
	}
}

/**
 * Check if a recording exists for a session
 */
export function recordingExists(sessionId: string, projectRoot?: string): boolean {
	return existsSync(getRecordingPath(sessionId, projectRoot))
}

/**
 * Clean up old recordings, keeping only the most recent N
 */
export function cleanupRecordings(keepCount: number = 50, projectRoot?: string): number {
	const recordings = listRecordings(projectRoot)

	if (recordings.length <= keepCount) {
		return 0
	}

	// Recordings are already sorted newest first
	const toDelete = recordings.slice(keepCount)
	let deleted = 0

	for (const recording of toDelete) {
		if (deleteRecording(recording.sessionId, projectRoot)) {
			deleted++
		}
	}

	if (deleted > 0) {
		mockLogger.debug(`Cleaned up ${deleted} old recordings`)
	}

	return deleted
}
