/**
 * Coin Collector Game - Demonstrates ALL sync APIs
 *
 * Client-side APIs showcased:
 * - useSyncState: Subscribe to server-authoritative state
 * - useSyncCall: RPC calls to server (spawnCoin, collect, clearCollected, getStats)
 * - useSyncBroadcast: Receive ephemeral server notifications
 *
 * Server-side APIs demonstrated (in src/sync/activity/[channelId]/coins.ts):
 * - schema: State structure validation
 * - validate(): Block direct client updates
 * - transform(): Add server timestamps before broadcast
 * - onUpdate(): Side effects after successful broadcast
 * - ctx.params: Access [channelId] dynamic param
 * - ctx.getState/setState: Server state management
 * - ctx.getHost/getClients: Access room info
 * - ctx.broadcast(): Send to ALL clients
 * - ctx.send(): Send to SPECIFIC client
 */
import { useCallback, useState, useEffect } from 'react'
import { useSyncState, useSyncCall, useSyncBroadcast } from '@robojs/sync'
import type { Client } from '@robojs/sync'

interface Coin {
	id: string
	x: number
	y: number
	value: number
	collected: boolean
	collectedBy?: string
}

interface CoinGameState {
	coins: Record<string, Coin>
	scores: Record<string, number>
	lastCollectedBy?: string
	channelId?: string
	lastUpdatedAt?: number
}

// Server broadcast message types
interface ServerBroadcast {
	type: 'coin_spawned' | 'coin_collected' | 'collect_confirmation'
	message: string
	coinId?: string
	value?: number
	points?: number
	total?: number
	collectorId?: string
	collectorName?: string
}

interface UserData {
	username: string
}

interface CoinGameProps {
	roomKey: string[]
	isHost: boolean
	clientId: string
	clients: Client<UserData>[]
	username: string
}

