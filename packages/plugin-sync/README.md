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

Send and receive ephemeral messages that don't persist.

```tsx
const { broadcast, send, context } = useSyncBroadcast(
	(payload, { client }) => {
		// Handle incoming message
		// client.id === '__server__' for server-sent broadcasts
	},
	['room']
)

broadcast(data) // Send to all clients
send(clientId, data) // Send to specific client
```

### `useSyncCall(key)`

Make RPC calls to server-side sync handlers. Returns a typed call function.

```tsx
const call = useSyncCall(['game', roomId])

// Basic call
const result = await call('methodName', payload)

// Typed call
const result = await call<PayloadType, ResultType>('methodName', payload)

// Result shape
interface CallResult<T> {
  success: boolean      // true if call succeeded
  result?: T            // Return value from server handler
  error?: string        // Error message if failed
}
```

**Usage with server handlers:**

```tsx
// Server: src/sync/game/[roomId]/state.ts
export async function move(payload: { x: number; y: number }, ctx) {
  // Validate and update state
  return { success: true, newPosition: { x: payload.x, y: payload.y } }
}

// Client
const call = useSyncCall(['game', roomId, 'state'])
const result = await call<
  { x: number; y: number },
  { success: boolean; newPosition?: { x: number; y: number } }
>('move', { x: 10, y: 20 })

if (result.success && result.result?.success) {
  console.log('Moved to:', result.result.newPosition)
}
```

| Return | Type | Description |
|--------|------|-------------|
| `call` | `(method, payload?) => Promise<CallResult>` | Function to call server RPC methods |

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

## Server-Side Sync Handlers

For **server-authoritative** state management, create handler files in `/src/sync/`. These handlers enable validation, transformation, and RPC methods that run on the server.

### File Structure

```
src/
  sync/
    activity/
      [channelId]/
        game.ts          # Handler for 'activity.[channelId].game'
        coins.ts         # Handler for 'activity.[channelId].coins'
      middleware.ts      # Middleware for 'activity/*' keys
    lobby.ts             # Handler for 'lobby'
```

File paths map to sync keys:
- `src/sync/lobby.ts` → `['lobby']`
- `src/sync/activity/[channelId]/game.ts` → `['activity', channelId, 'game']`

### Handler Exports

Handlers can export any combination of these:

```ts
// src/sync/game/[roomId]/state.ts
import type { SyncUpdateContext, SyncCallContext, BuiltInSchema } from '@robojs/sync/server'

// ===========================================
// Schema - Validates state structure
// ===========================================

export const schema: BuiltInSchema = {
  score: { type: 'number' },
  players: { type: 'object' },
  phase: { type: 'string', enum: ['lobby', 'playing', 'ended'] },
  winner: { type: 'string', nullable: true, optional: true }
}

// ===========================================
// Validate - Block or allow direct updates
// ===========================================

/**
 * Return true to allow, false or string to reject.
 * Returning a string provides a custom rejection reason.
 */
export function validate(ctx: SyncUpdateContext<GameState>): boolean | string {
  // Block all direct updates - force clients to use RPC
  return 'use_rpc_methods'

  // Or conditionally allow
  if (ctx.client.id === ctx.getHost?.()) {
    return true // Host can update directly
  }
  return 'only_host_can_update'
}

// ===========================================
// Transform - Modify state before broadcast
// ===========================================

/**
 * Transform state before it's broadcast to clients.
 * Useful for adding server timestamps, sanitizing data, etc.
 */
export function transform(ctx: SyncUpdateContext<GameState>): GameState {
  return {
    ...ctx.newState,
    updatedAt: Date.now(),
    updatedBy: ctx.client.id
  }
}

// ===========================================
// onUpdate - Side effects after broadcast
// ===========================================

/**
 * Runs AFTER state is successfully broadcast.
 * Useful for logging, analytics, triggering external systems.
 */
export function onUpdate(ctx: SyncUpdateContext<GameState>): void {
  console.log(`[Game] State updated by ${ctx.client.id}`)

  // Check for game-ending conditions
  if (ctx.newState.winner && !ctx.oldState?.winner) {
    console.log(`[Game] Winner: ${ctx.newState.winner}`)
  }
}

// ===========================================
// RPC Methods - Server-side game logic
// ===========================================

/**
 * Any exported async function becomes an RPC method.
 * Call from client via: call('startGame', { difficulty: 'hard' })
 */
export async function startGame(
  payload: { difficulty: string },
  ctx: SyncCallContext<GameState>
): Promise<{ success: boolean; error?: string }> {
  // Only host can start
  if (ctx.client.id !== ctx.getHost()) {
    return { success: false, error: 'only_host_can_start' }
  }

  ctx.setState({
    ...ctx.getState(),
    phase: 'playing',
    difficulty: payload.difficulty
  })

  return { success: true }
}
```

