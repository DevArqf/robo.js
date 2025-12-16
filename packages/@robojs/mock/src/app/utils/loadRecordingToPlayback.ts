import type { Dispatch } from 'react'
import type { RecordedEvent } from '../stores/playbackStore'
import { apiFetch } from './api'

/**
 * Session recording structure from the mock server
 */
interface SessionRecording {
	version: number
	metadata: {
		sessionId: string
		sessionName?: string
		startTime: number
		endTime: number
		duration: number
		actionCount: number
		botUser: { id: string; username: string }
		applicationId: string
		recordedAt: string
	}
	initialConfig: unknown
	actions: RecordedAction[]
}

interface RecordedAction {
	id: string
	type: string
	data: unknown
	timestamp: number
	sequence?: number
}

/**
 * Playback action types
 */
type PlaybackAction =
	| { type: 'SET_MODE'; payload: 'live' | 'playback' }
	| { type: 'SET_PLAYING'; payload: boolean }
	| { type: 'SEEK'; payload: number }
	| { type: 'SET_SPEED'; payload: number }
	| { type: 'ADD_EVENT'; payload: RecordedEvent }
	| { type: 'ADD_EVENTS'; payload: RecordedEvent[] }
	| { type: 'CLEAR_EVENTS' }
	| { type: 'UPDATE_TIME'; payload: number }

/**
 * Map action types from session recording to stage event types
 */
function mapActionTypeToEventType(actionType: string): string {
	const typeMap: Record<string, string> = {
		message_sent: 'MESSAGE_CREATE',
		message_edited: 'MESSAGE_UPDATE',
		message_deleted: 'MESSAGE_DELETE',
		interaction_response: 'INTERACTION_CREATE',
		interaction_followup: 'MESSAGE_CREATE',
		interaction_edit: 'MESSAGE_UPDATE',
		dispatch: 'DISPATCH',
		gateway_identify: 'IDENTIFY',
		gateway_heartbeat: 'HEARTBEAT',
		gateway_presence_update: 'PRESENCE_UPDATE',
		gateway_voice_state_update: 'VOICE_STATE_UPDATE',
		gateway_request_guild_members: 'REQUEST_GUILD_MEMBERS',
		typing_started: 'TYPING_START',
		reaction_added: 'MESSAGE_REACTION_ADD',
		reaction_removed: 'MESSAGE_REACTION_REMOVE',
		rest_request: 'REST_REQUEST'
	}

	return typeMap[actionType] || actionType.toUpperCase()
}

/**
 * Fetch a recording from the API and load it into the playback store
 */
export async function loadRecordingToPlayback(
	sessionId: string,
	dispatch: Dispatch<PlaybackAction>
): Promise<{ success: boolean; error?: string }> {
	try {
		// Fetch the recording from the API
		const response = await apiFetch(`/control/tests/recordings/${sessionId}`)

		if (!response.ok) {
			const error = await response.json()
			return { success: false, error: error.error || 'Failed to fetch recording' }
		}

		const recording: SessionRecording = await response.json()

		// Convert session recording actions to playback events
		const events: RecordedEvent[] = recording.actions.map((action, index) => ({
			id: action.id,
			seq: action.sequence ?? index,
			type: mapActionTypeToEventType(action.type) as RecordedEvent['type'],
			timestamp: action.timestamp,
			data: action.data
		}))

		// Clear existing events
		dispatch({ type: 'CLEAR_EVENTS' })

		// Add the new events
		dispatch({ type: 'ADD_EVENTS', payload: events })

		// Switch to playback mode
		dispatch({ type: 'SET_MODE', payload: 'playback' })

		return { success: true }
	} catch (error) {
		return { success: false, error: (error as Error).message }
	}
}

/**
 * Get recording metadata without loading the full recording
 */
export async function getRecordingMetadata(
	sessionId: string
): Promise<{ metadata: SessionRecording['metadata'] | null; error?: string }> {
	try {
		const response = await apiFetch(`/control/tests/recordings/${sessionId}`)

		if (!response.ok) {
			const error = await response.json()
			return { metadata: null, error: error.error || 'Failed to fetch recording' }
		}

		const recording: SessionRecording = await response.json()
		return { metadata: recording.metadata }
	} catch (error) {
		return { metadata: null, error: (error as Error).message }
	}
}
