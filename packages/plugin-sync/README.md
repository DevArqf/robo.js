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

## Server Access

For advanced use cases, access the WebSocket server directly:

```tsx
import { SyncServer } from '@robojs/sync/server.js'

SyncServer.start() // Manually start (usually automatic)
const wss = SyncServer.getSocketServer() // Get underlying WebSocketServer
```

## Need more power? ⚡

For complex multiplayer games, check out [**Colyseus**](https://colyseus.io/)—a powerful multiplayer game server that pairs perfectly with Robo.js.

➞ [⚔ **Colyseus:** Multiplayer Game Server](https://colyseus.io/)

➞ [📚 **Template:** Colyseus Discord Activity](https://github.com/Wave-Play/robo.js/tree/main/templates/activity-ts-colyseus-react)

---

> **New to Robo.js?** [Create your first project!](https://docs.roboplay.dev/docs/getting-started)
