<p align="center">✨ <strong>Generated with <a href="https://roboplay.dev/create-robo">create-robo</a> magic!</strong> ✨</p>

---

# @robojs/sync

Real-time state sync across clients the simplest way possible. Perfect for multiplayer games and collaborative apps. It's like magic, but real! 🎩✨

```ts
const [position, setPosition] = useSyncState({ x: 0, y: 0 }, [channelId])
```

Works exactly like React's `useState`, but syncs state across all clients in real-time via WebSockets. No manual socket handling—just build your app and let `@robojs/sync` handle the rest.

➞ [📚 **Documentation:** Getting started](https://docs.roboplay.dev/docs/getting-started)

➞ [🚀 **Community:** Join our Discord server](https://roboplay.dev/discord)

## Installation

```bash
npx robo add @robojs/sync
```

> **Note:** Requires `@robojs/server` to be installed.

Wrap your app with `SyncContextProvider`:

```tsx
import { SyncContextProvider } from '@robojs/sync'

export function App() {
	return (
		<SyncContextProvider>
			<Activity />
		</SyncContextProvider>
	)
}
```

## Quick Start

### Shared State

Use `useSyncState` to sync state across all clients watching the same key:

```tsx
import { useSyncState } from '@robojs/sync'

function Counter() {
	const [count, setCount] = useSyncState(0, ['counter'])

	return <button onClick={() => setCount(count + 1)}>Count: {count}</button>
}
```

Every client with the same key (`['counter']`) sees the same value in real-time.

### Room Context

Access connected clients and host status via the third return value:

```tsx
const [gameState, setGameState, context] = useSyncState(initialState, ['game', visitorId])

// context.clients - Array of connected clients
// context.clientId - Your client ID
// context.isHost   - Whether you're the room host (first to join)
```

### Player Events

Use `useSyncContext` to react when players join or leave:

```tsx
import { useSyncContext } from '@robojs/sync'

useSyncContext(
	{
		onConnect: (client) => console.log(`${client.id} joined!`),
		onDisconnect: (client) => console.log(`${client.id} left!`)
	},
	['game', visitorId]
)
```

### Ephemeral Messages

Use `useSyncBroadcast` for one-off messages that don't persist (reactions, typing indicators, etc.):

```tsx
import { useSyncBroadcast } from '@robojs/sync'

const { broadcast } = useSyncBroadcast(
	(payload, { client }) => {
		// Handle incoming broadcast from another client
		console.log(`${client.id} sent:`, payload)
	},
	['game', visitorId]
)

// Send to all other clients
broadcast({ emoji: '🎉', x: 100, y: 200 })
```

## API Reference

### `SyncContextProvider`

Wrap your app to enable sync functionality.

```tsx
<SyncContextProvider
	clientData={{ username: 'Player1', odId: '123' }}
	loadingScreen={<Loading />}
>
	<App />
</SyncContextProvider>
```

| Prop | Type | Description |
|------|------|-------------|
| `clientData` | `object` | Optional metadata visible to other clients via `client.data` |
| `loadingScreen` | `ReactNode` | Component to show while connecting |

### `useSyncState<T, ClientData>(initialState, key)`

Shared state hook. Returns `[state, setState, context]`.

```tsx
const [state, setState, context] = useSyncState({ x: 0, y: 0 }, ['position', odId])
```

| Return | Type | Description |
|--------|------|-------------|
| `state` | `T` | Current synced state |
| `setState` | `(value: T) => void` | Update state (broadcasts to all clients) |
| `context` | `SyncContext` | Room context (see below) |

### `useSyncContext<ClientData>(options?, key)`

Access room context without managing state.

```tsx
// Just get context
const context = useSyncContext(['room'])

// With event callbacks
useSyncContext(
	{
		onConnect: (client) => {},
		onDisconnect: (client) => {}
	},
	['room']
)
```

### `useSyncBroadcast<ClientData>(handler, key)`

Send ephemeral messages that don't persist.

```tsx
const { broadcast, send, context } = useSyncBroadcast(
	(payload, { client }) => {
		// Handle incoming message
	},
	['room']
)

broadcast(data) // Send to all clients
send(clientId, data) // Send to specific client
```

### `SyncContext`

The context object returned by hooks:

```ts
interface SyncContext<ClientData> {
	clients: Client<ClientData>[] // All connected clients
	clientId: string // Your client ID
	isHost: boolean // True if you're room host
	broadcast: (payload: unknown) => void // Send to all
	send: (clientId: string, payload: unknown) => void // Send to one
}

interface Client<ClientData> {
	id: string
	data?: ClientData // From SyncContextProvider's clientData prop
}
```

## Components

### `SyncZone`

A context provider for hierarchical key prefixing and host inheritance. Zones enable component reusability and organized state namespacing.

```tsx
import { SyncZone, SyncBox } from '@robojs/sync'

function Game() {
	return (
		<SyncZone id={['game', 'room1']}>
			<SyncBox id={['player']} initialState={{ x: 0, y: 0 }}>
				<PlayerSprite />
			</SyncBox>
			{/* key becomes 'game.room1.player' */}
		</SyncZone>
	)
}
```

**Nested zones** accumulate prefixes:

```tsx
<SyncZone id={['game']}>
	<SyncZone id={['board']}>
		<SyncBox id={['piece']} />
		{/* key: 'game.board.piece' */}
	</SyncZone>
</SyncZone>
```

**Host rules** control host determination:

```tsx
// First subscriber becomes host (default)
<SyncZone id={['match']} hostRules="first">

// Explicit host assignment
<SyncZone id={['match']} hostRules="explicit" host={adminClientId}>
```

| Prop | Type | Description |
|------|------|-------------|
| `id` | `(string \| null)[]` | Key prefix for this zone |
| `hostRules` | `'first' \| 'explicit'` | Host determination strategy (default: `'first'`) |
| `host` | `string \| null` | Explicit host client ID (when `hostRules='explicit'`) |

### `SyncBox`

A synced container component that synchronizes arbitrary state across clients. General-purpose—apps define their own logic for what to sync.

**With render props (recommended):**

```tsx
import { SyncBox } from '@robojs/sync'

function Cursor() {
	return (
		<SyncBox id={['cursor']} initialState={{ x: 0.5, y: 0.5 }} throttle={16}>
			{(state, setState, status) => (
				<div style={{ left: `${state?.x * 100}%`, top: `${state?.y * 100}%` }}>
					{status.stale && <span>Reconnecting...</span>}
				</div>
			)}
		</SyncBox>
	)
}
```

**With lockable (exclusive ownership):**

```tsx
<SyncBox id={['ball']} initialState={{ x: 0, y: 0 }} lockable>
	{(state, setState, status, context, lock) => (
		<div
			onMouseDown={() => lock?.lock()}
			onMouseUp={() => lock?.unlock()}
			style={{
				cursor: lock?.isLocked
					? lock.isLockHolder ? 'grabbing' : 'not-allowed'
					: 'grab'
			}}
		/>
	)}
</SyncBox>
```

**With interpolation (smooth remote movement):**

```tsx
<SyncBox
	id={['cursor']}
	initialState={{ x: 0.5, y: 0.5 }}
	interpolate={{ x: 0.15, y: 0.15 }}
>
	{(state) => <Cursor x={state?.x} y={state?.y} />}
</SyncBox>
```

**With optimistic updates:**

```tsx
<SyncBox id={['counter']} initialState={{ count: 0 }}>
	{(state, setState) => (
		<button onClick={() => setState({ count: (state?.count ?? 0) + 1 }, { optimistic: true })}>
			{state?.count}
		</button>
	)}
</SyncBox>
```

**No wrapper element:**

```tsx
<SyncBox as={null} id={['data']} initialState={{ value: '' }}>
	{(state, setState) => <input value={state?.value} onChange={e => setState({ value: e.target.value })} />}
</SyncBox>
```

| Prop | Type | Description |
|------|------|-------------|
| `id` | `(string \| null)[]` | Key suffix (combined with zone prefix) |
| `initialState` | `T` | Initial state value |
| `children` | `ReactNode \| (state, setState, status, context, lock?) => ReactNode` | Children or render function |
| `throttle` | `number \| { [field]: number }` | Throttle setState calls (ms), global or per-field |
| `lockable` | `boolean` | Enable exclusive ownership mode |
| `interpolate` | `{ [field]: number }` | Lerp factor per field for smooth remote updates (0-1) |
| `as` | `ElementType \| null` | Wrapper element (default: `'div'`, `null` for none) |
| `onStateChange` | `(state, prev) => void` | Called when synced state changes |
| `onSyncStatusChange` | `(status) => void` | Called when sync status changes |
| `onConflict` | `(local, remote) => T` | Resolve conflicts between optimistic and remote state |
| `style` | `CSSProperties` | Styles for wrapper element |
| `className` | `string` | Class name for wrapper element |

**Render function signature:**

```ts
(state, setState, status, context, lock?) => ReactNode

// setState supports options
setState({ x: 1 }, { optimistic: true, throttle: 16 })
```

**Lock context** (when `lockable` is enabled):

```ts
interface LockContext {
	isLocked: boolean       // Anyone holds the lock
	lockedBy: string | null // Lock holder's client ID
	isLockHolder: boolean   // Current client holds the lock
	lock: () => void        // Acquire lock (auto-assigns to you)
	unlock: () => void      // Release lock
}
```

**Imperative handle** (`SyncBoxHandle<T>`):

```ts
interface SyncBoxHandle<T> {
	getState: () => T | undefined
	setState: (value, options?) => void
	getSyncStatus: () => SyncStatus
	lock?: LockContext // When lockable=true
}

interface SyncStatus {
	synced: boolean // Initial state received
	syncing: boolean // Update in progress
	stale: boolean // May be outdated
	lastSyncedAt?: number // Timestamp
}
```

### `useZoneContext`

Access the current zone's context:

```tsx
import { useZoneContext } from '@robojs/sync'

function GameStatus() {
	const zone = useZoneContext()
	if (!zone) return null

	return (
		<div>
			{zone.isHost ? 'You are the host' : `Host: ${zone.hostId}`}
			Players: {zone.clients.length}
		</div>
	)
}
```

### `useZoneKey`

Compute the full key by combining zone prefix with a local id:

```tsx
import { useZoneKey, useSyncState } from '@robojs/sync'

function PlayerMarker({ playerId }) {
	const fullKey = useZoneKey(['player', playerId])
	// In <SyncZone id={['game']}>, fullKey = ['game', 'player', playerId]
	const [position, setPosition] = useSyncState({ x: 0, y: 0 }, fullKey)
	// ...
}
```

## High-Level Primitives

These primitives provide common real-time collaboration patterns out of the box, reducing boilerplate for cursors, draggables, and presence tracking.

### `useSyncPresence`

Track connected participants with custom presence metadata (status, activity, typing indicators, etc.).

```tsx
import { useSyncPresence } from '@robojs/sync'

function Lobby() {
	const { participants, updatePresence } = useSyncPresence(['room', odId], {
		initialPresence: { status: 'online', activity: 'idle' }
	})

	return (
		<div>
			<h2>Players ({participants.length})</h2>
			{participants.map((p) => (
				<div key={p.clientId}>
					{p.user.data?.name} - {p.presence.status}
					{p.isStale && ' (away)'}
					{p.isYou && ' (you)'}
				</div>
			))}
			<button onClick={() => updatePresence({ status: 'ready' })}>Ready Up</button>
		</div>
	)
}
```

| Option | Type | Description |
|--------|------|-------------|
| `initialPresence` | `T` | Initial presence data for this client |
| `staleTimeout` | `number` | Ms before marking user as stale (default: `5000`) |
| `heartbeatInterval` | `number` | Ms between heartbeat updates (default: `2000`) |

| Return | Type | Description |
|--------|------|-------------|
| `participants` | `Participant<T>[]` | All connected participants with presence data |
| `updatePresence` | `(update) => void` | Update your presence (partial or updater function) |
| `clientId` | `string` | Your client ID |
| `isHost` | `boolean` | Whether you're the host |
| `context` | `SyncContext` | Full sync context for advanced usage |

```ts
interface Participant<T, ClientData> {
	clientId: string
	user: Client<ClientData>
	presence: T
	isStale: boolean  // No heartbeat received recently
	isYou: boolean    // Is this the current client
}
```

---

### `useSyncCursor`

Track and broadcast cursor positions in real-time. Optimized to avoid rerenders for your own cursor—only remote cursor changes trigger React state updates.

```tsx
import { useSyncCursor } from '@robojs/sync'

function Whiteboard() {
	// Manual tracking (default) - you control when to update
	const { remoteCursors, updatePosition } = useSyncCursor(['room', odId])

	useEffect(() => {
		const handleMove = (e: MouseEvent) => {
			updatePosition({
				x: e.clientX / window.innerWidth,
				y: e.clientY / window.innerHeight
			})
		}
		window.addEventListener('mousemove', handleMove)
		return () => window.removeEventListener('mousemove', handleMove)
	}, [updatePosition])

	return (
		<div>
			{remoteCursors.map((cursor) => (
				<div
					key={cursor.clientId}
					style={{
						position: 'absolute',
						left: `${cursor.position.x * 100}%`,
						top: `${cursor.position.y * 100}%`
					}}
				>
					{cursor.user.data?.name}
				</div>
			))}
		</div>
	)
}
```

**Auto-tracking mode:**

```tsx
// Let the hook handle mouse tracking automatically
const { remoteCursors } = useSyncCursor(['room', odId], { autoTrack: true })
```

| Option | Type | Description |
|--------|------|-------------|
| `throttle` | `number` | Ms between updates (default: `16` for ~60fps) |
| `normalize` | `boolean` | Convert to 0-1 viewport coords (default: `true`) |
| `hideOnLeave` | `boolean` | Set `active=false` on mouse leave (default: `true`) |
| `inactiveTimeout` | `number` | Ms before removing inactive cursors (default: `3000`) |
| `autoTrack` | `boolean` | Auto-track mouse movement (default: `false`) |

| Return | Type | Description |
|--------|------|-------------|
| `cursors` | `RemoteCursor[]` | All cursors including yours |
| `remoteCursors` | `RemoteCursor[]` | Only other users' cursors (use for rendering) |
| `updatePosition` | `(pos) => void` | Update your cursor position |
| `clientId` | `string` | Your client ID |

```ts
interface RemoteCursor<ClientData> {
	clientId: string
	user: Client<ClientData>
	position: { x: number; y: number; active: boolean }
	isYou: boolean
}
```

---

### `SyncCursors`

Drop-in component that renders all participant cursors automatically. Just add it to your app and cursors appear for all connected users.

```tsx
import { SyncCursors } from '@robojs/sync'

function Activity() {
	return (
		<div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
			<SyncCursors roomKey={['room', odId]} />
			{/* Your content */}
		</div>
	)
}
```

**Custom cursor rendering:**

```tsx
<SyncCursors
	roomKey={['room', odId]}
	renderCursor={(cursor) => (
		<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
			<CustomCursorIcon color={cursor.user.data?.color} />
			<span>{cursor.user.data?.name}</span>
		</div>
	)}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `roomKey` | `(string \| null)[]` | Room key for cursor sync |
| `throttle` | `number` | Ms between updates (default: `16`) |
| `renderCursor` | `(cursor) => ReactNode` | Custom cursor renderer |
| `defaultCursorStyle` | `CSSProperties` | Styles for cursor wrapper |
| `showLabels` | `boolean` | Show user labels (default: `true`) |
| `labelKey` | `keyof ClientData \| (client) => string` | Key or function for label text |
| `colorFn` | `(clientId) => string` | Generate cursor color from client ID |
| `zIndex` | `number` | Z-index for cursor container (default: `9999`) |

---

### `useSyncDrag`

Hook for creating draggable elements with synchronized positions. Handles locking, interpolation, bounds, and gesture detection automatically.

```tsx
import { useSyncDrag } from '@robojs/sync'

function DraggableBall({ id }: { id: string }) {
	const { state, isDragging, canInteract, dragHandlers } = useSyncDrag(
		['ball', id],
		{ x: 0.5, y: 0.5 },
		{
			interpolate: { x: 0.2, y: 0.2 },
			bounds: { minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }
		}
	)

	return (
		<div
			{...dragHandlers}
			style={{
				position: 'absolute',
				left: `${state.x * 100}%`,
				top: `${state.y * 100}%`,
				cursor: isDragging ? 'grabbing' : canInteract ? 'grab' : 'not-allowed'
			}}
		>
			🔵
		</div>
	)
}
```

| Option | Type | Description |
|--------|------|-------------|
| `interpolate` | `{ [field]: number }` | Lerp factor per field for smooth remote updates (0-1) |
| `throttle` | `number` | Ms between updates (default: `16`) |
| `bounds` | `{ minX?, maxX?, minY?, maxY? }` | Position constraints |
| `normalize` | `boolean` | Use 0-1 viewport coords (default: `true`) |
| `lockOnDrag` | `boolean` | Auto-lock when dragging (default: `true`) |

| Return | Type | Description |
|--------|------|-------------|
| `state` | `T` | Current state (interpolated for remote updates) |
| `setState` | `(update) => void` | Update state |
| `isDragging` | `boolean` | You are currently dragging |
| `isBeingDragged` | `boolean` | Anyone is dragging (locked) |
| `canInteract` | `boolean` | Not locked by someone else |
| `dragHandlers` | `{ onMouseDown, onTouchStart }` | Spread onto draggable element |
| `lock` | `LockContext` | Lock context for advanced usage |
| `context` | `SyncContext` | Sync context for client awareness |

---

### `SyncDraggable`

Declarative component wrapper for making any element draggable and synchronized.

```tsx
import { SyncDraggable } from '@robojs/sync'

function GameBoard() {
	return (
		<div style={{ position: 'relative', width: '100%', height: '100%' }}>
			<SyncDraggable
				id={['piece', '1']}
				initial={{ x: 0.5, y: 0.5 }}
				interpolate={{ x: 0.2, y: 0.2 }}
				bounds={{ minX: 0.05, maxX: 0.95, minY: 0.05, maxY: 0.95 }}
			>
				<div className="game-piece">Drag me!</div>
			</SyncDraggable>
		</div>
	)
}
```

**With render props for custom styling:**

```tsx
<SyncDraggable
	id={['card', cardId]}
	initial={{ x: 0.1, y: 0.1 }}
	interpolate={{ x: 0.15, y: 0.15 }}
	onDragStart={(s) => console.log('Started at', s.x, s.y)}
	onDragEnd={(s) => console.log('Dropped at', s.x, s.y)}
>
	{({ state, isDragging, canInteract }) => (
		<div
			style={{
				cursor: isDragging ? 'grabbing' : canInteract ? 'grab' : 'not-allowed',
				opacity: isDragging ? 0.8 : 1
			}}
		>
			Card at ({state.x.toFixed(2)}, {state.y.toFixed(2)})
		</div>
	)}
</SyncDraggable>
```

| Prop | Type | Description |
|------|------|-------------|
| `id` | `(string \| null)[]` | Key for state sync |
| `initial` | `T` | Initial state (must include `x`, `y`) |
| `interpolate` | `{ [field]: number }` | Lerp factor for smooth remote updates |
| `throttle` | `number` | Ms between updates |
| `bounds` | `{ minX?, maxX?, minY?, maxY? }` | Position constraints |
| `normalize` | `boolean` | Use 0-1 viewport coords (default: `true`) |
| `children` | `ReactNode \| (props) => ReactNode` | Content or render function |
| `onDragStart` | `(state) => void` | Called when drag starts |
| `onDrag` | `(state) => void` | Called on each drag update |
| `onDragEnd` | `(state) => void` | Called when drag ends |
| `onStateChange` | `(state, prev) => void` | Called on any state change |
| `style` | `CSSProperties` | Styles for wrapper |
| `className` | `string` | Class name for wrapper |
| `as` | `ElementType \| null` | Wrapper element (default: `'div'`) |

**Render function props:**

```ts
interface SyncDraggableRenderProps<T> {
	state: T              // Current position and custom data
	isDragging: boolean   // You are dragging
	isBeingDragged: boolean // Anyone is dragging
	canInteract: boolean  // Not locked by others
}
```

---

## Server Access

For advanced use cases, access the WebSocket server directly:

```tsx
import { SyncServer } from '@robojs/sync/server.js'

SyncServer.start() // Manually start (usually automatic)
const wss = SyncServer.getSocketServer() // Get underlying WebSocketServer
```

### Server-Side Zone API

Control sync state from the server for game logic, admin actions, or validation:

```ts
import { SyncServer } from '@robojs/sync/server.js'

// Get a zone handle
const zone = SyncServer.getZone(['game', 'room1'])

// Read state
const state = zone.getState()

// Update state (broadcasts to all subscribers)
zone.setState({ phase: 'playing', round: 2 })

// Override host (e.g., for admin actions)
zone.setHost(newHostId)
zone.setHost(null) // Clear host

// Get current host and clients
const hostId = zone.getHost()
const clients = zone.getClients()

// Send ephemeral messages
zone.broadcast({ event: 'countdown', seconds: 5 })
zone.send(clientId, { message: 'private' })
```

Server-initiated messages include `fromClientId: '__server__'` so clients can distinguish them from player messages.

| Method | Description |
|--------|-------------|
| `getState()` | Get current state for the zone key |
| `setState(data)` | Set state and broadcast to all subscribers |
| `setHost(clientId \| null)` | Override or clear the host |
| `getHost()` | Get current host client ID |
| `getClients()` | Get all subscribed clients |
| `broadcast(payload)` | Send to all subscribers |
| `send(clientId, payload)` | Send to specific client |

## Need more power? ⚡

For complex multiplayer games, check out [**Colyseus**](https://colyseus.io/)—a powerful multiplayer game server that pairs perfectly with Robo.js.

➞ [⚔ **Colyseus:** Multiplayer Game Server](https://colyseus.io/)

➞ [📚 **Template:** Colyseus Discord Activity](https://github.com/Wave-Play/robo.js/tree/main/templates/activity-ts-colyseus-react)

---

> **New to Robo.js?** [Create your first project!](https://docs.roboplay.dev/docs/getting-started)
