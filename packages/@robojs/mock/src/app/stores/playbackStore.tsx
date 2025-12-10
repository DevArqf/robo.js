import { createContext, useContext, useReducer, useRef, useCallback, useEffect, useMemo, type ReactNode, type Dispatch } from 'react'
import type { StageEventType, StageMessage, StageMessageCreateData, StageChannel, StageMember, StateSyncPayload } from '../types/stage'

// ============================================================================
// Playback Types
// ============================================================================

/**
 * A recorded event for playback
 */
export interface RecordedEvent {
	id: string
	seq: number
	type: StageEventType
	timestamp: number
	data: unknown
}

/**
 * Playback state shape
 */
export interface PlaybackState {
	/** Current mode - live records events, playback replays them */
	mode: 'live' | 'playback'
	/** Whether playback is currently running */
	isPlaying: boolean
	/** Current playback position in ms from first event */
	currentTime: number
	/** Total duration of recording in ms */
	duration: number
	/** Playback speed multiplier */
	speed: number
	/** All recorded events */
	events: RecordedEvent[]
}

// ============================================================================
// Actions
// ============================================================================

type PlaybackAction =
	| { type: 'SET_MODE'; payload: 'live' | 'playback' }
	| { type: 'SET_PLAYING'; payload: boolean }
	| { type: 'SEEK'; payload: number }
	| { type: 'SET_SPEED'; payload: number }
	| { type: 'ADD_EVENT'; payload: RecordedEvent }
	| { type: 'ADD_EVENTS'; payload: RecordedEvent[] }
	| { type: 'CLEAR_EVENTS' }
	| { type: 'UPDATE_TIME'; payload: number }

// ============================================================================
// Initial State
// ============================================================================

const initialState: PlaybackState = {
	mode: 'live',
	isPlaying: false,
	currentTime: 0,
	duration: 0,
	speed: 1,
	events: []
}

// ============================================================================
// Reducer
// ============================================================================

function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
	switch (action.type) {
		case 'SET_MODE': {
			const mode = action.payload
			if (mode === 'playback' && state.events.length > 0) {
				// When switching to playback, calculate duration and reset position
				const firstTimestamp = state.events[0].timestamp
				const lastTimestamp = state.events[state.events.length - 1].timestamp
				return {
					...state,
					mode,
					isPlaying: false,
					currentTime: 0,
					duration: lastTimestamp - firstTimestamp
				}
			}
			return { ...state, mode, isPlaying: false }
		}

		case 'SET_PLAYING':
			// Only allow playing in playback mode with events
			if (state.mode !== 'playback' || state.events.length === 0) {
				return state
			}
			return { ...state, isPlaying: action.payload }

		case 'SEEK': {
			const time = Math.max(0, Math.min(action.payload, state.duration))
			return { ...state, currentTime: time }
		}

		case 'SET_SPEED':
			return { ...state, speed: action.payload }

		case 'ADD_EVENT': {
			// Only record in live mode
			if (state.mode !== 'live') {
				return state
			}
			const newEvents = [...state.events, action.payload]
			const duration =
				newEvents.length > 1 ? newEvents[newEvents.length - 1].timestamp - newEvents[0].timestamp : 0
			return { ...state, events: newEvents, duration }
		}

		case 'ADD_EVENTS': {
			const newEvents = [...state.events, ...action.payload]
			const duration =
				newEvents.length > 1 ? newEvents[newEvents.length - 1].timestamp - newEvents[0].timestamp : 0
			return { ...state, events: newEvents, duration }
		}

		case 'CLEAR_EVENTS':
			return { ...state, events: [], duration: 0, currentTime: 0, isPlaying: false }

		case 'UPDATE_TIME': {
			const newTime = action.payload
			// Auto-pause at end
			if (newTime >= state.duration) {
				return { ...state, currentTime: state.duration, isPlaying: false }
			}
			return { ...state, currentTime: newTime }
		}

		default:
			return state
	}
}

// ============================================================================
// Context
// ============================================================================

interface PlaybackContextValue {
	state: PlaybackState
	dispatch: Dispatch<PlaybackAction>
}

const PlaybackContext = createContext<PlaybackContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface PlaybackProviderProps {
	children: ReactNode
}