export function CoinGame({ roomKey, isHost, clientId, clients, username }: CoinGameProps) {
	const coinKey = [...roomKey, 'coins']
	const [collecting, setCollecting] = useState<string | null>(null)
	const [lastResult, setLastResult] = useState<string | null>(null)
	const [notifications, setNotifications] = useState<Array<{ id: number; message: string; type: string }>>([])

	// Sync state for coins - read-only since server controls updates
	const [gameState] = useSyncState<CoinGameState>(
		{ coins: {}, scores: {} },
		coinKey
	)

	// RPC hook for server calls
	const call = useSyncCall(coinKey)

	// useSyncBroadcast - Receive ephemeral messages from server
	// Server uses ctx.broadcast() to send to ALL clients
	// Server uses ctx.send() to send to SPECIFIC client
	useSyncBroadcast<UserData>(
		(payload, { client }) => {
			const broadcast = payload as ServerBroadcast
			const isFromServer = client.id === '__server__'

			console.log(`[CoinGame] Received ${isFromServer ? 'server' : 'client'} broadcast:`, broadcast)

			// Add notification to queue
			const id = Date.now()
			setNotifications((prev) => [...prev.slice(-4), { id, message: broadcast.message, type: broadcast.type }])

			// Auto-dismiss after 3 seconds
			setTimeout(() => {
				setNotifications((prev) => prev.filter((n) => n.id !== id))
			}, 3000)
		},
		coinKey
	)

	// Spawn a coin at random position (host only)
	const handleSpawnCoin = useCallback(async () => {
		if (!isHost) return

		const x = 10 + Math.random() * 80 // 10-90% to avoid edges
		const y = 10 + Math.random() * 80

		const result = await call<{ x: number; y: number }, { success: boolean; coinId?: string; error?: string }>(
			'spawnCoin',
			{ x, y }
		)

		if (result.success && result.result?.success) {
			setLastResult(`Spawned coin!`)
		} else {
			setLastResult(`Failed: ${result.error || result.result?.error}`)
		}
	}, [isHost, call])

	// Collect a coin
	const handleCollectCoin = useCallback(
		async (coinId: string) => {
			if (collecting) return // Prevent double-clicks

			setCollecting(coinId)

			const result = await call<{ coinId: string }, { success: boolean; points?: number; total?: number; error?: string }>(
				'collect',
				{ coinId }
			)

			setCollecting(null)

			if (result.success && result.result?.success) {
				setLastResult(`+${result.result.points} points! Total: ${result.result.total}`)
			} else {
				setLastResult(`${result.error || result.result?.error}`)
			}
		},
		[collecting, call]
	)

	// Clear collected coins (host only)
	const handleClearCollected = useCallback(async () => {
		if (!isHost) return

		await call<{ all?: boolean }, { success: boolean }>('clearCollected', { all: false })
		setLastResult('Cleared collected coins')
	}, [isHost, call])

	// Auto-dismiss result message
	useEffect(() => {
		if (lastResult) {
			const timer = setTimeout(() => setLastResult(null), 2000)
			return () => clearTimeout(timer)
		}
	}, [lastResult])

	// Get active (uncollected) coins
	const activeCoins = Object.values(gameState.coins).filter((c) => !c.collected)
	const collectedCoins = Object.values(gameState.coins).filter((c) => c.collected)

	// Get sorted scores for leaderboard
	const leaderboard = Object.entries(gameState.scores)
		.map(([id, score]) => {
			const client = clients.find((c) => c.id === id)
			const name = client?.data?.username ?? id.slice(0, 8)
			return { id, name, score, isYou: id === clientId }
		})
		.sort((a, b) => b.score - a.score)

	return (
		<div className="coin-game">
			<h3>Coin Collector</h3>
			<p className="coin-description">
				Server-authoritative game: Click coins to collect them. Points are validated server-side.
			</p>

			{/* Game field */}
			<div className="coin-field">
				{/* Active coins */}
				{activeCoins.map((coin) => (
					<button
						key={coin.id}
						className={`coin ${collecting === coin.id ? 'collecting' : ''}`}
						style={{ left: `${coin.x}%`, top: `${coin.y}%` }}
						onClick={() => handleCollectCoin(coin.id)}
						disabled={collecting !== null}
						title={`${coin.value} points`}
					>
						<span className="coin-value">{coin.value}</span>
					</button>
				))}

				{/* Collected coin ghosts */}
				{collectedCoins.map((coin) => (
					<div
						key={coin.id}
						className="coin-ghost"
						style={{ left: `${coin.x}%`, top: `${coin.y}%` }}
					/>
				))}

				{/* Empty state */}
				{activeCoins.length === 0 && (
					<div className="coin-empty">
						{isHost ? 'Click "Spawn Coin" to add coins!' : 'Waiting for host to spawn coins...'}
					</div>
				)}
			</div>

			{/* Controls */}
			<div className="coin-controls">
				{isHost && (
					<>
						<button className="spawn-btn" onClick={handleSpawnCoin}>
							Spawn Coin
						</button>
						{collectedCoins.length > 0 && (
							<button className="clear-btn" onClick={handleClearCollected}>
								Clear Collected ({collectedCoins.length})
							</button>
						)}
					</>
				)}
				{!isHost && <span className="host-hint">Only the host can spawn coins</span>}
			</div>

			{/* Result message */}
			{lastResult && <div className="coin-result">{lastResult}</div>}

			{/* Server notifications - from ctx.broadcast() and ctx.send() */}
			{notifications.length > 0 && (
				<div className="coin-notifications">
					{notifications.map((n) => (
						<div key={n.id} className={`notification notification-${n.type}`}>
							{n.message}
						</div>
					))}
				</div>
			)}

			{/* Leaderboard */}
			{leaderboard.length > 0 && (
				<div className="leaderboard">
					<h4>Leaderboard</h4>
					<ol className="leaderboard-list">
						{leaderboard.map((entry, index) => (
							<li key={entry.id} className={entry.isYou ? 'is-you' : ''}>
								<span className="rank">{index + 1}.</span>
								<span className="name">{entry.name}</span>
								<span className="score">{entry.score} pts</span>
							</li>
						))}
					</ol>
				</div>
			)}

			{/* API info - comprehensive list of all demonstrated APIs */}
			<div className="api-info">
				<details>
					<summary>APIs Demonstrated</summary>
					<div className="api-section">
						<strong>Client-side:</strong>
						<ul>
							<li><code>useSyncState</code> - Subscribe to state</li>
							<li><code>useSyncCall</code> - RPC to server</li>
							<li><code>useSyncBroadcast</code> - Receive notifications</li>
						</ul>
					</div>
					<div className="api-section">
						<strong>Server handler:</strong>
						<ul>
							<li><code>schema</code> - Validate state structure</li>
							<li><code>validate()</code> - Block direct updates</li>
							<li><code>transform()</code> - Add server timestamps</li>
							<li><code>onUpdate()</code> - Post-broadcast logging</li>
						</ul>
					</div>
					<div className="api-section">
						<strong>RPC context:</strong>
						<ul>
							<li><code>ctx.params</code> - Route params [channelId]</li>
							<li><code>ctx.getState/setState</code> - State access</li>
							<li><code>ctx.getHost()</code> - Get activity host</li>
							<li><code>ctx.getClients()</code> - All connected users</li>
							<li><code>ctx.broadcast()</code> - Notify all clients</li>
							<li><code>ctx.send()</code> - Message specific client</li>
						</ul>
					</div>
					<div className="api-section">
						<strong>Middleware:</strong>
						<ul>
							<li><code>before()</code> - Pre-handler hook</li>
							<li><code>after()</code> - Post-broadcast hook</li>
						</ul>
					</div>
				</details>
			</div>
		</div>
	)
}
