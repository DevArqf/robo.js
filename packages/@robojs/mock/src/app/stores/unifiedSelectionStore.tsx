import { createContext, useContext, useReducer, useCallback, useEffect, type ReactNode, type Dispatch } from 'react'
import { usePlayback } from './playbackStore'

// ============================================================================
// Types
// ============================================================================

/**
 * Unified selection state that works for both live and playback modes.
 * This is the single source of truth for what guild/channel is selected.
 */
export interface UnifiedSelectionState {
	/** Currently selected guild ID */
	selectedGuildId: string | null
	/** Currently selected channel ID */
	selectedChannelId: string | null
	/** Preserved live selection for restoration when exiting playback */
	liveGuildId: string | null
	liveChannelId: string | null
}

// ============================================================================
// Actions
// ============================================================================

type SelectionAction =
	| { type: 'SELECT_GUILD'; payload: string | null }
	| { type: 'SELECT_CHANNEL'; payload: string | null }
	| { type: 'SAVE_LIVE_SELECTION' }
	| { type: 'RESTORE_LIVE_SELECTION' }
	| { type: 'SET_SELECTION'; payload: { guildId: string | null; channelId: string | null } }

// ============================================================================
// Initial State
// ============================================================================

const initialState: UnifiedSelectionState = {
	selectedGuildId: null,
	selectedChannelId: null,
	liveGuildId: null,
	liveChannelId: null
}

// ============================================================================
// Reducer
// ============================================================================

function selectionReducer(state: UnifiedSelectionState, action: SelectionAction): UnifiedSelectionState {
	switch (action.type) {
		case 'SELECT_GUILD':
			return {
				...state,
				selectedGuildId: action.payload,
				// Clear channel when guild changes
				selectedChannelId: null
			}

		case 'SELECT_CHANNEL':
			return {
				...state,
				selectedChannelId: action.payload
			}

		case 'SAVE_LIVE_SELECTION':
			return {
				...state,
				liveGuildId: state.selectedGuildId,
				liveChannelId: state.selectedChannelId
			}

		case 'RESTORE_LIVE_SELECTION':
			return {
				...state,
				selectedGuildId: state.liveGuildId,
				selectedChannelId: state.liveChannelId
			}

		case 'SET_SELECTION':
			return {
				...state,
				selectedGuildId: action.payload.guildId,
				selectedChannelId: action.payload.channelId
			}

		default:
			return state
	}
}

// ============================================================================
// Context
// ============================================================================

interface SelectionContextValue {
	state: UnifiedSelectionState
	dispatch: Dispatch<SelectionAction>
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface UnifiedSelectionProviderProps {
	children: ReactNode
}

export function UnifiedSelectionProvider({ children }: UnifiedSelectionProviderProps) {
	const [state, dispatch] = useReducer(selectionReducer, initialState)
	const playbackState = usePlayback()

	// Save live selection when entering playback mode
	// Restore when exiting playback mode
	useEffect(() => {
		// This effect doesn't auto-select - that's handled by useStageData
		// It only saves/restores the live selection on mode change
	}, [playbackState.mode])

	return <SelectionContext.Provider value={{ state, dispatch }}>{children}</SelectionContext.Provider>
}

// ============================================================================
// Hooks
// ============================================================================

function useSelectionStore() {
	const context = useContext(SelectionContext)
	if (!context) {
		throw new Error('useSelectionStore must be used within a UnifiedSelectionProvider')
	}
	return context
}

/**
 * Hook for accessing and modifying the unified selection state.
 * This should be used by useStageData internally.
 */
export function useUnifiedSelection() {
	const { state, dispatch } = useSelectionStore()

	const selectGuild = useCallback(
		(guildId: string | null) => {
			dispatch({ type: 'SELECT_GUILD', payload: guildId })
		},
		[dispatch]
	)

	const selectChannel = useCallback(
		(channelId: string | null) => {
			dispatch({ type: 'SELECT_CHANNEL', payload: channelId })
		},
		[dispatch]
	)

	const setSelection = useCallback(
		(guildId: string | null, channelId: string | null) => {
			dispatch({ type: 'SET_SELECTION', payload: { guildId, channelId } })
		},
		[dispatch]
	)

	const saveLiveSelection = useCallback(() => {
		dispatch({ type: 'SAVE_LIVE_SELECTION' })
	}, [dispatch])

	const restoreLiveSelection = useCallback(() => {
		dispatch({ type: 'RESTORE_LIVE_SELECTION' })
	}, [dispatch])

	return {
		// State
		selectedGuildId: state.selectedGuildId,
		selectedChannelId: state.selectedChannelId,
		liveGuildId: state.liveGuildId,
		liveChannelId: state.liveChannelId,

		// Actions
		selectGuild,
		selectChannel,
		setSelection,
		saveLiveSelection,
		restoreLiveSelection
	}
}