export function PlaybackProvider({ children }: PlaybackProviderProps) {
	const [state, dispatch] = useReducer(playbackReducer, initialState)
	const lastFrameTimeRef = useRef<number | null>(null)
	const animationFrameRef = useRef<number | null>(null)
	const currentTimeRef = useRef(state.currentTime)
	const speedRef = useRef(state.speed)

	// Keep refs in sync with state (for use in animation loop without causing re-initialization)
	useEffect(() => {
		currentTimeRef.current = state.currentTime
	}, [state.currentTime])

	useEffect(() => {
		speedRef.current = state.speed
	}, [state.speed])

	// Playback animation loop - only depends on isPlaying to avoid re-initialization
	useEffect(() => {
		if (!state.isPlaying) {
			lastFrameTimeRef.current = null
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
				animationFrameRef.current = null
			}
			return
		}

		const tick = (frameTime: number) => {
			if (lastFrameTimeRef.current !== null) {
				const delta = (frameTime - lastFrameTimeRef.current) * speedRef.current
				const newTime = currentTimeRef.current + delta

				dispatch({ type: 'UPDATE_TIME', payload: newTime })
			}

			lastFrameTimeRef.current = frameTime
			animationFrameRef.current = requestAnimationFrame(tick)
		}

		animationFrameRef.current = requestAnimationFrame(tick)

		return () => {
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current)
			}
		}
	}, [state.isPlaying])

	return <PlaybackContext.Provider value={{ state, dispatch }}>{children}</PlaybackContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

export function usePlaybackStore() {
	const context = useContext(PlaybackContext)
	if (!context) {
		throw new Error('usePlaybackStore must be used within a PlaybackProvider')
	}
	return context
}

export function usePlayback() {
	const { state } = usePlaybackStore()
	return state
}

export function usePlaybackDispatch() {
	const { dispatch } = usePlaybackStore()
	return dispatch
}

/**
 * Hook providing playback state and actions
 */
export function usePlaybackControls() {
	const { state, dispatch } = usePlaybackStore()

	const setMode = useCallback(
		(mode: 'live' | 'playback') => {
			dispatch({ type: 'SET_MODE', payload: mode })
		},
		[dispatch]
	)

	const togglePlay = useCallback(() => {
		dispatch({ type: 'SET_PLAYING', payload: !state.isPlaying })
	}, [dispatch, state.isPlaying])

	const play = useCallback(() => {
		dispatch({ type: 'SET_PLAYING', payload: true })
	}, [dispatch])

	const pause = useCallback(() => {
		dispatch({ type: 'SET_PLAYING', payload: false })
	}, [dispatch])

	const seek = useCallback(
		(time: number) => {
			dispatch({ type: 'SEEK', payload: time })
		},
		[dispatch]
	)

	const setSpeed = useCallback(
		(speed: number) => {
			dispatch({ type: 'SET_SPEED', payload: speed })
		},
		[dispatch]
	)

	const addEvent = useCallback(
		(event: RecordedEvent) => {
			dispatch({ type: 'ADD_EVENT', payload: event })
		},
		[dispatch]
	)

	const addEvents = useCallback(
		(events: RecordedEvent[]) => {
			dispatch({ type: 'ADD_EVENTS', payload: events })
		},
		[dispatch]
	)

	const clearEvents = useCallback(() => {
		dispatch({ type: 'CLEAR_EVENTS' })
	}, [dispatch])

	// Get events that have occurred up to currentTime
	const getEventsAtCurrentTime = useCallback(() => {
		if (state.events.length === 0) return []
		const startTimestamp = state.events[0].timestamp
		const currentTimestamp = startTimestamp + state.currentTime
		return state.events.filter((e) => e.timestamp <= currentTimestamp)
	}, [state.events, state.currentTime])

	// Get significant event markers for timeline
	const getEventMarkers = useCallback(() => {
		if (state.events.length === 0) return []
		const startTimestamp = state.events[0].timestamp
		const significantTypes: StageEventType[] = ['message_create', 'interaction_create', 'interaction_response', 'typing_start']

		return state.events
			.filter((e) => significantTypes.includes(e.type))
			.map((e) => ({
				time: e.timestamp - startTimestamp,
				type: e.type,
				label: getEventLabel(e)
			}))
	}, [state.events])

	return {
		// State
		mode: state.mode,
		isPlaying: state.isPlaying,
		currentTime: state.currentTime,
		duration: state.duration,
		speed: state.speed,
		events: state.events,
		eventCount: state.events.length,

		// Actions
		setMode,
		togglePlay,
		play,
		pause,
		seek,
		setSpeed,
		addEvent,
		addEvents,
		clearEvents,

		// Derived
		getEventsAtCurrentTime,
		getEventMarkers
	}
}

// ============================================================================
// Helpers
// ============================================================================

