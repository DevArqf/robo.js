/**
 * Server-side sync handler for the Coin Collector game.
 *
 * Demonstrates ALL server-side sync APIs:
 * - schema: Validates state structure
 * - validate(): Blocks direct client updates (server-authoritative)
 * - transform(): Adds server timestamps before broadcast
 * - onUpdate(): Side effects after successful state broadcast
 * - RPC methods: spawnCoin, collect, clearCollected, getStats
 * - ctx.params: Access dynamic route parameters ([channelId])
 * - ctx.getState/setState: Read/write state
 * - ctx.getHost(): Get activity host
 * - ctx.getClients(): Get all connected clients
 * - ctx.broadcast(): Send ephemeral message to all clients
 * - ctx.send(): Send targeted message to specific client
 */
import type { SyncUpdateContext, SyncCallContext, BuiltInSchema } from '@robojs/sync/server'

// =============================================================================
// Types
// =============================================================================

interface Coin {
	id: string
	x: number
	y: number
	value: number
	collected: boolean
	collectedBy?: string
	/** Server timestamp when coin was spawned */
	spawnedAt?: number
	/** Server timestamp when coin was collected */
	collectedAt?: number
}

interface CoinGameState {
	coins: Record<string, Coin>
	scores: Record<string, number>
	lastCollectedBy?: string
	/** Channel ID this game belongs to (from ctx.params) */
	channelId?: string
	/** Server timestamp of last state update */
	lastUpdatedAt?: number
}

// =============================================================================
// Schema - Validates the state structure
// =============================================================================

export const schema: BuiltInSchema = {
	coins: { type: 'object' },
	scores: { type: 'object' },
	lastCollectedBy: { type: 'string', nullable: true, optional: true },
	channelId: { type: 'string', optional: true },
	lastUpdatedAt: { type: 'number', optional: true }
}

// =============================================================================
// Validate - Blocks direct client state updates
// =============================================================================

/**
 * This handler is server-authoritative: clients cannot modify state directly.
 * All modifications must go through RPC methods (spawnCoin, collect).
 */
export function validate(_ctx: SyncUpdateContext<CoinGameState>): string {
	// Always reject direct updates - clients must use RPC
	return 'use_rpc_to_collect'
}

// =============================================================================
// Transform - Modifies state before broadcasting
// =============================================================================

/**
 * Adds server timestamp to every state update.
 * This demonstrates how transform() can enrich state with server-side data
 * that clients cannot forge.
 */
export function transform(ctx: SyncUpdateContext<CoinGameState>): CoinGameState {
	return {
		...ctx.newState,
		lastUpdatedAt: Date.now()
	}
}

// =============================================================================
// onUpdate - Side effects after state is broadcast
// =============================================================================

/**
 * Runs after state is successfully broadcast to all clients.
 * Useful for logging, analytics, triggering external systems, etc.
 */
export function onUpdate(ctx: SyncUpdateContext<CoinGameState>): void {
	const { newState, oldState, client } = ctx
	const clientName = client.data?.username ?? client.id.slice(0, 8)

	// Log score changes
	if (newState.scores && oldState?.scores) {
		for (const [playerId, newScore] of Object.entries(newState.scores)) {
			const oldScore = oldState.scores[playerId] ?? 0
			if (newScore > oldScore) {
				const points = newScore - oldScore
				console.log(`[CoinGame] ${clientName} scored ${points} points (total: ${newScore})`)
			}
		}
	}

	// Log new coins
	if (newState.coins && oldState?.coins) {
		const newCoinIds = Object.keys(newState.coins).filter((id) => !oldState.coins[id])
		for (const coinId of newCoinIds) {
			const coin = newState.coins[coinId]
			console.log(`[CoinGame] New coin spawned: ${coinId} worth ${coin.value} points`)
		}
	}
}

// =============================================================================
// RPC Methods - Server-side game logic
// =============================================================================

interface SpawnCoinPayload {
	x: number
	y: number
}

interface SpawnCoinResult {
	success: boolean
	coinId?: string
	error?: string
}

/**
 * Spawn a new coin at the given position.
 * Only the host can spawn coins.
 *
 * Demonstrates:
 * - ctx.params: Access [channelId] from route
 * - ctx.getHost(): Verify caller is host
 * - ctx.broadcast(): Notify all clients of new coin
 * - ctx.getClients(): Log player count
 */
