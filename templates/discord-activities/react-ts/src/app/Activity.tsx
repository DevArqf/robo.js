import { useCallback, useState } from 'react'
import { useSyncState, useSyncContext, useSyncBroadcast } from '@robojs/sync'
import { useDiscordSdk } from '../hooks/useDiscordSdk'
import { Cursors } from './Cursors'
import { SyncBalls } from './SyncBalls'
import type { Client } from '@robojs/sync'

interface UserData {
	odId: string
	username: string
	odAvatar: string | null
}

interface GameState {
	count: number
	lastUpdatedBy: string | null
}

interface Reaction {
	id: string
	emoji: string
	x: number
	y: number
	sender: string
}

const EMOJIS = ['🎉', '❤️', '🔥', '👍', '🚀', '✨', '😂', '🎮']

export const Activity = () => {
	const { discordSdk, session } = useDiscordSdk()
	const [notifications, setNotifications] = useState<string[]>([])
	const [reactions, setReactions] = useState<Reaction[]>([])
	const [showCursors, setShowCursors] = useState(true)

	// Use actual channel ID in Discord, fixed demo room for browser testing
	// (Mock SDK generates random channel IDs per browser, which would put each tab in separate rooms)
	const isEmbedded = new URLSearchParams(window.location.search).get('frame_id') != null
	const roomKey = ['activity', isEmbedded ? (discordSdk.channelId ?? 'lobby') : 'demo']

	// useSyncState - Shared counter state
	const [gameState, setGameState, context] = useSyncState<GameState, UserData>(
		{ count: 0, lastUpdatedBy: null },
		roomKey
	)

	// useSyncContext - For join/leave notifications
	useSyncContext<UserData>(
		{
			onConnect: (client) => {
				const name = client.data?.username ?? client.id.slice(0, 8)
				addNotification(`${name} joined`)
			},
			onDisconnect: (client) => {
				const name = client.data?.username ?? client.id.slice(0, 8)
				addNotification(`${name} left`)
			}
		},
		roomKey
	)

	// useSyncBroadcast - For ephemeral reactions
	const { broadcast } = useSyncBroadcast<UserData>(
		(payload, { client }) => {
			const reaction = payload as { emoji: string; x: number; y: number }
			const name = client.data?.username ?? client.id.slice(0, 8)
			addReaction(reaction.emoji, reaction.x, reaction.y, name)
		},
		roomKey
	)

	const addNotification = useCallback((message: string) => {
		setNotifications((prev) => [...prev.slice(-4), message])
		// Auto-remove after 3 seconds
		setTimeout(() => {
			setNotifications((prev) => prev.slice(1))
		}, 3000)
	}, [])

	const addReaction = useCallback((emoji: string, x: number, y: number, sender: string) => {
		const id = Math.random().toString(36).slice(2)
		setReactions((prev) => [...prev, { id, emoji, x, y, sender }])
		// Remove after animation
		setTimeout(() => {
			setReactions((prev) => prev.filter((r) => r.id !== id))
		}, 2000)
	}, [])

	const handleIncrement = () => {
		const username = session?.user?.username ?? 'Anonymous'
		setGameState({
			count: gameState.count + 1,
			lastUpdatedBy: username
		})
	}

	const handleDecrement = () => {
		const username = session?.user?.username ?? 'Anonymous'
		setGameState({
			count: gameState.count - 1,
			lastUpdatedBy: username
		})
	}

	const handleReaction = (emoji: string) => {
		// Random position within the activity area
		const x = 20 + Math.random() * 60
		const y = 20 + Math.random() * 60
		const name = session?.user?.username ?? 'You'

		// Show locally
		addReaction(emoji, x, y, name)

		// Broadcast to others
		broadcast({ emoji, x, y })
	}

	return (
		<div className="activity">
			{/* Synced cursors */}
			{showCursors && <Cursors roomKey={roomKey} />}

			{/* Draggable synced balls */}
			<SyncBalls roomKey={roomKey} />

			{/* Floating reactions */}
			{reactions.map((reaction) => (
				<div
					key={reaction.id}
					className="floating-reaction"
					style={{ left: `${reaction.x}%`, top: `${reaction.y}%` }}
				>
					<span className="reaction-emoji">{reaction.emoji}</span>
					<span className="reaction-sender">{reaction.sender}</span>
				</div>
			))}

			{/* Header with connection info */}
			<header className="header">
				<div className="connection-info">
					<div className="client-count">
						<span className="dot" />
						{context.clients.length} {context.clients.length === 1 ? 'player' : 'players'}
					</div>
					{context.isHost && <span className="host-badge">HOST</span>}
					<label className="cursor-toggle">
						<input type="checkbox" checked={showCursors} onChange={(e) => setShowCursors(e.target.checked)} />
						Cursors
					</label>
				</div>
				<div className="client-id">You: {session?.user?.username ?? context.clientId.slice(0, 8)}</div>
			</header>

			{/* Main content */}
			<main className="main">
				<h1>Sync Demo</h1>

				{/* Connected players */}
				<div className="players">
					<h3>Connected Players</h3>
					<div className="player-list">
						{context.clients.map((client) => (
							<PlayerAvatar key={client.id} client={client} isYou={client.id === context.clientId} />
						))}
					</div>
				</div>

				{/* Shared counter */}
				<div className="counter-section">
					<h3>Shared Counter</h3>
					<p className="counter-description">This counter is synchronized across all players in real-time</p>
					<div className="counter">
						<button onClick={handleDecrement} className="counter-btn">
							-
						</button>
						<span className="counter-value">{gameState.count}</span>
						<button onClick={handleIncrement} className="counter-btn">
							+
						</button>
					</div>
					{gameState.lastUpdatedBy && <p className="last-updated">Last updated by: {gameState.lastUpdatedBy}</p>}
				</div>

				{/* Reactions */}
				<div className="reactions-section">
					<h3>Send Reactions</h3>
					<p className="reactions-description">Broadcast ephemeral reactions to all players</p>
					<div className="emoji-picker">
						{EMOJIS.map((emoji) => (
							<button key={emoji} onClick={() => handleReaction(emoji)} className="emoji-btn">
								{emoji}
							</button>
						))}
					</div>
				</div>
			</main>

			{/* Notifications */}
			<div className="notifications">
				{notifications.map((msg, i) => (
					<div key={i} className="notification">
						{msg}
					</div>
				))}
			</div>

			{/* Footer */}
			<footer className="footer">
				<small>
					Powered by <strong>Robo.js</strong> + <strong>@robojs/sync</strong>
				</small>
			</footer>
		</div>
	)
}

function PlayerAvatar({ client, isYou }: { client: Client<UserData>; isYou: boolean }) {
	const username = client.data?.username ?? client.id.slice(0, 8)
	const initial = username[0].toUpperCase()

	return (
		<div className={`player-avatar ${isYou ? 'is-you' : ''}`} title={username}>
			<div className="avatar">{initial}</div>
			<span className="player-name">
				{username}
				{isYou && ' (you)'}
			</span>
		</div>
	)
}