function getEventLabel(event: RecordedEvent): string {
	switch (event.type) {
		case 'message_create': {
			const data = event.data as { message?: { content?: string; author?: { username?: string } } }
			const author = data?.message?.author?.username || 'User'
			const content = data?.message?.content || ''
			const preview = content.slice(0, 25) + (content.length > 25 ? '...' : '')
			return `${author}: ${preview}`
		}
		case 'interaction_create': {
			const data = event.data as { interaction?: { name?: string } }
			return `/${data?.interaction?.name || 'command'}`
		}
		case 'interaction_response':
			return 'Bot Response'
		case 'typing_start': {
			const data = event.data as { user?: { username?: string } }
			return `${data?.user?.username || 'User'} typing...`
		}
		default:
			return event.type
	}
}

/**
 * Format milliseconds as MM:SS
 */
export function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000)
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Hook that provides messages filtered by playback time and channel.
 * When in live mode, returns null (use normal session messages).
 * When in playback mode, reconstructs the message state based on recorded events up to currentTime.
 *
 * Messages are filtered by channel_id so each channel shows only its own messages.
 */
export function usePlaybackMessages(channelId: string | null): StageMessage[] | null {
	const { state } = usePlaybackStore()

	return useMemo(() => {
		// In live mode, return null to signal "use normal session messages"
		if (state.mode === 'live' || state.events.length === 0) {
			return null
		}

		// Get the timestamp cutoff for current playback position
		const startTimestamp = state.events[0].timestamp
		const currentTimestamp = startTimestamp + state.currentTime

		// Filter events up to current time
		const eventsAtTime = state.events.filter((e) => e.timestamp <= currentTimestamp)

		// Build message state from events
		const messages: Map<string, StageMessage> = new Map()

		for (const event of eventsAtTime) {
			switch (event.type) {
				case 'message_create': {
					const data = event.data as StageMessageCreateData
					if (data?.message) {
						// Only add messages that belong to the selected channel
						// (or all messages if no channel is selected)
						if (!channelId || data.message.channel_id === channelId) {
							messages.set(data.message.id, data.message)
						}
					}
					break
				}
				case 'message_update': {
					const data = event.data as { message: StageMessage }
					if (data?.message && messages.has(data.message.id)) {
						messages.set(data.message.id, data.message)
					}
					break
				}
				case 'message_delete': {
					const data = event.data as { message_id: string }
					if (data?.message_id) {
						messages.delete(data.message_id)
					}
					break
				}
				case 'message_reaction_add': {
					const data = event.data as {
						channel_id: string
						message_id: string
						emoji: { id: string | null; name: string }
					}
					const msg = messages.get(data?.message_id)
					if (msg && data?.emoji) {
						const reactions = [...(msg.reactions || [])]
						const emojiKey = data.emoji.id || data.emoji.name
						const existingIdx = reactions.findIndex((r) => (r.emoji.id || r.emoji.name) === emojiKey)
						if (existingIdx >= 0) {
							reactions[existingIdx] = { ...reactions[existingIdx], count: reactions[existingIdx].count + 1 }
						} else {
							reactions.push({ count: 1, me: true, emoji: data.emoji })
						}
						messages.set(msg.id, { ...msg, reactions })
					}
					break
				}
				case 'message_reaction_remove': {
					const data = event.data as {
						channel_id: string
						message_id: string
						emoji: { id: string | null; name: string }
					}
					const msg = messages.get(data?.message_id)
					if (msg && data?.emoji) {
						const reactions = [...(msg.reactions || [])]
						const emojiKey = data.emoji.id || data.emoji.name
						const updated = reactions
							.map((r) => {
								if ((r.emoji.id || r.emoji.name) !== emojiKey) return r
								return r.count > 1 ? { ...r, count: r.count - 1 } : null
							})
							.filter(Boolean) as typeof reactions
						messages.set(msg.id, { ...msg, reactions: updated })
					}
					break
				}
			}
		}

		// Return sorted by message ID (which is a snowflake, so chronological)
		return Array.from(messages.values()).sort((a, b) => {
			// Snowflakes can be compared as strings for chronological order
			return a.id.localeCompare(b.id)
		})
	}, [state.mode, state.events, state.currentTime, channelId])
}

/**
 * Hook that returns whether playback mode is active
 */
export function useIsPlaybackMode(): boolean {
	const { state } = usePlaybackStore()
	return state.mode === 'playback'
}

/**
 * Typing user structure matching TypingIndicator component
 */
interface PlaybackTypingUser {
	userId: string
	username: string
	expiresAt: number
}