### SyncUpdateContext

Available in `validate`, `transform`, and `onUpdate`:

```ts
interface SyncUpdateContext<T, ClientData = unknown> {
  newState: T                    // New state from client or RPC
  oldState: T | undefined        // Previous state
  client: {                      // Client making the update
    id: string
    data?: ClientData            // From SyncContextProvider clientData
  }
  params: Record<string, string> // Dynamic route params (e.g., { roomId: '123' })
  key: string[]                  // Key array (e.g., ['game', '123', 'state'])
  cleanKey: string               // Normalized key (e.g., 'game.123.state')
}
```

### SyncCallContext

Available in RPC methods:

```ts
interface SyncCallContext<T, ClientData = unknown> {
  client: {                      // Client making the call
    id: string
    data?: ClientData
  }
  params: Record<string, string> // Dynamic route params
  key: string[]                  // Key array
  cleanKey: string               // Normalized key

  // State access
  getState(): T | undefined      // Get current state
  setState(data: T): void        // Update state (broadcasts automatically)

  // Room info
  getHost(): string | undefined  // Get host client ID
  getClients(): Client[]         // Get all connected clients

  // Ephemeral messaging
  broadcast(payload: unknown): void           // Send to ALL clients
  send(clientId: string, payload: unknown): void  // Send to specific client
}
```

### Client-Side: useSyncCall

Call server RPC methods from the client:

```tsx
import { useSyncCall } from '@robojs/sync'

function GameControls() {
  const call = useSyncCall(['game', roomId, 'state'])

  const handleStart = async () => {
    const result = await call<
      { difficulty: string },           // Payload type
      { success: boolean; error?: string } // Result type
    >('startGame', { difficulty: 'hard' })

    if (!result.success) {
      console.error('Failed:', result.error || result.result?.error)
    }
  }

  return <button onClick={handleStart}>Start Game</button>
}
```

### Middleware

Create `middleware.ts` (or `_middleware.ts`) in any sync directory to intercept all operations in that scope:

```ts
// src/sync/game/middleware.ts
import type { SyncMiddlewareContext, MiddlewareResult } from '@robojs/sync/server'

/**
 * Runs BEFORE handler validation.
 * Can reject the request or allow it to continue.
 */
export function before(ctx: SyncMiddlewareContext): MiddlewareResult {
  console.log(`[Sync] ${ctx.messageType} on "${ctx.cleanKey}" by ${ctx.client.id}`)

  // Rate limiting example
  if (isRateLimited(ctx.client.id)) {
    return { reject: true, reason: 'rate_limited' }
  }

  return { continue: true }
}

/**
 * Runs AFTER successful state broadcast.
 * Useful for logging, analytics, cleanup.
 */
export function after(ctx: SyncMiddlewareContext): void {
  console.log(`[Sync] Completed ${ctx.messageType} on "${ctx.cleanKey}"`)
}
```

Middleware Context:

```ts
interface SyncMiddlewareContext<T = unknown, ClientData = unknown> {
  state: T                       // Current state
  client: { id: string; data?: ClientData }
  params: Record<string, string>
  key: string[]
  cleanKey: string
  messageType: 'update' | 'call' // Type of operation
}

type MiddlewareResult =
  | { continue: true }           // Allow operation
  | { reject: true; reason?: string }  // Block operation
```

### Schema Types

Built-in schema validation:

```ts
import type { BuiltInSchema } from '@robojs/sync/server'

export const schema: BuiltInSchema = {
  // Primitives
  name: { type: 'string' },
  count: { type: 'number' },
  active: { type: 'boolean' },

  // Optional fields
  nickname: { type: 'string', optional: true },

  // Nullable fields
  winner: { type: 'string', nullable: true },

  // Enums
  status: { type: 'string', enum: ['pending', 'active', 'complete'] },

  // Nested objects (validated as 'object' type)
  players: { type: 'object' },

  // Arrays (validated as 'array' type)
  history: { type: 'array' }
}
```

### Receiving Server Broadcasts

Server calls to `ctx.broadcast()` and `ctx.send()` are received by clients via `useSyncBroadcast`:

```tsx
import { useSyncBroadcast } from '@robojs/sync'

function Game() {
  useSyncBroadcast(
    (payload, { client }) => {
      // Server broadcasts have client.id === '__server__'
      if (client.id === '__server__') {
        console.log('Server notification:', payload)
      } else {
        console.log(`Player ${client.id} broadcast:`, payload)
      }
    },
    ['game', roomId]
  )

  // ...
}
```

