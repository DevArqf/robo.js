import { useSession as useSessionState, useSessionDispatch, useWebSocket, type PendingMessage } from '../stores/sessionStore'
import type { ModalActionRow } from '../components/modals/Modal'
import type { StageMessage, StageUser } from '../types/stage'

/**
 * Combined hook for session state and WebSocket connection.
 * Provides easy access to session data and actions.
 */
export function useSession() {
	const state = useSessionState()
	const dispatch = useSessionDispatch()
	const { connect, disconnect, sendCommand, isConnected, isConnecting, error } = useWebSocket()

	// Derived state
	const selectedGuild = state.guilds.find((g) => g.id === state.selectedGuildId) || null
	const selectedChannel = state.channels.find((c) => c.id === state.selectedChannelId) || null
	const guildChannels = state.channels.filter((c) => c.guild_id === state.selectedGuildId)
	const guildMembers = state.members.filter((m) => m.guild_id === state.selectedGuildId)
	const guildRoles = state.roles.filter((r) => r.guild_id === state.selectedGuildId)
	const channelMessages = state.selectedChannelId ? state.messages[state.selectedChannelId] || [] : []
	// Filter to only slash commands (type 1 = ChatInput) for autocomplete
	const slashCommands = state.commands.filter((c) => c.type === 1)
	// Filter to context menu commands (type 2 = USER, type 3 = MESSAGE)
	const userCommands = state.commands.filter((c) => c.type === 2)
	const messageCommands = state.commands.filter((c) => c.type === 3)
	// Get typing users for current channel (filter out expired)
	const now = Date.now()
	const channelTypingUsers = state.selectedChannelId
		? (state.typingUsers[state.selectedChannelId] || []).filter((t) => t.expiresAt > now)
		: []
	// Get pending interactions for current channel ("Bot is thinking...")
	const channelPendingInteractions = state.selectedChannelId
		? state.pendingInteractions.filter((p) => p.channelId === state.selectedChannelId)
		: []
	// Get pending messages for current channel (sending/failed)
	const channelPendingMessages = state.selectedChannelId
		? state.pendingMessages.filter((m) => m.channelId === state.selectedChannelId)
		: []

	// Actions
	const setSessionId = (sessionId: string) => {
		dispatch({ type: 'SET_SESSION_ID', payload: sessionId })
	}

	const selectGuild = (guildId: string | null) => {
		dispatch({ type: 'SELECT_GUILD', payload: guildId })
	}

	const selectChannel = (channelId: string | null) => {
		dispatch({ type: 'SELECT_CHANNEL', payload: channelId })
	}

	const toggleMembers = () => {
		dispatch({ type: 'TOGGLE_MEMBERS' })
	}

	// Send message command with pending state tracking
	const sendMessage = async (content: string, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		// Create pending message ID
		const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`

		// Get current user info (use a default if not available)
		const author = {
			id: 'user_0',
			username: 'You',
			avatar: null
		}

		// Add to pending messages
		const pendingMessage: PendingMessage = {
			id: pendingId,
			content,
			channelId: targetChannelId,
			state: 'sending',
			author,
			createdAt: Date.now()
		}
		dispatch({ type: 'ADD_PENDING_MESSAGE', payload: pendingMessage })

		try {
			const result = await sendCommand('send_message', {
				channel_id: targetChannelId,
				content
			})
			// Remove pending message on success (the real message will be added via message_create event)
			dispatch({ type: 'REMOVE_PENDING_MESSAGE', payload: pendingId })
			return result
		} catch (err) {
			// Mark as failed
			dispatch({
				type: 'MARK_MESSAGE_FAILED',
				payload: {
					id: pendingId,
					error: err instanceof Error ? err.message : 'Failed to send message'
				}
			})
			throw err
		}
	}

	// Retry a failed pending message
	const retryMessage = async (messageId: string) => {
		const pendingMessage = state.pendingMessages.find((m) => m.id === messageId)
		if (!pendingMessage) return

		// Remove the failed message and resend
		dispatch({ type: 'REMOVE_PENDING_MESSAGE', payload: messageId })
		return sendMessage(pendingMessage.content, pendingMessage.channelId)
	}

	// Cancel/remove a pending message
	const cancelMessage = (messageId: string) => {
		dispatch({ type: 'REMOVE_PENDING_MESSAGE', payload: messageId })
	}

	// Invoke slash command
	const invokeCommand = async (commandName: string, options?: Record<string, unknown>, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('invoke_command', {
			channel_id: targetChannelId,
			command_name: commandName,
			options
		})
	}

	// Click a button component
	const clickButton = async (messageId: string, customId: string, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('click_button', {
			channel_id: targetChannelId,
			message_id: messageId,
			custom_id: customId
		})
	}

	// Select option(s) from a select menu
	const selectOption = async (messageId: string, customId: string, values: string[], channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('select_option', {
			channel_id: targetChannelId,
			message_id: messageId,
			custom_id: customId,
			values
		})
	}

	// Add a reaction to a message
	const addReaction = async (messageId: string, emoji: string, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('add_reaction', {
			channel_id: targetChannelId,
			message_id: messageId,
			emoji
		})
	}

	// Remove a reaction from a message
	const removeReaction = async (messageId: string, emoji: string, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('remove_reaction', {
			channel_id: targetChannelId,
			message_id: messageId,
			emoji
		})
	}

	// Submit a modal form (Phase 5M)
	const submitModal = async (customId: string, components: ModalActionRow[]) => {
		return sendCommand('submit_modal', {
			custom_id: customId,
			components
		})
	}

	// Close the active modal (Phase 5M)
	const closeModal = () => {
		dispatch({ type: 'CLOSE_MODAL' })
	}

	// Invoke context menu command (Phase 5N)
	const invokeContextCommand = async (
		commandName: string,
		commandType: 2 | 3,
		targetId: string,
		targetData: StageMessage | StageUser,
		channelId?: string
	) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('invoke_context_command', {
			channel_id: targetChannelId,
			command_name: commandName,
			command_type: commandType,
			target_id: targetId,
			...(commandType === 3 && { message: targetData }),
			...(commandType === 2 && { user: targetData })
		})
	}

	return {
		// State
		...state,
		isConnected: isConnected || state.isConnected,
		isConnecting: isConnecting || state.isConnecting,
		error: error || state.error,

		// Derived state
		selectedGuild,
		selectedChannel,
		guildChannels,
		guildMembers,
		guildRoles,
		channelMessages,
		channelTypingUsers,
		channelPendingInteractions,
		channelPendingMessages,
		slashCommands,
		userCommands,
		messageCommands,

		// Connection
		connect,
		disconnect,

		// Actions
		setSessionId,
		selectGuild,
		selectChannel,
		toggleMembers,

		// Commands
		sendCommand,
		sendMessage,
		retryMessage,
		cancelMessage,
		invokeCommand,
		clickButton,
		selectOption,
		addReaction,
		removeReaction,
		submitModal,
		closeModal,
		invokeContextCommand
	}
}
