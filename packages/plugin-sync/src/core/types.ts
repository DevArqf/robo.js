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
