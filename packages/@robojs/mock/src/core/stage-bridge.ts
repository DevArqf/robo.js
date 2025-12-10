import { getStageServer } from './stage.js'
import type {
	StageEventType,
	StageMessageCreateData,
	StageInteractionResponseData,
	StageBotReadyData,
	StageBotDisconnectedData,
	StageBotErrorData,
	StageRESTCallData,
	StageUser
} from '../types/stage.js'
import type { MockUser } from '../types/index.js'

/**
 * Bridge between Session events and the Stage WebSocket server.
 * Acts as an observer that forwards events from the mock server to connected Stage clients.
 */
export class StageBridge {
	private sequenceCounters: Map<string, number> = new Map()  // sessionId -> seq

	/**
	 * Called when Session.dispatch() fires an event.
	 * Maps Discord events to Stage events and broadcasts to connected clients.
	 *
	 * @param sessionId - The session that dispatched the event
	 * @param event - The Discord event name (e.g., "MESSAGE_CREATE")
	 * @param data - The event payload
	 */
	onSessionDispatch(sessionId: string, event: string, data: unknown): void {
		const stageEventType = this.mapEventType(event)
		if (!stageEventType) {
			// Event not relevant to stage clients
			return
		}

		const stageData = this.transformEventData(event, data)
		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: stageEventType,
			data: stageData
		})
	}

	/**
	 * Called when a bot sends an interaction response.
	 *
	 * @param sessionId - The session
	 * @param interactionId - The interaction that was responded to
	 * @param response - The response data
	 */
	onInteractionResponse(sessionId: string, interactionId: string, response: unknown): void {
		const stageData: StageInteractionResponseData = {
			interactionId,
			response
		}

		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'interaction_response',
			data: stageData
		})
	}

	/**
	 * Called when a bot sends an interaction followup message.
	 *
	 * @param sessionId - The session
	 * @param interactionId - The original interaction
	 * @param message - The followup message
	 */
	onInteractionFollowup(sessionId: string, interactionId: string, message: unknown): void {
		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'interaction_followup',
			data: {
				interactionId,
				message
			}
		})
	}

	/**
	 * Called when a bot connects and receives READY event.
	 *
	 * @param sessionId - The session
	 * @param botUser - The bot user that connected
	 * @param connectionId - The gateway connection ID
	 */
	onBotReady(sessionId: string, botUser: MockUser, connectionId: string): void {
		const stageData: StageBotReadyData = {
			user: this.toStageUser(botUser),
			connectionId
		}

		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'bot_ready',
			data: stageData
		})
	}

	/**
	 * Called when a bot's gateway connection closes.
	 *
	 * @param sessionId - The session
	 * @param connectionId - The gateway connection ID that closed
	 * @param code - WebSocket close code
	 * @param reason - Close reason
	 */
	onBotDisconnected(sessionId: string, connectionId: string, code?: number, reason?: string): void {
		const stageData: StageBotDisconnectedData = {
			connectionId,
			code,
			reason
		}

		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'bot_disconnected',
			data: stageData
		})
	}

	/**
	 * Called when a bot encounters an error.
	 *
	 * @param sessionId - The session
	 * @param error - The error message
	 * @param connectionId - Optional connection ID
	 */
	onBotError(sessionId: string, error: string, connectionId?: string): void {
		const stageData: StageBotErrorData = {
			error,
			connectionId
		}

		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'bot_error',
			data: stageData
		})
	}

	/**
	 * Called when typing starts in a channel.
	 *
	 * @param sessionId - The session
	 * @param channelId - The channel where typing started
	 * @param userId - The user who started typing
	 */
	onTypingStart(sessionId: string, channelId: string, userId: string, user?: MockUser): void {
		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'typing_start',
			data: {
				channel_id: channelId,
				user_id: userId,
				user: user ? this.toStageUser(user) : undefined
			}
		})
	}

	/**
	 * Called when a REST API call is made.
	 *
	 * @param sessionId - The session
	 * @param data - REST call data including method, path, status, duration
	 */
	onRESTCall(sessionId: string, data: StageRESTCallData): void {
		const stageServer = getStageServer()
		stageServer.broadcastToSession(sessionId, {
			type: 'rest_call',
			data
		})
	}

	/**
	 * Map Discord event names to Stage event types.
	 * Returns null for events that shouldn't be forwarded to stage.
	 */
	private mapEventType(discordEvent: string): StageEventType | null {
		switch (discordEvent) {
			// Message events
			case 'MESSAGE_CREATE':
				return 'message_create'
			case 'MESSAGE_UPDATE':
				return 'message_update'
			case 'MESSAGE_DELETE':
				return 'message_delete'

			// Interaction events
			case 'INTERACTION_CREATE':
				return 'interaction_create'

			// Typing
			case 'TYPING_START':
				return 'typing_start'

			// Presence
			case 'PRESENCE_UPDATE':
				return 'presence_update'

			// Reactions
			case 'MESSAGE_REACTION_ADD':
				return 'message_reaction_add'
			case 'MESSAGE_REACTION_REMOVE':
				return 'message_reaction_remove'

			// We don't forward GUILD_CREATE, READY, etc. - those are internal gateway events
			default:
				return null
		}
	}

	/**
	 * Transform Discord event data to Stage format.
	 * Adds source information and simplifies where needed.
	 */
	private transformEventData(event: string, data: unknown): unknown {
		switch (event) {
			case 'MESSAGE_CREATE': {
				const messageData = data as { author?: { bot?: boolean }; [key: string]: unknown }
				const source = messageData.author?.bot ? 'bot' : 'injected'
				return {
					source,
					message: data
				} as StageMessageCreateData
			}

			case 'MESSAGE_UPDATE':
			case 'MESSAGE_DELETE':
				return { message: data }

			case 'INTERACTION_CREATE':
				return { interaction: data }

			case 'TYPING_START':
			case 'PRESENCE_UPDATE':
			default:
				return data
		}
	}

	/**
	 * Convert MockUser to StageUser
	 */
	private toStageUser(user: MockUser): StageUser {
		return {
			id: user.id,
			username: user.username,
			discriminator: user.discriminator,
			avatar: user.avatar ?? null,
			bot: user.bot
		}
	}

	/**
	 * Reset sequence counter for a session (call when session is deleted)
	 */
	resetSessionSequence(sessionId: string): void {
		this.sequenceCounters.delete(sessionId)
	}
}

/**
 * Singleton stage bridge instance
 */
let _stageBridge: StageBridge | null = null

/**
 * Get or create the stage bridge singleton
 */
export function getStageBridge(): StageBridge {
	if (!_stageBridge) {
		_stageBridge = new StageBridge()
	}
	return _stageBridge
}

/**
 * Reset the stage bridge singleton (for testing)
 */
export function resetStageBridge(): void {
	_stageBridge = null
}
