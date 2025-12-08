// Message types for WebSocket communication
export type MessageType =
	| 'get'
	| 'off'
	| 'on'
	| 'ping'
	| 'pong'
	| 'update'
	// New context system types
	| 'connected'
	| 'metadata'
	| 'broadcast'
	| 'send'
	| 'clients'
	| 'join'
	| 'leave'
	// Server-initiated types
	| 'setHost'

export interface MessagePayload<T = unknown | undefined> {
	data: T
	key?: string[]
	type: MessageType
	targetClientId?: string // For 'send' - target specific client
	fromClientId?: string // For 'broadcast'/'send' - identify sender
}

/**
 * Represents a connected client in a sync context.
 */
export interface Client<ClientData = unknown> {
	id: string
	data?: ClientData
}

/**
 * Context object returned by useSyncState, useSyncContext, and useSyncBroadcast.
 * Provides client awareness, host status, and messaging capabilities.
 */
export interface SyncContext<ClientData = unknown> {
	/** Array of all clients connected to this key/room */
	clients: Client<ClientData>[]
	/** The current client's unique identifier */
	clientId: string
	/** Whether the current client is the host (first to connect) */
	isHost: boolean
	/** Send an ephemeral message to all clients in the room */
	broadcast: (payload: unknown) => void
	/** Send an ephemeral message to a specific client */
	send: (clientId: string, payload: unknown) => void
}

/**
 * Options for useSyncContext hook callbacks.
 */
export interface SyncContextOptions<ClientData = unknown> {
	/** Called when a client connects to this key/room */
	onConnect?: (client: Client<ClientData>) => void
	/** Called when a client disconnects from this key/room */
	onDisconnect?: (client: Client<ClientData>) => void
}

/**
 * Result object returned by useSyncBroadcast hook.
 */
export interface SyncBroadcastResult<ClientData = unknown> {
	/** Send an ephemeral message to all clients in the room */
	broadcast: (payload: unknown) => void
	/** The sync context for this key/room */
	context: SyncContext<ClientData>
	/** Send an ephemeral message to a specific client */
	send: (clientId: string, payload: unknown) => void
}

/**
 * Internal callback types for context management.
 */
export type ContextEvent<ClientData = unknown> =
	| { type: 'clients'; clients: Client<ClientData>[]; hostId: string }
	| { type: 'join'; client: Client<ClientData> }
	| { type: 'leave'; client: Client<ClientData> }

export type ContextCallback<ClientData = unknown> = (event: ContextEvent<ClientData>) => void
export type BroadcastCallback<ClientData = unknown> = (payload: unknown, client: Client<ClientData>) => void

// ============================================================================
// SyncZone & SyncBox Types
// ============================================================================

/**
 * Connection status for zones and sync components.
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Sync status for SyncBox components.
 * Apps can use this to show loading/syncing indicators.
 */
export interface SyncStatus {
	/** Whether initial state has been received */
	synced: boolean
	/** Whether an update is currently being sent */
	syncing: boolean
	/** Whether state might be outdated (connection issues) */
	stale: boolean
	/** Timestamp of last successful sync */
	lastSyncedAt?: number
}

/**
 * Context value provided by SyncZone to its children.
 */
export interface ZoneContextValue<ClientData = unknown> {
	/** Accumulated key prefix from nested zones */
	prefix: (string | null)[]
	/** The host client ID for this zone */
	hostId: string
	/** Whether current client is host of this zone */
	isHost: boolean
	/** Connection status */
	connectionStatus: ConnectionStatus
	/** Clients subscribed to this zone */
	clients: Client<ClientData>[]
	/** Send ephemeral message to all clients in zone */
	broadcast: (payload: unknown) => void
	/** Send ephemeral message to specific client */
	send: (clientId: string, payload: unknown) => void
}

/**
 * Props for SyncZone component.
 */
export interface SyncZoneProps {
	/** Key prefix for this zone */
	id: (string | null)[]
	/** Host determination strategy */
	hostRules?: 'first' | 'explicit'
	/** Explicit host client ID (when hostRules='explicit') */
	host?: string | null
	/** Children to render */
	children: React.ReactNode
}

