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
