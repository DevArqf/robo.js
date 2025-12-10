import { createContext, useContext, useReducer, useRef, useEffect, useCallback, useState, type ReactNode, type Dispatch } from 'react'
import type {
	StageGuild,
	StageChannel,
	StageUser,
	StageMember,
	StageRole,
	StageMessage,
	StageApplicationCommand,
	StateSyncPayload,
	StageMessageCreateData,
	StageEvent,
	StageCommand
} from '../types/stage'

// Session state shape
export interface SessionState {
	// Connection
	sessionId: string | null
	isConnected: boolean
	isConnecting: boolean
	error: string | null

	// Data from state_sync
	guilds: StageGuild[]
	channels: StageChannel[]
	members: StageMember[]
	roles: StageRole[]  // Phase 5H: Guild roles
	users: StageUser[]
	messages: Record<string, StageMessage[]>
	commands: StageApplicationCommand[]  // Phase 5G: Available slash commands
	botUser: StageUser | null

	// UI state
	selectedGuildId: string | null
	selectedChannelId: string | null
	showMembers: boolean

	// Typing indicators (Phase 5H)
	typingUsers: Record<string, { userId: string; username: string; expiresAt: number }[]>

	// Stats
	eventCount: number
	lastHeartbeat: number | null
}

// Action types
type SessionAction =
	| { type: 'SET_SESSION_ID'; payload: string }
	| { type: 'SET_CONNECTING'; payload: boolean }
	| { type: 'SET_CONNECTED'; payload: boolean }
	| { type: 'SET_ERROR'; payload: string | null }
	| { type: 'HANDLE_STATE_SYNC'; payload: StateSyncPayload }
	| { type: 'HANDLE_MESSAGE_CREATE'; payload: StageMessageCreateData }
	| { type: 'HANDLE_MESSAGE_UPDATE'; payload: { channelId: string; message: StageMessage } }
	| { type: 'HANDLE_MESSAGE_DELETE'; payload: { channelId: string; messageId: string } }
	| { type: 'HANDLE_TYPING_START'; payload: { channelId: string; userId: string; username: string } }
	| { type: 'SELECT_GUILD'; payload: string | null }
	| { type: 'SELECT_CHANNEL'; payload: string | null }
	| { type: 'TOGGLE_MEMBERS' }
	| { type: 'INCREMENT_EVENT_COUNT' }
	| { type: 'SET_HEARTBEAT'; payload: number }
	| { type: 'RESET' }

// Initial state
const initialState: SessionState = {
	sessionId: null,
	isConnected: false,
	isConnecting: false,
	error: null,
	guilds: [],
	channels: [],
	members: [],
	roles: [],
	users: [],
	messages: {},
	commands: [],
	botUser: null,
	selectedGuildId: null,
	selectedChannelId: null,
	showMembers: true,
	typingUsers: {},
	eventCount: 0,
	lastHeartbeat: null
}