### Server Type Exports

All types available from `@robojs/sync/server`:

```ts
import type {
  // Context types
  SyncUpdateContext,      // For validate, transform, onUpdate
  SyncCallContext,        // For RPC methods
  SyncMiddlewareContext,  // For middleware before/after

  // Handler function types (for explicit typing)
  ValidateHandler,
  TransformHandler,
  OnUpdateHandler,
  CallHandler,
  MiddlewareBeforeHandler,
  MiddlewareAfterHandler,
  MiddlewareResult,

  // Client info
  HandlerClient,

  // Schema
  BuiltInSchema,
  SchemaField,
  SchemaValidationResult,

  // Module types (advanced)
  SyncHandlerModule,
  SyncMiddlewareModule,
  SyncHandlerRecord,
  SyncMiddlewareRecord
} from '@robojs/sync/server'
```

### Handling Validation Errors

When `validate()` returns `false` or a string, or when schema validation fails:

1. **For RPC calls** - Errors are returned directly in the result:

```tsx
const call = useSyncCall(['game', roomId])

const result = await call('action', payload)
if (!result.success) {
  console.log('Error:', result.error) // Contains the rejection reason
}
```

2. **For direct state updates** - The update is rejected and the client's state reverts to the server state. For advanced error handling, you can access the raw context:

```tsx
import { useContext, useEffect } from 'react'
// Import SyncContext directly from context module
import { SyncContext } from '@robojs/sync/dist/core/context.js'

function MyComponent() {
  const { registerValidationErrorCallback, unregisterValidationErrorCallback } = useContext(SyncContext)

  useEffect(() => {
    const callbackId = registerValidationErrorCallback(
      ['game', roomId],
      (reason, details) => {
        console.log('Validation rejected:', reason, details)
      }
    )
    return () => unregisterValidationErrorCallback(callbackId)
  }, [roomId])
}
```

> **Note:** For server-authoritative handlers that block all direct updates (like the coin game example), validation errors only occur if a client attempts to bypass RPC. Most apps should use RPC methods exclusively for server-authoritative state.

### Complete Example

**Server handler** (`src/sync/activity/[channelId]/coins.ts`):

```ts
import type { SyncCallContext, BuiltInSchema } from '@robojs/sync/server'

interface CoinGameState {
  coins: Record<string, { id: string; x: number; y: number; value: number; collected: boolean }>
  scores: Record<string, number>
}

export const schema: BuiltInSchema = {
  coins: { type: 'object' },
  scores: { type: 'object' }
}

// Block direct client updates - must use RPC
export function validate(): string {
  return 'use_rpc_to_collect'
}

// Add server timestamp
export function transform(ctx) {
  return { ...ctx.newState, updatedAt: Date.now() }
}

// RPC: Collect a coin
export async function collect(
  payload: { coinId: string },
  ctx: SyncCallContext<CoinGameState>
) {
  const state = ctx.getState() ?? { coins: {}, scores: {} }
  const coin = state.coins[payload.coinId]

  if (!coin || coin.collected) {
    return { success: false, error: 'invalid_coin' }
  }

  const playerId = ctx.client.id
  const newScore = (state.scores[playerId] ?? 0) + coin.value

  ctx.setState({
    ...state,
    coins: {
      ...state.coins,
      [payload.coinId]: { ...coin, collected: true }
    },
    scores: { ...state.scores, [playerId]: newScore }
  })

  // Notify the collector privately
  ctx.send(playerId, {
    type: 'collected',
    points: coin.value,
    total: newScore
  })

  // Notify everyone
  ctx.broadcast({
    type: 'coin_collected',
    playerId,
    coinId: payload.coinId
  })

  return { success: true, points: coin.value }
}
```

**Client** (`src/app/Game.tsx`):

```tsx
import { useSyncState, useSyncCall, useSyncBroadcast } from '@robojs/sync'

function CoinGame({ channelId }) {
  const coinKey = ['activity', channelId, 'coins']

  const [gameState] = useSyncState({ coins: {}, scores: {} }, coinKey)
  const call = useSyncCall(coinKey)

  useSyncBroadcast((payload, { client }) => {
    if (client.id === '__server__') {
      // Handle server notifications
      console.log(payload.type, payload)
    }
  }, coinKey)

  const collectCoin = async (coinId: string) => {
    const result = await call('collect', { coinId })
    if (!result.success) {
      console.error(result.error)
    }
  }

  return (
    <div>
      {Object.values(gameState.coins).map(coin => (
        <button
          key={coin.id}
          onClick={() => collectCoin(coin.id)}
          disabled={coin.collected}
        >
          {coin.value} points
        </button>
      ))}
    </div>
  )
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
