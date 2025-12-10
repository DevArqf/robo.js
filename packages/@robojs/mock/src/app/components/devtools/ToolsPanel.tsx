import { useCallback, useState } from 'react'
import { usePlaybackControls, type RecordedEvent } from '../../stores/playbackStore'
import { useSession } from '../../hooks/useSession'
import { useSessionDispatch } from '../../stores/sessionStore'
import { useToaster } from '../common/Toaster'
import type { StageEventType, StageMessage, StageChannel, StageMember, StageGuild, StateSyncPayload } from '../../types/stage'
import styles from './ToolsPanel.module.css'

export function ToolsPanel() {
	const { selectedChannelId, selectedGuildId, sessionId } = useSession()
	const sessionDispatch = useSessionDispatch()
	const { addEvents } = usePlaybackControls()
	const { showToast } = useToaster()
	const [isGenerating, setIsGenerating] = useState(false)

	// Generate test data for visual testing (moved from PlaybackControls)
	const generateTestData = useCallback(async () => {
		if (!sessionId) {
			showToast('No active session. Please connect first.', 'warning')
			return
		}

		setIsGenerating(true)
		const now = Date.now()
		const testEvents: RecordedEvent[] = []

		// Use the currently selected channel ID for test messages
		const testChannelId = selectedChannelId || 'test_channel_001'
		const testGuildId = selectedGuildId || 'test_guild_001'

		// Test users with varied identities
		const testUser1 = {
			id: 'test_user_001',
			username: 'Alice',
			discriminator: '0001',
			avatar: null,
			bot: false
		}
		const testUser2 = {
			id: 'test_user_002',
			username: 'Bob',
			discriminator: '0002',
			avatar: null,
			bot: false
		}
		const testUser3 = {
			id: 'test_user_003',
			username: 'Charlie',
			discriminator: '0003',
			avatar: null,
			bot: false
		}
		const botUser = {
			id: 'test_bot_001',
			username: 'Robo',
			discriminator: '0000',
			avatar: null,
			bot: true
		}
		const moderatorBot = {
			id: 'test_bot_002',
			username: 'ModBot',
			discriminator: '0000',
			avatar: null,
			bot: true
		}

		// Create test members for the member list
		const testMembers: StageMember[] = [
			{ user: testUser1, nick: null, roles: [], joined_at: new Date(now - 86400000).toISOString(), guild_id: testGuildId },
			{ user: testUser2, nick: 'Bobby', roles: [], joined_at: new Date(now - 172800000).toISOString(), guild_id: testGuildId },
			{ user: testUser3, nick: null, roles: [], joined_at: new Date(now - 259200000).toISOString(), guild_id: testGuildId },
			{ user: botUser, nick: null, roles: [], joined_at: new Date(now - 604800000).toISOString(), guild_id: testGuildId },
			{ user: moderatorBot, nick: null, roles: [], joined_at: new Date(now - 604800000).toISOString(), guild_id: testGuildId }
		]

		// Create the general channel (used for test messages)
		const generalChannel: StageChannel = {
			id: testChannelId,
			name: 'general',
			type: 0,
			guild_id: testGuildId,
			position: 0,
			topic: 'Chat about anything and everything here'
		}

		// Create additional test channels
		const additionalChannels: StageChannel[] = [
			{ id: 'test_channel_announcements', name: 'announcements', type: 5, guild_id: testGuildId, position: 1, topic: 'Server news and important updates' },
			{ id: 'test_channel_bot_commands', name: 'bot-commands', type: 0, guild_id: testGuildId, position: 2, topic: 'Run bot commands here' },
			{ id: 'test_channel_off_topic', name: 'off-topic', type: 0, guild_id: testGuildId, position: 3, topic: 'Random discussions' },
			{ id: 'test_voice_general', name: 'General', type: 2, guild_id: testGuildId, position: 10 },
			{ id: 'test_voice_gaming', name: 'Gaming', type: 2, guild_id: testGuildId, position: 11 }
		]

		// All channels for state_sync
		const allChannels: StageChannel[] = [generalChannel, ...additionalChannels]

		// Test guild
		const testGuild: StageGuild = {
			id: testGuildId,
			name: 'Test Server',
			icon: null,
			owner_id: testUser1.id
		}

		// Test users for state_sync
		const testUsers = [testUser1, testUser2, testUser3, botUser, moderatorBot]

		let msgId = 1000000000000000000n
		const nextMsgId = () => {
			msgId += 1n
			return msgId.toString()
		}

		// Generate comprehensive test events
		const eventSequence: { type: StageEventType; getData: (time: number) => unknown }[] = [
			// Intro messages - Alice sends two messages in a row (tests avatar grouping)
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Hey everyone! 👋 Just joined the server.',
						timestamp: new Date(time).toISOString(),
						author: testUser1,
						embeds: [],
						components: [],
						attachments: [],
						reactions: [
							{ count: 3, me: false, emoji: { id: null, name: '👋' } },
							{ count: 5, me: true, emoji: { id: null, name: '🎉' } }
						]
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Looking forward to chatting with everyone!',
						timestamp: new Date(time).toISOString(),
						author: testUser1,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'typing_start',
				getData: () => ({ user: testUser2, channel_id: testChannelId })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Welcome! Check out the **rules** channel first.',
						timestamp: new Date(time).toISOString(),
						author: testUser2,
						embeds: [],
						components: [],
						attachments: [],
						reactions: [
							{ count: 2, me: false, emoji: { id: null, name: '👍' } }
						]
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Also, feel free to ask any questions in #bot-commands',
						timestamp: new Date(time).toISOString(),
						author: testUser2,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Here\'s some **bold**, *italic*, ~~strikethrough~~, and `inline code`.',
						timestamp: new Date(time).toISOString(),
						author: testUser3,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '```js\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n```',
						timestamp: new Date(time).toISOString(),
						author: testUser3,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'And here\'s a link: https://robojs.dev',
						timestamp: new Date(time).toISOString(),
						author: testUser3,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'interaction_create',
				getData: () => ({ interaction: { name: 'help', type: 1, user: testUser1 } })
			},
			{
				type: 'interaction_response',
				getData: () => ({ interactionId: 'int_001', type: 4 })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '',
						timestamp: new Date(time).toISOString(),
						author: botUser,
						embeds: [{
							title: '📚 Help Menu',
							description: 'Welcome to **Robo**! Use the buttons below to navigate.',
							color: 5793266,
							fields: [
								{ name: '/help', value: 'Show this menu', inline: true },
								{ name: '/ping', value: 'Check latency', inline: true },
								{ name: '/info', value: 'Bot information', inline: true },
								{ name: '/poll', value: 'Create a poll', inline: true },
								{ name: '/remind', value: 'Set a reminder', inline: true },
								{ name: '/stats', value: 'Server stats', inline: true }
							],
							footer: { text: 'Robo.js • Click a button for more details' }
						}],
						components: [
							{
								type: 1,
								components: [
									{ type: 2, style: 1, label: 'Commands', custom_id: 'help_commands', emoji: { name: '📋' } },
									{ type: 2, style: 2, label: 'Settings', custom_id: 'help_settings', emoji: { name: '⚙️' } },
									{ type: 2, style: 3, label: 'Support', custom_id: 'help_support', emoji: { name: '💬' } },
									{ type: 2, style: 5, label: 'Website', url: 'https://robojs.dev' }
								]
							}
						],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Check out this cool screenshot!',
						timestamp: new Date(time).toISOString(),
						author: testUser2,
						embeds: [],
						components: [],
						attachments: [
							{
								id: 'attach_001',
								filename: 'screenshot.png',
								size: 245678,
								url: 'https://picsum.photos/400/300',
								proxy_url: 'https://picsum.photos/400/300',
								width: 400,
								height: 300,
								content_type: 'image/png'
							}
						]
					}
				})
			},
			{
				type: 'interaction_create',
				getData: () => ({ interaction: { name: 'poll', type: 1, user: testUser1 } })
			},
			{
				type: 'interaction_response',
				getData: () => ({ interactionId: 'int_002', type: 4 })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '',
						timestamp: new Date(time).toISOString(),
						author: botUser,
						embeds: [{
							title: '📊 What should we do for the next event?',
							description: 'Vote using the dropdown below!',
							color: 3447003,
							fields: [
								{ name: '🎮 Gaming Night', value: '3 votes', inline: true },
								{ name: '🎬 Movie Night', value: '5 votes', inline: true },
								{ name: '🎤 Karaoke', value: '2 votes', inline: true }
							],
							footer: { text: 'Poll ends in 24 hours • 10 total votes' }
						}],
						components: [
							{
								type: 1,
								components: [
									{
										type: 3,
										custom_id: 'poll_vote',
										placeholder: 'Cast your vote...',
										options: [
											{ label: 'Gaming Night', value: 'gaming', emoji: { name: '🎮' } },
											{ label: 'Movie Night', value: 'movie', emoji: { name: '🎬' } },
											{ label: 'Karaoke', value: 'karaoke', emoji: { name: '🎤' } }
										]
									}
								]
							}
						],
						attachments: []
					}
				})
			},
			{
				type: 'typing_start',
				getData: () => ({ user: testUser3, channel_id: testChannelId })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'https://github.com/Wave-Play/robo.js',
						timestamp: new Date(time).toISOString(),
						author: testUser3,
						embeds: [{
							type: 'rich',
							title: 'Wave-Play/robo.js',
							description: '⚡ Turbocharge Discord with effortless bots, apps, web servers, and more!',
							url: 'https://github.com/Wave-Play/robo.js',
							color: 2105893,
							thumbnail: {
								url: 'https://repository-images.githubusercontent.com/602877382/main',
								width: 200,
								height: 200
							},
							author: {
								name: 'GitHub',
								icon_url: 'https://github.githubassets.com/favicons/favicon.svg'
							},
							footer: { text: 'TypeScript • ⭐ 500+ stars' }
						}],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '',
						timestamp: new Date(time).toISOString(),
						author: moderatorBot,
						embeds: [{
							title: '⚠️ Auto-Moderation',
							description: 'A message was automatically flagged for review.',
							color: 15158332,
							fields: [
								{ name: 'Reason', value: 'Spam detection', inline: true },
								{ name: 'Action', value: 'Warning issued', inline: true }
							],
							footer: { text: 'ModBot • Keeping the server safe' }
						}],
						components: [
							{
								type: 1,
								components: [
									{ type: 2, style: 4, label: 'Appeal', custom_id: 'mod_appeal', emoji: { name: '📝' } },
									{ type: 2, style: 2, label: 'Dismiss', custom_id: 'mod_dismiss' }
								]
							}
						],
						attachments: []
					}
				})
			},
			{
				type: 'interaction_create',
				getData: () => ({ interaction: { name: 'ping', type: 1, user: testUser2 } })
			},
			{
				type: 'interaction_response',
				getData: () => ({ interactionId: 'int_003', type: 4 })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '🏓 Pong!',
						timestamp: new Date(time).toISOString(),
						author: botUser,
						embeds: [{
							color: 3066993,
							fields: [
								{ name: '📡 Latency', value: '`42ms`', inline: true },
								{ name: '🌐 API', value: '`87ms`', inline: true },
								{ name: '💾 Database', value: '`12ms`', inline: true }
							]
						}],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '> The best time to plant a tree was 20 years ago.\n> The second best time is now.\n\nWise words! 🌳',
						timestamp: new Date(time).toISOString(),
						author: testUser1,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Some pics from the hackathon 📸',
						timestamp: new Date(time).toISOString(),
						author: testUser2,
						embeds: [],
						components: [],
						attachments: [
							{
								id: 'attach_002',
								filename: 'hackathon1.jpg',
								size: 189234,
								url: 'https://picsum.photos/300/200?random=1',
								proxy_url: 'https://picsum.photos/300/200?random=1',
								width: 300,
								height: 200,
								content_type: 'image/jpeg'
							},
							{
								id: 'attach_003',
								filename: 'hackathon2.jpg',
								size: 234567,
								url: 'https://picsum.photos/300/200?random=2',
								proxy_url: 'https://picsum.photos/300/200?random=2',
								width: 300,
								height: 200,
								content_type: 'image/jpeg'
							}
						]
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '',
						timestamp: new Date(time).toISOString(),
						author: botUser,
						embeds: [{
							title: '🎭 Role Selection',
							description: 'Pick your interests to unlock channels!',
							color: 10181046,
							fields: [
								{ name: 'Available Roles', value: '🎮 Gamer\n💻 Developer\n🎨 Artist\n🎵 Music Lover' }
							]
						}],
						components: [
							{
								type: 1,
								components: [
									{
										type: 3,
										custom_id: 'role_select',
										placeholder: 'Select your roles...',
										min_values: 1,
										max_values: 4,
										options: [
											{ label: 'Gamer', value: 'gamer', emoji: { name: '🎮' }, description: 'Gaming discussions' },
											{ label: 'Developer', value: 'dev', emoji: { name: '💻' }, description: 'Coding & tech' },
											{ label: 'Artist', value: 'artist', emoji: { name: '🎨' }, description: 'Art & creativity' },
											{ label: 'Music Lover', value: 'music', emoji: { name: '🎵' }, description: 'Music channels' }
										]
									}
								]
							}
						],
						attachments: []
					}
				})
			},
			{
				type: 'interaction_create',
				getData: () => ({ interaction: { name: 'stats', type: 1, user: testUser3 } })
			},
			{
				type: 'interaction_response',
				getData: () => ({ interactionId: 'int_004', type: 4 })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'bot',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: '',
						timestamp: new Date(time).toISOString(),
						author: botUser,
						embeds: [{
							title: '📊 Server Statistics',
							color: 15844367,
							fields: [
								{ name: '👥 Members', value: '`1,234`', inline: true },
								{ name: '🟢 Online', value: '`456`', inline: true },
								{ name: '💬 Messages', value: '`5,678`', inline: true },
								{ name: '📂 Channels', value: '`24`', inline: true },
								{ name: '🏷️ Roles', value: '`18`', inline: true },
								{ name: '😀 Emojis', value: '`50`', inline: true }
							],
							thumbnail: {
								url: 'https://picsum.photos/100/100?random=3',
								width: 100,
								height: 100
							},
							footer: { text: 'Last updated' },
							timestamp: new Date(time).toISOString()
						}],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'typing_start',
				getData: () => ({ user: testUser1, channel_id: testChannelId })
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'This mock server is amazing! 🎉',
						timestamp: new Date(time).toISOString(),
						author: testUser1,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Time to **ship it** 🚀',
						timestamp: new Date(time).toISOString(),
						author: testUser2,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			},
			{
				type: 'message_create',
				getData: (time) => ({
					source: 'injected',
					message: {
						id: nextMsgId(),
						channel_id: testChannelId,
						content: 'Let\'s goooo! 🎊🎊🎊',
						timestamp: new Date(time).toISOString(),
						author: testUser3,
						embeds: [],
						components: [],
						attachments: []
					}
				})
			}
		]

		// Create state_sync event as the very first event (for playback mode)
		const stateSyncPayload: StateSyncPayload = {
			session: {
				id: 'test_session_001',
				createdAt: now,
				bot: botUser
			},
			guilds: [testGuild],
			channels: allChannels,
			members: testMembers,
			roles: [],
			messages: {},
			users: testUsers,
			commands: []
		}

		// Add state_sync as the first event
		testEvents.push({
			id: 'test_state_sync',
			seq: 0,
			type: 'state_sync' as StageEventType,
			timestamp: now,
			data: stateSyncPayload
		})

		// Spread events over 45 seconds with varying intervals
		let time = now
		eventSequence.forEach((event, index) => {
			time += 1000 + Math.random() * 2000 // 1-3 seconds between events
			testEvents.push({
				id: `test_${index + 1}`,
				seq: index + 1,
				type: event.type,
				timestamp: time,
				data: event.getData(time)
			})
		})

		// Add to playback store for playback mode
		addEvents(testEvents)

		// Also inject messages into session store for live mode interaction
		const messages: StageMessage[] = testEvents
			.filter((e) => e.type === 'message_create')
			.map((e) => {
				const data = e.data as { message: StageMessage }
				return data.message
			})

		// Dispatch messages to server-side session for reactions to work
		// This creates the messages in the mock server's state
		try {
			for (const message of messages) {
				await fetch(`/api/control/sessions/${sessionId}/dispatch`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						event: 'MESSAGE_CREATE',
						data: {
							id: message.id,
							channel_id: message.channel_id,
							content: message.content,
							author: message.author,
							embeds: message.embeds,
							attachments: message.attachments,
							components: message.components,
							reactions: message.reactions
						}
					})
				})
			}
		} catch (error) {
			console.warn('Failed to dispatch test messages to server:', error)
		}

		if (messages.length > 0 && testChannelId) {
			sessionDispatch({
				type: 'INJECT_MESSAGES',
				payload: { channelId: testChannelId, messages }
			})
		}

		// Inject test members into session store for member list
		sessionDispatch({
			type: 'INJECT_MEMBERS',
			payload: testMembers
		})

		// Inject additional test channels into session store
		sessionDispatch({
			type: 'INJECT_CHANNELS',
			payload: additionalChannels
		})

		setIsGenerating(false)
		showToast('Test data generated successfully!', 'success')
	}, [addEvents, selectedChannelId, selectedGuildId, sessionDispatch, sessionId, showToast])

	return (
		<div className={styles.container}>
			{/* Test Data Section */}
			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>Test Data</h3>
				<p className={styles.description}>
					Generate sample messages, users, and channels for testing the Stage UI.
				</p>
				<button
					className={styles.actionButton}
					onClick={generateTestData}
					disabled={isGenerating}
				>
					<BeakerIcon />
					{isGenerating ? 'Generating...' : 'Generate Test Data'}
				</button>
			</section>

			{/* Toast Testing Section */}
			<section className={styles.section}>
				<h3 className={styles.sectionTitle}>Toast Notifications</h3>
				<p className={styles.description}>
					Test different toast notification types.
				</p>
				<div className={styles.buttonGroup}>
					<button
						className={`${styles.toastButton} ${styles.info}`}
						onClick={() => showToast('This is an info message', 'info')}
					>
						Info
					</button>
					<button
						className={`${styles.toastButton} ${styles.success}`}
						onClick={() => showToast('Operation completed successfully!', 'success')}
					>
						Success
					</button>
					<button
						className={`${styles.toastButton} ${styles.warning}`}
						onClick={() => showToast('Warning: Something needs attention', 'warning')}
					>
						Warning
					</button>
					<button
						className={`${styles.toastButton} ${styles.error}`}
						onClick={() => showToast('Error: Something went wrong!', 'error')}
					>
						Error
					</button>
				</div>
			</section>
		</div>
	)
}

// Icons
function BeakerIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M5 0v1h1v5.2L2 14v1h12v-1l-4-7.8V1h1V0H5zm2 1h2v5.4l3.5 6.6h-9L7 6.4V1z" />
		</svg>
	)
}
