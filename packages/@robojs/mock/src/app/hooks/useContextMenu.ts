import { useState, useCallback } from 'react'
import type { StageMessage, StageUser } from '../types/stage'

export interface ContextMenuState {
	type: 'user' | 'message'
	targetId: string
	targetData: StageMessage | StageUser
	position: { x: number; y: number }
}

/**
 * Hook to manage context menu state for right-click interactions.
 * Provides methods to show/hide the context menu and track its state.
 */
export function useContextMenu() {
	const [menu, setMenu] = useState<ContextMenuState | null>(null)

	const showMenu = useCallback(
		(
			type: 'user' | 'message',
			targetId: string,
			targetData: StageMessage | StageUser,
			position: { x: number; y: number }
		) => {
			setMenu({ type, targetId, targetData, position })
		},
		[]
	)

	const hideMenu = useCallback(() => {
		setMenu(null)
	}, [])

	return { menu, showMenu, hideMenu }
}