export async function spawnCoin(
	payload: SpawnCoinPayload,
	ctx: SyncCallContext<CoinGameState>
): Promise<SpawnCoinResult> {
	// Demonstrate ctx.params - access dynamic route parameters
	const { channelId } = ctx.params
	console.log(`[CoinGame] spawnCoin called for channel: ${channelId}`)

	// Only host can spawn coins
	const hostId = ctx.getHost()
	if (ctx.client.id !== hostId) {
		return { success: false, error: 'only_host_can_spawn' }
	}

	// Demonstrate ctx.getClients() - get all connected clients
	const clients = ctx.getClients()
	console.log(`[CoinGame] Spawning coin for ${clients.length} players`)

	// Get current state or initialize with channelId from params
	const state = ctx.getState() ?? { coins: {}, scores: {}, channelId }

	// Create new coin with random value (1-10 points)
	const coinId = `coin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
	const newCoin: Coin = {
		id: coinId,
		x: Math.max(0, Math.min(100, payload.x)), // Clamp 0-100%
		y: Math.max(0, Math.min(100, payload.y)),
		value: Math.floor(Math.random() * 10) + 1,
		collected: false,
		spawnedAt: Date.now()
	}

	// Update state
	ctx.setState({
		...state,
		channelId, // Store channelId from ctx.params
		coins: { ...state.coins, [coinId]: newCoin }
	})

	// Demonstrate ctx.broadcast() - send ephemeral message to ALL clients
	// This is NOT stored in state - it's a one-time notification
	ctx.broadcast({
		type: 'coin_spawned',
		coinId,
		value: newCoin.value,
		message: `A new ${newCoin.value}-point coin appeared!`
	})

	return { success: true, coinId }
}

interface CollectPayload {
	coinId: string
}

interface CollectResult {
	success: boolean
	points?: number
	total?: number
	error?: string
}

/**
 * Collect a coin and award points to the player.
 * Server validates the coin exists and hasn't been collected.
 *
 * Demonstrates:
 * - ctx.send(): Send targeted message to specific client
 * - ctx.broadcast(): Notify all players of collection
 * - ctx.client: Access caller info including custom data
 */
export async function collect(
	payload: CollectPayload,
	ctx: SyncCallContext<CoinGameState>
): Promise<CollectResult> {
	const state = ctx.getState()

	// Validate coin exists
	const coin = state?.coins?.[payload.coinId]
	if (!coin) {
		return { success: false, error: 'coin_not_found' }
	}

	// Validate not already collected
	if (coin.collected) {
		return { success: false, error: 'already_collected' }
	}

	// Award points to player - demonstrate ctx.client for accessing caller info
	const playerId = ctx.client.id
	const playerName = ctx.client.data?.username ?? playerId.slice(0, 8)
	const currentScore = state.scores?.[playerId] ?? 0
	const newScore = currentScore + coin.value

	// Update state with collected coin and new score
	ctx.setState({
		...state,
		coins: {
			...state.coins,
			[payload.coinId]: {
				...coin,
				collected: true,
				collectedBy: playerId,
				collectedAt: Date.now()
			}
		},
		scores: {
			...state.scores,
			[playerId]: newScore
		},
		lastCollectedBy: playerId
	})

	// Demonstrate ctx.send() - send private message to the collector only
	ctx.send(playerId, {
		type: 'collect_confirmation',
		message: `You collected ${coin.value} points! Total: ${newScore}`,
		coinId: payload.coinId,
		points: coin.value,
		total: newScore
	})

	// Demonstrate ctx.broadcast() - notify ALL clients (including collector)
	ctx.broadcast({
		type: 'coin_collected',
		collectorId: playerId,
		collectorName: playerName,
		coinId: payload.coinId,
		points: coin.value,
		message: `${playerName} collected a ${coin.value}-point coin!`
	})

	return {
		success: true,
		points: coin.value,
		total: newScore
	}
}

interface ClearPayload {
	all?: boolean
}

interface ClearResult {
	success: boolean
	error?: string
}

/**
 * Clear collected coins from the field.
 * Only the host can clear coins.
 */
export async function clearCollected(
	payload: ClearPayload,
	ctx: SyncCallContext<CoinGameState>
): Promise<ClearResult> {
	// Only host can clear
	const hostId = ctx.getHost()
	if (ctx.client.id !== hostId) {
		return { success: false, error: 'only_host_can_clear' }
	}

	const state = ctx.getState()
	if (!state) {
		return { success: true }
	}

	if (payload.all) {
		// Clear all coins
		ctx.setState({
			...state,
			coins: {}
		})
	} else {
		// Clear only collected coins
		const activeCoins: Record<string, Coin> = {}
		for (const [id, coin] of Object.entries(state.coins)) {
			if (!coin.collected) {
				activeCoins[id] = coin
			}
		}
		ctx.setState({
			...state,
			coins: activeCoins
		})
	}

	return { success: true }
}

// =============================================================================
// Additional RPC: getStats - Demonstrates ctx.getClients() fully
// =============================================================================

interface StatsResult {
	success: boolean
	stats: {
		channelId: string
		playerCount: number
		players: Array<{ id: string; name: string; score: number; isHost: boolean }>
		totalCoins: number
		activeCoins: number
		collectedCoins: number
		totalPoints: number
	}
}

/**
 * Get game statistics including player list.
 *
 * Demonstrates:
 * - ctx.getClients(): Get all connected clients with their data
 * - ctx.params: Access route params
 * - Combining multiple context methods
 */
export async function getStats(
	_payload: Record<string, never>,
	ctx: SyncCallContext<CoinGameState>
): Promise<StatsResult> {
	const state = ctx.getState() ?? { coins: {}, scores: {} }

	// Demonstrate ctx.getClients() - get full client list with data
	const clients = ctx.getClients()
	const hostId = ctx.getHost()

	// Build player list with scores
	const players = clients.map((client) => ({
		id: client.id,
		name: client.data?.username ?? client.id.slice(0, 8),
		score: state.scores?.[client.id] ?? 0,
		isHost: client.id === hostId
	}))

	// Calculate coin stats
	const coins = Object.values(state.coins)
	const activeCoins = coins.filter((c) => !c.collected)
	const collectedCoins = coins.filter((c) => c.collected)
	const totalPoints = coins.reduce((sum, c) => sum + c.value, 0)

	return {
		success: true,
		stats: {
			channelId: ctx.params.channelId,
			playerCount: clients.length,
			players,
			totalCoins: coins.length,
			activeCoins: activeCoins.length,
			collectedCoins: collectedCoins.length,
			totalPoints
		}
	}
}