/**
 * Lock context for lockable SyncBox.
 * Provides lock/unlock capabilities and ownership tracking.
 */
export interface LockContext {
	/** Whether the box is currently locked by anyone */
	isLocked: boolean
	/** Client ID of the lock holder, or null if unlocked */
	lockedBy: string | null
	/** Whether current client holds the lock */
	isLockHolder: boolean
	/** Acquire the lock (automatically uses current client ID) */
	lock: () => void
	/** Release the lock */
	unlock: () => void
}

/**
 * Options for setState calls.
 */
export interface SetStateOptions {
	/** Apply update optimistically (instant local update, rollback on failure) */
	optimistic?: boolean
	/** Override throttle for this specific call (ms) */
	throttle?: number
}

/**
 * setState function signature with options support.
 */
export type SyncBoxSetState<T> = (
	newState: Partial<T> | ((prev: T) => T),
	options?: SetStateOptions
) => void

/**
 * Render function signature for SyncBox children.
 * Receives state, setState, status, context, and optionally lock context.
 */
export type SyncBoxRenderFunction<T, ClientData = unknown> = (
	state: T | undefined,
	setState: SyncBoxSetState<T>,
	status: SyncStatus,
	context: SyncContext<ClientData>,
	lock?: LockContext
) => React.ReactNode

/**
 * Interpolation config for smooth remote state updates.
 * Keys are field names, values are lerp factors (0-1, lower = smoother).
 */
export type InterpolateConfig<T> = {
	[K in keyof T]?: number
}

/**
 * Throttle config - either a single number or per-field config.
 */
export type ThrottleConfig<T> = number | {
	[K in keyof T]?: number
}

/**
 * Props for SyncBox component.
 */
export interface SyncBoxProps<T = unknown, ClientData = unknown> {
	/** Key suffix (combined with zone prefix) */
	id: (string | null)[]
	/** Initial state value */
	initialState?: T
	/** Children to render - can be ReactNode or render function */
	children?: React.ReactNode | SyncBoxRenderFunction<T, ClientData>
	/** CSS styles for wrapper element */
	style?: React.CSSProperties
	/** CSS class name for wrapper element */
	className?: string
	/** Element type to render (default: 'div', null for no wrapper) */
	as?: keyof JSX.IntrinsicElements | React.ComponentType<unknown> | null
	/** Callback when synced state changes */
	onStateChange?: (state: T, prevState: T | undefined) => void
	/** Callback when sync status changes */
	onSyncStatusChange?: (status: SyncStatus) => void
	/** Throttle setState calls - number (ms) or per-field config */
	throttle?: ThrottleConfig<T>
	/** Enable lockable mode for exclusive ownership */
	lockable?: boolean
	/** Interpolation config for smooth remote updates (field -> lerp factor 0-1) */
	interpolate?: InterpolateConfig<T>
	/** Conflict resolution callback when remote update arrives during local changes */
	onConflict?: (localState: T, remoteState: T) => T
}

/**
 * Imperative handle for SyncBox ref.
 */
export interface SyncBoxHandle<T = unknown> {
	/** Get current state */
	getState: () => T | undefined
	/** Update state (partial or updater function) */
	setState: SyncBoxSetState<T>
	/** Get current sync status */
	getSyncStatus: () => SyncStatus
	/** Lock context (only available when lockable=true) */
	lock?: LockContext
}

// ============================================================================
// Server-Side Types
// ============================================================================

/**
 * Server-side zone handle for direct state manipulation.
 * Use SyncServer.getZone(key) to obtain an instance.
 */
export interface ServerZone<T = unknown> {
	/** Get current state for this zone key */
	getState: () => T | undefined
	/** Set state (broadcasts to all subscribers) */
	setState: (data: T) => void
	/** Override the host for this zone */
	setHost: (clientId: string | null) => void
	/** Get current host ID */
	getHost: () => string | undefined
	/** Get all clients subscribed to this zone */
	getClients: () => Client[]
	/** Broadcast ephemeral message to all clients */
	broadcast: (payload: unknown) => void
	/** Send ephemeral message to specific client */
	send: (clientId: string, payload: unknown) => void
}
