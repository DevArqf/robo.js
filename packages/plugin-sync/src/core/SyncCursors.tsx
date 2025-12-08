import React from 'react'
import { useSyncCursor } from './useSyncCursor.js'
import type { CursorOptions, RemoteCursor } from './useSyncCursor.js'
import type { Client } from './types.js'

/**
 * Props for SyncCursors component.
 */
export interface SyncCursorsProps<ClientData = unknown> {
	/** Room key for cursor synchronization */
	roomKey: (string | null)[]
	/** Milliseconds between cursor updates (default: 16) */
	throttle?: number
	/** Custom cursor renderer */
	renderCursor?: (cursor: RemoteCursor<ClientData>) => React.ReactNode
	/** Default style for cursor wrapper */
	defaultCursorStyle?: React.CSSProperties
	/** Show user labels next to cursors (default: true) */
	showLabels?: boolean
	/** Key to use for label from client data, or function to extract label */
	labelKey?: keyof ClientData | ((client: Client<ClientData>) => string)
	/** Color function to generate cursor color from client ID */
	colorFn?: (clientId: string) => string
	/** Z-index for cursor container (default: 9999) */
	zIndex?: number
}

// Default color generator from client ID
function defaultColorFn(clientId: string): string {
	let hash = 0
	for (let i = 0; i < clientId.length; i++) {
		const char = clientId.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash
	}
	const hue = Math.abs(hash) % 360
	return `hsl(${hue}, 70%, 50%)`
}

// Default cursor SVG
function DefaultCursor({ color }: { color: string }) {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5.5 3.21V20.8C5.5 21.21 5.98 21.46 6.32 21.21L10.82 17.96C10.94 17.87 11.08 17.82 11.23 17.82H17.5C17.91 17.82 18.16 17.34 17.91 17L6.41 3.04C6.16 2.71 5.5 2.88 5.5 3.21Z"
				fill={color}
				stroke="white"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

// Default label renderer
function getDefaultLabel<ClientData>(client: Client<ClientData>, labelKey?: keyof ClientData | ((client: Client<ClientData>) => string)): string {
	if (typeof labelKey === 'function') {
		return labelKey(client)
	}
	if (labelKey && client.data) {
		const value = client.data[labelKey]
		if (typeof value === 'string') return value
	}
	// Try common keys
	const data = client.data as Record<string, unknown> | undefined
	if (data?.name && typeof data.name === 'string') return data.name
	if (data?.username && typeof data.username === 'string') return data.username
	if (data?.displayName && typeof data.displayName === 'string') return data.displayName
	// Fallback to shortened client ID
	return client.id.slice(0, 6)
}

/**
 * Pre-built component that renders all participant cursors automatically.
 *
 * Just drop it into your app and cursors will appear for all connected users.
 * Automatically handles mouse tracking, throttling, and smooth positioning.
 *
 * @example
 * function Activity() {
 *   return (
 *     <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
 *       <SyncCursors roomKey={['room', odId]} />
 *       {/* Your content *\/}
 *     </div>
 *   )
 * }
 *
 * @example
 * // With custom cursor rendering
 * <SyncCursors
 *   roomKey={['room', odId]}
 *   renderCursor={(cursor) => (
 *     <div style={{ color: cursor.user.data?.color }}>
 *       <CustomCursorIcon />
 *       <span>{cursor.user.data?.name}</span>
 *     </div>
 *   )}
 * />
 */
export function SyncCursors<ClientData = unknown>(props: SyncCursorsProps<ClientData>): React.ReactElement {
	const {
		roomKey,
		throttle,
		renderCursor,
		defaultCursorStyle,
		showLabels = true,
		labelKey,
		colorFn = defaultColorFn,
		zIndex = 9999
	} = props

	const cursorOptions: CursorOptions = {
		throttle,
		normalize: true,
		hideOnLeave: true,
		autoTrack: true
	}

	const { remoteCursors } = useSyncCursor<ClientData>(roomKey, cursorOptions)

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
				zIndex,
				overflow: 'hidden'
			}}
		>
			{remoteCursors.map((cursor) => {
				if (!cursor.position.active) return null

				const color = colorFn(cursor.clientId)
				const label = getDefaultLabel(cursor.user, labelKey)

				return (
					<div
						key={cursor.clientId}
						style={{
							position: 'absolute',
							left: `${cursor.position.x * 100}%`,
							top: `${cursor.position.y * 100}%`,
							transform: 'translate(-2px, -2px)',
							transition: 'left 50ms linear, top 50ms linear',
							...defaultCursorStyle
						}}
					>
						{renderCursor ? (
							renderCursor(cursor)
						) : (
							<>
								<DefaultCursor color={color} />
								{showLabels && (
									<div
										style={{
											position: 'absolute',
											top: '20px',
											left: '12px',
											backgroundColor: color,
											color: 'white',
											padding: '2px 6px',
											borderRadius: '4px',
											fontSize: '12px',
											fontWeight: 500,
											whiteSpace: 'nowrap',
											boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
										}}
									>
										{label}
									</div>
								)}
							</>
						)}
					</div>
				)
			})}
		</div>
	)
}
