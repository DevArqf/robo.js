import { useCallback, useMemo } from 'react'
import { useSession as useSessionState, useSessionDispatch, useWebSocket } from '../stores/sessionStore'
import type { StageUser, StageActivity } from '../types/stage'

// ============================================================================
// Simple User Lookup Hook
// ============================================================================

/**
 * Look up a user by ID from the session state.
 * Returns the latest user data, making user display reactive to changes.
 *
 * @param userId - The user ID to look up
 * @param fallback - Optional fallback user data if not found in state
 * @returns The user from state, or the fallback, or undefined
 */
export function useUserById(userId: string, fallback?: Partial<StageUser>): StageUser | undefined {
	const state = useSessionState()

	return useMemo(() => {
		// First check if it's the currentUser (most common case for "my" messages)
		if (state.currentUser?.id === userId) {
			return state.currentUser
		}
		// Then check the users array
		const found = state.users.find(u => u.id === userId)
		if (found) return found
		// Fall back to provided data if available
		if (fallback) {
			return {
				id: userId,
				username: fallback.username ?? 'Unknown',
				avatar: fallback.avatar ?? null,
				bot: fallback.bot ?? false,
				...fallback
			} as StageUser
		}
		return undefined
	}, [state.currentUser, state.users, userId, fallback])
}

// ============================================================================
// Types
// ============================================================================

export interface CurrentUserSettings {
	username?: string
	avatar?: string | null
	status?: 'online' | 'offline' | 'idle' | 'dnd'
	activities?: StageActivity[]
}

export interface UseCurrentUserResult {
	/** The current acting user for Stage UI interactions */
	currentUser: StageUser | null
	/** Whether the current user has been loaded from the server */
	isLoaded: boolean
	/** Update the current user's properties */
	updateUser: (settings: CurrentUserSettings) => Promise<StageUser>
	/** Switch to a different existing user as the current user */
	switchUser: (userId: string) => Promise<StageUser>
	/** Create a new user and set them as the current user */
	createAndSwitchUser: (username: string, avatar?: string | null) => Promise<StageUser>
	/** Get all available users that can be switched to */
	availableUsers: StageUser[]
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing the current "acting" user in Stage UI.
 *
 * The current user represents the human using Stage - separate from the bot user.
 * All interactions (messages, commands, buttons, etc.) are sent as this user.
 *
 * @returns Current user state and management functions
 */
export function useCurrentUser(): UseCurrentUserResult {
	const state = useSessionState()
	const dispatch = useSessionDispatch()
	const { sendCommand, isConnected } = useWebSocket()

	// Get all non-bot users that can be switched to
	const availableUsers = state.users.filter(u => !u.bot)

	// Update current user properties
	const updateUser = useCallback(async (settings: CurrentUserSettings): Promise<StageUser> => {
		if (!isConnected) {
			throw new Error('Not connected to session')
		}

		const result = await sendCommand<{ user: StageUser }>('set_current_user', settings)

		// Update local state immediately for optimistic UI
		if (result?.user) {
			dispatch({ type: 'SET_CURRENT_USER', payload: result.user })
		}

		return result.user
	}, [isConnected, sendCommand, dispatch])

	// Switch to an existing user
	const switchUser = useCallback(async (userId: string): Promise<StageUser> => {
		if (!isConnected) {
			throw new Error('Not connected to session')
		}

		const result = await sendCommand<{ user: StageUser }>('switch_user', { user_id: userId })

		// Update local state immediately
		if (result?.user) {
			dispatch({ type: 'SET_CURRENT_USER', payload: result.user })
		}

		return result.user
	}, [isConnected, sendCommand, dispatch])

	// Create a new user and switch to them
	const createAndSwitchUser = useCallback(async (username: string, avatar?: string | null): Promise<StageUser> => {
		if (!isConnected) {
			throw new Error('Not connected to session')
		}

		// Use set_current_user with create_new flag
		const result = await sendCommand<{ user: StageUser }>('set_current_user', {
			username,
			avatar,
			create_new: true
		})

		// Update local state
		if (result?.user) {
			dispatch({ type: 'SET_CURRENT_USER', payload: result.user })
		}

		return result.user
	}, [isConnected, sendCommand, dispatch])

	return {
		currentUser: state.currentUser,
		isLoaded: state.currentUser !== null,
		updateUser,
		switchUser,
		createAndSwitchUser,
		availableUsers
	}
}
