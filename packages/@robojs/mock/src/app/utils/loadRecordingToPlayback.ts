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
		botUser: { id: string; username: string; discriminator?: string; avatar?: string | null; bot?: boolean }
		applicationId: string
		recordedAt: string
	}
	initialConfig: {
		botUser: { id: string; username: string; discriminator?: string; avatar?: string | null; bot?: boolean }
		applicationId: string
		guilds: Array<{
			id: string
			name: string
			ownerId?: string
			channels: Array<{
				id: string
				name: string
				type: number
				parentId?: string | null
			}>
		}>
	}
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
 * Note: Event types must be lowercase to match the playback store hooks
 */
function mapActionTypeToEventType(actionType: string): string {
	const typeMap: Record<string, string> = {
		message_sent: 'message_create',
		message_edited: 'message_update',
		message_deleted: 'message_delete',
		interaction_response: 'interaction_response',
		interaction_followup: 'message_create',
		interaction_edit: 'message_update',
		dispatch: 'dispatch',
		gateway_identify: 'identify',
		gateway_heartbeat: 'heartbeat',
		gateway_presence_update: 'presence_update',
		gateway_voice_state_update: 'voice_state_update',
		gateway_request_guild_members: 'request_guild_members',
		typing_started: 'typing_start',
		reaction_added: 'message_reaction_add',
		reaction_removed: 'message_reaction_remove',
		rest_request: 'rest_request'
	}

	return typeMap[actionType] || actionType.toLowerCase()
}

/**
 * Transform action data to match the format expected by playback hooks.
 * Recorded actions use flat structure but playback hooks expect gateway event format.
 */
function transformActionData(actionType: string, data: unknown): unknown {
	const actionData = data as Record<string, unknown>

	switch (actionType) {
		case 'message_sent':
		case 'message_edited':
		case 'interaction_followup':
		case 'interaction_edit': {
			// Transform from { message_id, channel_id, content, ... } to { message: { id, channel_id, content, ... } }
			return {
				message: {
					id: actionData.message_id,
					channel_id: actionData.channel_id,
					guild_id: actionData.guild_id,
					content: actionData.content,
					embeds: actionData.embeds ?? [],
					components: actionData.components ?? [],
					attachments: actionData.attachments ?? [],
					author: actionData.author ?? {
						id: actionData.author_id ?? '0',
						username: 'Bot',
						bot: true
					},
					timestamp: actionData.timestamp ?? new Date().toISOString(),
					edited_timestamp: actionData.edited_timestamp ?? null,
					flags: actionData.flags ?? 0,
					type: actionData.type ?? 0,
					pinned: actionData.pinned ?? false,
					tts: actionData.tts ?? false,
					mention_everyone: actionData.mention_everyone ?? false,
					mentions: actionData.mentions ?? [],
					mention_roles: actionData.mention_roles ?? []
				}
			}
		}
		case 'message_deleted': {
			return {
				message_id: actionData.message_id
			}
		}
		case 'interaction_response': {
			// Keep as-is for interaction responses
			return data
		}
		default:
			return data
	}
}

/**
 * Create a state_sync payload from recording data.
 * This provides initial channels/members for playback mode.
 * Must match the StateSyncPayload interface from types/stage.ts
 */
function createStateSyncPayload(recording: SessionRecording): unknown {
	const { initialConfig, metadata } = recording

	// Bot user for session and users array
	const botUser = {
		id: metadata.botUser.id,
		username: metadata.botUser.username,
		discriminator: metadata.botUser.discriminator ?? '0000',
		avatar: metadata.botUser.avatar ?? null,
		bot: true,
		status: 'online' as const
	}

	// Build channels array from all guilds (StageChannel format)
	const channels = initialConfig.guilds.flatMap((guild) =>
		guild.channels.map((channel) => ({
			id: channel.id,
			name: channel.name,
			type: channel.type,
			guild_id: guild.id,
			parent_id: channel.parentId ?? null,
			position: 0
		}))
	)

	// Build members array - include bot user for each guild (StageMember format)
	const members = initialConfig.guilds.map((guild) => ({
		user: botUser,
		guild_id: guild.id,
		nick: null,
		roles: []
	}))

	// Build guilds array (StageGuild format)
	const guilds = initialConfig.guilds.map((guild) => ({
		id: guild.id,
		name: guild.name,
		icon: null,
		owner_id: guild.ownerId ?? metadata.botUser.id,
		member_count: 1
	}))

	// Return StateSyncPayload format
	return {
		session: {
			id: metadata.sessionId,
			createdAt: metadata.startTime,
			bot: botUser
		},
		guilds,
		channels,
		members,
		roles: [],
		messages: {},
		users: [botUser],
		commands: [],
		voice_states: []
	}
}

/**
 * Fetch a recording from the API and load it into the playback store
 */
export async function loadRecordingToPlayback(
	sessionId: string,
	dispatch: Dispatch<PlaybackAction>
): Promise<{ success: boolean; error?: string }> {
	console.log('[loadRecordingToPlayback] Loading recording for session:', sessionId)
	try {
		// Fetch the recording from the API
		const response = await apiFetch(`/control/tests/recordings/${sessionId}`)
		console.log('[loadRecordingToPlayback] API response status:', response.status)

		if (!response.ok) {
			const error = await response.json()
			console.log('[loadRecordingToPlayback] API error:', error)
			return { success: false, error: error.error || 'Failed to fetch recording' }
		}

		const recording: SessionRecording = await response.json()
		console.log('[loadRecordingToPlayback] Recording loaded:', {
			sessionId: recording.metadata.sessionId,
			actionCount: recording.actions.length,
			duration: recording.metadata.duration,
			guilds: recording.initialConfig.guilds.length
		})

		// Create state_sync event from initialConfig for channels/members to show in playback
		const stateSyncEvent: RecordedEvent = {
			id: 'initial_state_sync',
			seq: 0,
			type: 'state_sync' as RecordedEvent['type'],
			timestamp: recording.metadata.startTime,
			data: createStateSyncPayload(recording)
		}

		// Convert session recording actions to playback events
		const actionEvents: RecordedEvent[] = recording.actions.map((action, index) => ({
			id: action.id,
			seq: index + 1, // Start after state_sync
			type: mapActionTypeToEventType(action.type) as RecordedEvent['type'],
			timestamp: action.timestamp,
			data: transformActionData(action.type, action.data)
		}))

		// Log event types for debugging
		const eventTypes = actionEvents.reduce((acc, e) => {
			acc[e.type] = (acc[e.type] || 0) + 1
			return acc
		}, {} as Record<string, number>)
		console.log('[loadRecordingToPlayback] Event types:', eventTypes)

		// Combine state_sync with action events
		const events = [stateSyncEvent, ...actionEvents]
		console.log('[loadRecordingToPlayback] Total events:', events.length)

		// Clear existing events
		dispatch({ type: 'CLEAR_EVENTS' })

		// Add the new events
		dispatch({ type: 'ADD_EVENTS', payload: events })

		// Switch to playback mode
		dispatch({ type: 'SET_MODE', payload: 'playback' })

		// Seek to the end of the recording so all events are visible immediately
		// This provides the "final state" view - users can scrub back to see history
		const duration = recording.metadata.duration || (recording.metadata.endTime - recording.metadata.startTime)
		console.log('[loadRecordingToPlayback] Seeking to duration:', duration)
		dispatch({ type: 'SEEK', payload: duration })

		return { success: true }
	} catch (error) {
		console.error('[loadRecordingToPlayback] Error:', error)
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