// Reducer
function sessionReducer(state: SessionState, action: SessionAction): SessionState {
	switch (action.type) {
		case 'SET_SESSION_ID':
			return { ...state, sessionId: action.payload }

		case 'SET_CONNECTING':
			return { ...state, isConnecting: action.payload, error: null }

		case 'SET_CONNECTED':
			return { ...state, isConnected: action.payload, isConnecting: false }

		case 'SET_ERROR':
			return { ...state, error: action.payload, isConnecting: false, isConnected: false }

		case 'HANDLE_STATE_SYNC': {
			const { session, guilds, channels, members, roles, messages, users, commands } = action.payload
			const firstGuild = guilds[0]
			const firstChannel = firstGuild ? channels.find((c) => c.guild_id === firstGuild.id) : null

			return {
				...state,
				guilds,
				channels,
				members,
				roles: roles || [],
				users,
				messages,
				commands: commands || [],
				botUser: session.bot,
				selectedGuildId: state.selectedGuildId || firstGuild?.id || null,
				selectedChannelId: state.selectedChannelId || firstChannel?.id || null,
				eventCount: state.eventCount + 1
			}
		}

		case 'HANDLE_MESSAGE_CREATE': {
			const { message } = action.payload
			const channelId = message.channel_id
			const existingMessages = state.messages[channelId] || []

			return {
				...state,
				messages: {
					...state.messages,
					[channelId]: [...existingMessages, message].slice(-100) // Keep last 100 messages
				},
				eventCount: state.eventCount + 1
			}
		}

		case 'HANDLE_MESSAGE_UPDATE': {
			const { channelId, message } = action.payload
			const existingMessages = state.messages[channelId] || []

			return {
				...state,
				messages: {
					...state.messages,
					[channelId]: existingMessages.map((m) => (m.id === message.id ? message : m))
				},
				eventCount: state.eventCount + 1
			}
		}

		case 'HANDLE_MESSAGE_DELETE': {
			const { channelId, messageId } = action.payload
			const existingMessages = state.messages[channelId] || []

			return {
				...state,
				messages: {
					...state.messages,
					[channelId]: existingMessages.filter((m) => m.id !== messageId)
				},
				eventCount: state.eventCount + 1
			}
		}

		case 'HANDLE_TYPING_START': {
			const { channelId, userId, username } = action.payload
			const existingTyping = state.typingUsers[channelId] || []
			const expiresAt = Date.now() + 10000  // 10 second timeout

			// Update or add typing user
			const filtered = existingTyping.filter((t) => t.userId !== userId)
			const newTyping = [...filtered, { userId, username, expiresAt }]

			return {
				...state,
				typingUsers: {
					...state.typingUsers,
					[channelId]: newTyping
				},
				eventCount: state.eventCount + 1
			}
		}

		case 'SELECT_GUILD': {
			const guildId = action.payload
			// When selecting a guild, auto-select first text channel
			const firstChannel = guildId ? state.channels.find((c) => c.guild_id === guildId && c.type === 0) : null

			return {
				...state,
				selectedGuildId: guildId,
				selectedChannelId: firstChannel?.id || null
			}
		}

		case 'SELECT_CHANNEL':
			return { ...state, selectedChannelId: action.payload }

		case 'TOGGLE_MEMBERS':
			return { ...state, showMembers: !state.showMembers }

		case 'INCREMENT_EVENT_COUNT':
			return { ...state, eventCount: state.eventCount + 1 }

		case 'SET_HEARTBEAT':
			return { ...state, lastHeartbeat: action.payload }

		case 'RESET':
			return { ...initialState, sessionId: state.sessionId }

		default:
			return state
	}
}

// Context
const SessionContext = createContext<{
	state: SessionState
	dispatch: Dispatch<SessionAction>
} | null>(null)

// Provider
interface SessionProviderProps {
	children: ReactNode
	initialSessionId?: string | null
}

export function SessionProvider({ children, initialSessionId = null }: SessionProviderProps) {
	const [state, dispatch] = useReducer(sessionReducer, {
		...initialState,
		sessionId: initialSessionId
	})

	return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>
}

// Hook
export function useSessionStore() {
	const context = useContext(SessionContext)
	if (!context) {
		throw new Error('useSessionStore must be used within a SessionProvider')
	}
	return context
}

// Convenience selectors
export function useSession() {
	const { state } = useSessionStore()
	return state
}

export function useSessionDispatch() {
	const { dispatch } = useSessionStore()
	return dispatch
}

// ============================================================================
// WebSocket Context - Shared WebSocket connection
// ============================================================================

interface WebSocketContextValue {
	connect: () => void
	disconnect: () => void
	sendCommand: <T = unknown>(type: string, data: unknown) => Promise<T>
	isConnected: boolean
	isConnecting: boolean
	error: string | null
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null)

