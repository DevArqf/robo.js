import { useSession as useSessionState, useSessionDispatch, useWebSocket } from '../stores/sessionStore'

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
	const channelMessages = state.selectedChannelId ? state.messages[state.selectedChannelId] || [] : []

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

	// Send message command
	const sendMessage = async (content: string, channelId?: string) => {
		const targetChannelId = channelId || state.selectedChannelId
		if (!targetChannelId) {
			throw new Error('No channel selected')
		}

		return sendCommand('send_message', {
			channel_id: targetChannelId,
			content
		})
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
		channelMessages,

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
		invokeCommand
	}
}