/**
 * Hook that provides typing users based on playback time.
 * When in live mode, returns null (use normal session typing users).
 * When in playback mode, reconstructs typing state from recorded events.
 *
 * Typing indicators last for 10 seconds from their event timestamp.
 */
export function usePlaybackTypingUsers(channelId: string | null): PlaybackTypingUser[] | null {
	const { state } = usePlaybackStore()

	return useMemo(() => {
		// In live mode, return null to signal "use normal session typing users"
		if (state.mode === 'live' || state.events.length === 0 || !channelId) {
			return null
		}

		// Get the timestamp cutoff for current playback position
		const startTimestamp = state.events[0].timestamp
		const currentTimestamp = startTimestamp + state.currentTime

		// Typing indicator duration (10 seconds)
		const TYPING_DURATION = 10000

		// Current real-world time (for converting expiresAt)
		const now = Date.now()

		// Find typing_start events within the last 10 seconds of playback time
		const typingUsers: Map<string, PlaybackTypingUser> = new Map()

		for (const event of state.events) {
			if (event.type !== 'typing_start') continue
			if (event.timestamp > currentTimestamp) continue // Event hasn't happened yet

			const data = event.data as {
				user?: { id: string; username: string }
				user_id?: string
				channel_id?: string
			}

			// Check if this typing event is still "active" (within 10 seconds)
			const timeSinceEvent = currentTimestamp - event.timestamp
			if (timeSinceEvent > TYPING_DURATION) continue // Expired

			// In playback mode, show typing from any channel (test data uses fake channel IDs)
			const user = data?.user
			const userId = user?.id || data?.user_id
			const username = user?.username || 'User'

			if (userId) {
				// Calculate remaining time in playback and convert to real-world expiresAt
				const remainingTime = TYPING_DURATION - timeSinceEvent
				typingUsers.set(userId, {
					userId,
					username,
					expiresAt: now + remainingTime
				})
			}
		}

		return Array.from(typingUsers.values())
	}, [state.mode, state.events, state.currentTime, channelId])
}

/**
 * Hook that provides channels based on playback time.
 * When in live mode, returns null (use normal session channels).
 * When in playback mode, reconstructs channel state from state_sync event.
 *
 * Note: Currently only extracts from state_sync since channel_create/delete events
 * are not part of the current protocol. Channels appear at the time of state_sync.
 */
export function usePlaybackChannels(guildId: string | null): StageChannel[] | null {
	const { state } = usePlaybackStore()

	return useMemo(() => {
		// In live mode, return null to signal "use normal session channels"
		if (state.mode === 'live' || state.events.length === 0) {
			return null
		}

		// Get the timestamp cutoff for current playback position
		const startTimestamp = state.events[0].timestamp
		const currentTimestamp = startTimestamp + state.currentTime

		// Find the most recent state_sync event up to current time
		let channels: StageChannel[] = []

		for (const event of state.events) {
			if (event.timestamp > currentTimestamp) break

			if (event.type === 'state_sync') {
				const data = event.data as StateSyncPayload
				if (data?.channels) {
					channels = data.channels
				}
			}
		}

		// Filter by guild if specified
		if (guildId) {
			return channels.filter(c => c.guild_id === guildId)
		}

		return channels
	}, [state.mode, state.events, state.currentTime, guildId])
}

/**
 * Hook that provides members based on playback time.
 * When in live mode, returns null (use normal session members).
 * When in playback mode, reconstructs member state from state_sync event.
 *
 * Note: Currently only extracts from state_sync since member_add/remove events
 * are not part of the current protocol. Members appear at the time of state_sync.
 */
export function usePlaybackMembers(guildId: string | null): StageMember[] | null {
	const { state } = usePlaybackStore()

	return useMemo(() => {
		// In live mode, return null to signal "use normal session members"
		if (state.mode === 'live' || state.events.length === 0) {
			return null
		}

		// Get the timestamp cutoff for current playback position
		const startTimestamp = state.events[0].timestamp
		const currentTimestamp = startTimestamp + state.currentTime

		// Find the most recent state_sync event up to current time
		let members: StageMember[] = []

		for (const event of state.events) {
			if (event.timestamp > currentTimestamp) break

			if (event.type === 'state_sync') {
				const data = event.data as StateSyncPayload
				if (data?.members) {
					members = data.members
				}
			}
		}

		// Filter by guild if specified
		if (guildId) {
			return members.filter(m => m.guild_id === guildId)
		}

		return members
	}, [state.mode, state.events, state.currentTime, guildId])
}