interface WebSocketProviderProps {
	children: ReactNode
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
	const { state, dispatch } = useSessionStore()
	const wsRef = useRef<WebSocket | null>(null)
	const reconnectTimeoutRef = useRef<number | null>(null)
	const reconnectAttempts = useRef(0)
	const pendingCommands = useRef<Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }>>(
		new Map()
	)

	const [isConnected, setIsConnected] = useState(false)
	const [isConnecting, setIsConnecting] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Handle incoming events
	const handleEvent = useCallback(
		(event: StageEvent) => {
			switch (event.type) {
				case 'connected':
					dispatch({ type: 'SET_CONNECTED', payload: true })
					break

				case 'state_sync':
					dispatch({ type: 'HANDLE_STATE_SYNC', payload: event.data as StateSyncPayload })
					break

				case 'message_create':
					dispatch({ type: 'HANDLE_MESSAGE_CREATE', payload: event.data as StageMessageCreateData })
					break

				case 'message_update': {
					const updateData = event.data as { message: StageMessage }
					dispatch({
						type: 'HANDLE_MESSAGE_UPDATE',
						payload: {
							channelId: updateData.message.channel_id,
							message: updateData.message
						}
					})
					break
				}

				case 'message_delete': {
					const deleteData = event.data as { channel_id: string; message_id: string }
					dispatch({
						type: 'HANDLE_MESSAGE_DELETE',
						payload: { channelId: deleteData.channel_id, messageId: deleteData.message_id }
					})
					break
				}

				case 'typing_start': {
					const typingData = event.data as { channel_id: string; user_id: string; member?: { nick?: string }; user?: { username: string } }
					dispatch({
						type: 'HANDLE_TYPING_START',
						payload: {
							channelId: typingData.channel_id,
							userId: typingData.user_id,
							username: typingData.member?.nick || typingData.user?.username || 'Someone'
						}
					})
					break
				}

				case 'command_response': {
					const responseData = event.data as { command_id: string; success: boolean; result?: unknown; error?: string }
					const pending = pendingCommands.current.get(responseData.command_id)
					if (pending) {
						pendingCommands.current.delete(responseData.command_id)
						if (responseData.success) {
							pending.resolve(responseData.result)
						} else {
							pending.reject(new Error(responseData.error || 'Command failed'))
						}
					}
					break
				}

				case 'heartbeat':
					dispatch({ type: 'SET_HEARTBEAT', payload: Date.now() })
					break

				case 'error': {
					const errorData = event.data as { message: string }
					setError(errorData.message)
					break
				}

				default:
					dispatch({ type: 'INCREMENT_EVENT_COUNT' })
			}
		},
		[dispatch]
	)

	// Connect to WebSocket
	const connect = useCallback(() => {
		if (!state.sessionId) {
			setError('No session ID provided')
			return
		}

		if (wsRef.current?.readyState === WebSocket.OPEN) {
			return // Already connected
		}

		setIsConnecting(true)
		setError(null)
		dispatch({ type: 'SET_CONNECTING', payload: true })

		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
		const host = window.location.host
		const token = state.sessionId.startsWith('mock:') ? state.sessionId : `mock:${state.sessionId}`

		// Detect prefix from current page URL (e.g., /mock/stage -> /mock/stage/ws)
		const pathname = window.location.pathname
		const stageIndex = pathname.indexOf('/stage')
		const basePath = stageIndex !== -1 ? pathname.slice(0, stageIndex + '/stage'.length) : '/stage'
		const url = `${protocol}//${host}${basePath}/ws?token=${encodeURIComponent(token)}`

		const ws = new WebSocket(url)
		wsRef.current = ws

		ws.onopen = () => {
			setIsConnected(true)
			setIsConnecting(false)
			setError(null)
			reconnectAttempts.current = 0
			dispatch({ type: 'SET_CONNECTED', payload: true })
		}

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as StageEvent
				handleEvent(data)
			} catch (e) {
				console.error('[Stage] Failed to parse WebSocket message:', e)
			}
		}

		ws.onclose = (event) => {
			setIsConnected(false)
			wsRef.current = null
			dispatch({ type: 'SET_CONNECTED', payload: false })

			// Reconnect with exponential backoff unless intentionally closed
			if (event.code !== 1000 && state.sessionId) {
				const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000)
				reconnectAttempts.current++

				reconnectTimeoutRef.current = window.setTimeout(() => {
					connect()
				}, delay)
			}
		}

		ws.onerror = () => {
			setError('Connection failed')
			setIsConnecting(false)
			dispatch({ type: 'SET_ERROR', payload: 'Connection failed' })
		}
	}, [state.sessionId, dispatch, handleEvent])

	// Disconnect from WebSocket
	const disconnect = useCallback(() => {
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current)
			reconnectTimeoutRef.current = null
		}

		if (wsRef.current) {
			wsRef.current.close(1000, 'Client disconnected')
			wsRef.current = null
		}

		setIsConnected(false)
		setIsConnecting(false)
		dispatch({ type: 'SET_CONNECTED', payload: false })
	}, [dispatch])

	// Send command and wait for response
	const sendCommand = useCallback(<T = unknown>(type: string, data: unknown): Promise<T> => {
		return new Promise((resolve, reject) => {
			if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
				reject(new Error('Not connected'))
				return
			}

			const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2)}`

			const command: StageCommand = { id, type: type as StageCommand['type'], data }

			pendingCommands.current.set(id, {
				resolve: resolve as (value: unknown) => void,
				reject
			})

			wsRef.current.send(JSON.stringify(command))

			// Timeout after 30s
			setTimeout(() => {
				if (pendingCommands.current.has(id)) {
					pendingCommands.current.delete(id)
					reject(new Error('Command timeout'))
				}
			}, 30000)
		})
	}, [])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			disconnect()
		}
	}, [disconnect])

	// Auto-connect when session ID is available (e.g., from URL params)
	useEffect(() => {
		if (state.sessionId && !isConnected && !isConnecting) {
			connect()
		}
	}, [state.sessionId, isConnected, isConnecting, connect])

	const value: WebSocketContextValue = {
		connect,
		disconnect,
		sendCommand,
		isConnected,
		isConnecting,
		error
	}

	return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket() {
	const context = useContext(WebSocketContext)
	if (!context) {
		throw new Error('useWebSocket must be used within a WebSocketProvider')
	}
	return context
}
