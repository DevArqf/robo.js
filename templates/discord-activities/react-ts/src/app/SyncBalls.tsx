import { useSyncDrag } from '@robojs/sync'

interface BallState {
	x: number
	y: number
	hoverColor: string | null
	[key: string]: unknown
}

interface SyncBallsProps {
	roomKey: (string | null)[]
}

// Generate a color from a string (client ID)
function stringToColor(str: string): string {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash)
	}
	const hue = Math.abs(hash % 360)
	return `hsl(${hue}, 70%, 60%)`
}

const BALL_COUNT = 5
const BALL_SPACING = 0.15

function Ball({ index, roomKey }: { index: number; roomKey: (string | null)[] }) {
	// Calculate initial position (centered at bottom)
	const startX = 0.5 - ((BALL_COUNT - 1) * BALL_SPACING) / 2
	const initialX = startX + index * BALL_SPACING
	const initialY = 0.85

	const { state, setState, isDragging, isBeingDragged, canInteract, dragHandlers, context } = useSyncDrag<BallState>(
		[...roomKey, 'ball', String(index)],
		{ x: initialX, y: initialY, hoverColor: null },
		{
			interpolate: { x: 0.2, y: 0.2 },
			bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 },
			throttle: 16
		}
	)

	const clientColor = stringToColor(context.clientId)
	const isHovered = state.hoverColor !== null
	const glowColor = state.hoverColor || 'transparent'

	return (
		<div
			{...dragHandlers}
			className={`sync-ball ${isBeingDragged ? 'dragging' : ''} ${isHovered ? 'hovered' : ''}`}
			style={{
				position: 'absolute',
				left: `${state.x * 100}%`,
				top: `${state.y * 100}%`,
				['--glow-color' as string]: glowColor,
				transform: `translate(-50%, -50%) scale(${isBeingDragged ? 1.25 : 1})`,
				cursor: isDragging ? 'grabbing' : canInteract ? 'grab' : 'not-allowed',
				userSelect: 'none',
				touchAction: 'none'
			}}
			onMouseEnter={() => {
				if (canInteract) {
					setState({ hoverColor: clientColor })
				}
			}}
			onMouseLeave={() => {
				if (!isDragging && canInteract) {
					setState({ hoverColor: null })
				}
			}}
		/>
	)
}

export function SyncBalls({ roomKey }: SyncBallsProps) {
	return (
		<div className="sync-balls-container">
			{Array.from({ length: BALL_COUNT }, (_, i) => (
				<Ball key={i} index={i} roomKey={roomKey} />
			))}
		</div>
	)
}
