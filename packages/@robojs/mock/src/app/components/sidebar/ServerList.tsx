import { useState, useCallback } from 'react'
import type { StageGuild } from '../../types/stage'
import { useStageData } from '../../hooks/useStageData'
import { assetUrl } from '../../utils/api'
import CreateIcon from '../icons/create'
import styles from './ServerList.module.css'

interface ServerListProps {
	guilds: StageGuild[]
	selectedId: string | null
	onSelect: (id: string | null) => void
	unreadGuildIds?: Set<string>
	sessionId: string | null
	onHomeClick?: () => void
	homeSelected?: boolean
}

export function ServerList({ guilds, selectedId, onSelect, unreadGuildIds, sessionId, onHomeClick, homeSelected }: ServerListProps) {
	const { sendCommand } = useStageData()
	const [isSeeding, setIsSeeding] = useState(false)
	const [seedError, setSeedError] = useState<string | null>(null)

	// Detect API prefix from current URL
	const getApiPrefix = useCallback(() => {
		const pathname = window.location.pathname
		const stageIndex = pathname.indexOf('/stage')
		return stageIndex !== -1 ? pathname.slice(0, stageIndex) : ''
	}, [])

	// Seed test data when there are no guilds
	const handleSeedData = useCallback(async () => {
		if (!sessionId || isSeeding) return

		setIsSeeding(true)
		setSeedError(null)

		try {
			const prefix = getApiPrefix()
			const baseUrl = `${prefix}/api/control/sessions/${sessionId}`

			// 1. Create a test guild with channels
			const guildResponse = await fetch(`${baseUrl}/dispatch`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event: 'GUILD_CREATE',
					data: {
						id: '123456789012345678',
						name: 'Test Server',
						icon: null,
						owner_id: '987654321098765432',
						member_count: 3,
						channels: [
							{
								id: '111111111111111111',
								type: 0,
								name: 'general',
								position: 1,
								guild_id: '123456789012345678',
								parent_id: '333333333333333333'
							},
							{
								id: '222222222222222222',
								type: 0,
								name: 'bot-testing',
								position: 2,
								guild_id: '123456789012345678',
								parent_id: '333333333333333333'
							},
							{
								id: '333333333333333333',
								type: 4,
								name: 'Text Channels',
								position: 0,
								guild_id: '123456789012345678'
							}
						],
						roles: [
							{
								id: '123456789012345678',
								name: '@everyone',
								color: 0,
								position: 0,
								hoist: false,
								permissions: '0'
							},
							{
								id: '444444444444444444',
								name: 'Admin',
								color: 15158332,
								position: 3,
								hoist: true,
								permissions: '8'
							},
							{
								id: '555555555555555555',
								name: 'Moderator',
								color: 3447003,
								position: 2,
								hoist: true,
								permissions: '0'
							},
							{
								id: '666666666666666666',
								name: 'Bot',
								color: 5793266,
								position: 1,
								hoist: true,
								permissions: '0'
							}
						],
						members: [
							{
								user: {
									id: '100000000000000001',
									username: 'TestUser',
									discriminator: '0',
									avatar: null,
									bot: false
								},
								roles: ['444444444444444444'],
								joined_at: '2024-01-01T00:00:00.000Z'
							},
							{
								user: {
									id: '100000000000000002',
									username: 'MockBot',
									discriminator: '0',
									avatar: null,
									bot: true
								},
								roles: ['666666666666666666'],
								joined_at: '2024-01-01T00:00:00.000Z'
							},
							{
								user: {
									id: '100000000000000003',
									username: 'AnotherUser',
									discriminator: '0',
									avatar: null,
									bot: false
								},
								roles: ['555555555555555555'],
								joined_at: '2024-01-02T00:00:00.000Z'
							}
						]
					}
				})
			})

			if (!guildResponse.ok) {
				throw new Error('Failed to create guild')
			}

			// Small delay to let state propagate
			await new Promise((resolve) => setTimeout(resolve, 200))

			// 2. Send test messages with various content types
			const messages: Array<{
				content: string
				author: { id: string; username: string; bot?: boolean }
				embeds?: unknown[]
				attachments?: unknown[]
				components?: unknown[]
				reactions?: Array<{ emoji: { id: null; name: string }; count: number; me: boolean }>
			}> = [
				{
					content: 'Hello! Welcome to the test server. 👋',
					author: { id: '100000000000000001', username: 'TestUser', bot: false },
					reactions: [
						{ emoji: { id: null, name: '👋' }, count: 3, me: false },
						{ emoji: { id: null, name: '🎉' }, count: 2, me: true }
					]
				},
				{
					content: 'Hi there! I am a bot responding to your message.',
					author: { id: '100000000000000002', username: 'MockBot', bot: true },
					reactions: [
						{ emoji: { id: null, name: '👍' }, count: 5, me: false },
						{ emoji: { id: null, name: '❤️' }, count: 2, me: true },
						{ emoji: { id: null, name: '🔥' }, count: 1, me: false }
					]
				},
				{
					content: 'This second message should be grouped with my first one!',
					author: { id: '100000000000000001', username: 'TestUser', bot: false }
				},
				{
					content: 'And I am a different user joining the conversation!',
					author: { id: '100000000000000003', username: 'AnotherUser', bot: false }
				},
				// Message with markdown
				{
					content: 'Here is some **bold text**, *italic*, and `inline code`.\n```js\nconsole.log("Hello!")\n```',
					author: { id: '100000000000000002', username: 'MockBot', bot: true }
				},
				// Message with embed
				{
					content: 'Check out this embed:',
					author: { id: '100000000000000002', username: 'MockBot', bot: true },
					embeds: [
						{
							title: 'Example Embed',
							description: 'This is an example embed with **markdown** support and various fields.',
							color: 0x5865f2,
							url: 'https://discord.com',
							author: {
								name: 'Embed Author',
								icon_url: assetUrl('/avatars/0.png')
							},
							fields: [
								{ name: 'Inline Field 1', value: 'Value 1', inline: true },
								{ name: 'Inline Field 2', value: 'Value 2', inline: true },
								{ name: 'Inline Field 3', value: 'Value 3', inline: true },
								{ name: 'Regular Field', value: 'This is a full-width field with more content.' }
							],
							thumbnail: {
								url: assetUrl('/avatars/1.png')
							},
							image: {
								url: 'https://picsum.photos/400/200',
								width: 400,
								height: 200
							},
							footer: {
								text: 'Footer text here',
								icon_url: assetUrl('/avatars/2.png')
							},
							timestamp: new Date().toISOString()
						}
					]
				},
				// Message with image attachment
				{
					content: 'Here is an image attachment:',
					author: { id: '100000000000000001', username: 'TestUser', bot: false },
					attachments: [
						{
							id: '444444444444444444',
							filename: 'sample-image.png',
							content_type: 'image/png',
							size: 102400,
							url: 'https://picsum.photos/300/200',
							proxy_url: 'https://picsum.photos/300/200',
							width: 300,
							height: 200,
							description: 'A sample image for testing'
						}
					]
				},
				// Message with file attachment
				{
					content: 'And here is a file download:',
					author: { id: '100000000000000002', username: 'MockBot', bot: true },
					attachments: [
						{
							id: '555555555555555555',
							filename: 'document.pdf',
							content_type: 'application/pdf',
							size: 256000,
							url: '#',
							proxy_url: '#'
						}
					]
				},
				// Message with spoiler image
				{
					content: 'Spoiler image below:',
					author: { id: '100000000000000003', username: 'AnotherUser', bot: false },
					attachments: [
						{
							id: '666666666666666666',
							filename: 'SPOILER_hidden.jpg',
							content_type: 'image/jpeg',
							size: 51200,
							url: 'https://picsum.photos/250/150',
							proxy_url: 'https://picsum.photos/250/150',
							width: 250,
							height: 150,
							spoiler: true
						}
					]
				},
				// Message with buttons
				{
					content: 'Here are some interactive buttons:',
					author: { id: '100000000000000002', username: 'MockBot', bot: true },
					components: [
						{
							type: 1, // ActionRow
							components: [
								{
									type: 2, // Button
									style: 1, // Primary (blurple)
									label: 'Open Modal',
									emoji: { name: '📝' },
									custom_id: 'test_modal' // Triggers test modal response
								},
								{
									type: 2,
									style: 2, // Secondary (grey)
									label: 'Secondary',
									custom_id: 'btn_secondary'
								},
								{
									type: 2,
									style: 3, // Success (green)
									label: 'Success',
									custom_id: 'btn_success'
								},
								{
									type: 2,
									style: 4, // Danger (red)
									label: 'Danger',
									custom_id: 'btn_danger'
								},
								{
									type: 2,
									style: 5, // Link
									label: 'Link',
									url: 'https://discord.com'
								}
							]
						},
						{
							type: 1,
							components: [
								{
									type: 2,
									style: 1,
									label: 'With Emoji',
									emoji: { name: '🎉' },
									custom_id: 'btn_emoji'
								},
								{
									type: 2,
									style: 2,
									label: 'Disabled',
									custom_id: 'btn_disabled',
									disabled: true
								}
							]
						}
					]
				},
				// Message with select menu
				{
					content: 'Choose your favorite color:',
					author: { id: '100000000000000002', username: 'MockBot', bot: true },
					components: [
						{
							type: 1,
							components: [
								{
									type: 3, // String Select
									custom_id: 'select_color',
									placeholder: 'Select a color...',
									options: [
										{
											label: 'Red',
											value: 'red',
											description: 'The color of passion',
											emoji: { name: '🔴' }
										},
										{
											label: 'Green',
											value: 'green',
											description: 'The color of nature',
											emoji: { name: '🟢' }
										},
										{
											label: 'Blue',
											value: 'blue',
											description: 'The color of the sky',
											emoji: { name: '🔵' }
										},
										{
											label: 'Yellow',
											value: 'yellow',
											description: 'The color of sunshine',
											emoji: { name: '🟡' }
										},
										{
											label: 'Purple',
											value: 'purple',
											description: 'The color of royalty',
											emoji: { name: '🟣' }
										}
									]
								}
							]
						}
					]
				}
			]

			for (const msg of messages) {
				await fetch(`${baseUrl}/dispatch`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						event: 'MESSAGE_CREATE',
						data: {
							channel_id: '111111111111111111',
							content: msg.content,
							author: msg.author,
							embeds: msg.embeds || [],
							attachments: msg.attachments || [],
							components: msg.components || [],
							reactions: msg.reactions || []
						}
					})
				})
				// Small delay between messages
				await new Promise((resolve) => setTimeout(resolve, 50))
			}

			// 3. Dispatch a typing indicator to demonstrate that feature
			await fetch(`${baseUrl}/dispatch`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					event: 'TYPING_START',
					data: {
						channel_id: '111111111111111111',
						guild_id: '123456789012345678',
						user_id: '100000000000000001',
						user: {
							id: '100000000000000001',
							username: 'TestUser'
						},
						member: {
							nick: null
						}
					}
				})
			})

			// Request state refresh to update the UI
			await sendCommand('request_state', {})
		} catch (err) {
			setSeedError(err instanceof Error ? err.message : 'Failed to seed data')
			console.error('Seed error:', err)
		} finally {
			setIsSeeding(false)
		}
	}, [sessionId, isSeeding, getApiPrefix, sendCommand])

	const hasNoGuilds = guilds.length === 0

	return (
		<nav className={styles.container} aria-label="Server list">
			{/* Home/DM button */}
			<div className={`${styles.serverWrapper} ${homeSelected ? styles.selected : ''}`}>
				<div className={styles.pill} />
				<button
					className={styles.homeButton}
					title="Direct Messages"
					aria-label="Direct Messages"
					aria-current={homeSelected ? 'page' : undefined}
					onClick={onHomeClick}
					type="button"
				>
					<DiscordLogo />
				</button>
			</div>

			<div className={styles.separator} role="separator" />

			{/* Guild icons */}
			<div role="listbox" aria-label="Servers">
				{guilds.map((guild) => {
					const isSelected = selectedId === guild.id
					const hasUnread = unreadGuildIds?.has(guild.id) && !isSelected

					return (
						<div
							key={guild.id}
							className={`${styles.serverWrapper} ${isSelected ? styles.selected : ''} ${hasUnread ? styles.unread : ''}`}
							role="option"
							aria-selected={isSelected}
						>
							<div className={styles.pill} />
							<button
								className={styles.serverIcon}
								onClick={() => onSelect(guild.id)}
								title={guild.name}
								aria-label={`${guild.name}${hasUnread ? ' (has unread messages)' : ''}`}
							>
								{guild.icon ? (
									<img src={getGuildIconUrl(guild)} alt="" className={styles.iconImage} />
								) : (
									<span className={styles.serverAcronym} aria-hidden="true">
										{getGuildAcronym(guild.name)}
									</span>
								)}
							</button>
						</div>
					)
				})}
			</div>

			{/* Add server / Seed data button */}
			<div className={styles.serverWrapper}>
				<button
					className={`${styles.serverIcon} ${styles.addButton} ${isSeeding ? styles.seeding : ''}`}
					onClick={hasNoGuilds ? handleSeedData : undefined}
					disabled={isSeeding}
					title={hasNoGuilds ? 'Seed Test Data' : 'Add a Server'}
					aria-label={hasNoGuilds ? 'Seed Test Data' : 'Add a Server'}
				>
					{isSeeding ? (
						<span className={styles.spinner} aria-label="Loading" />
					) : (
						<div style={{ position: 'absolute', display: 'flex' }}>
							<CreateIcon />
						</div>
					)}
				</button>
			</div>

			{seedError && (
				<div className={styles.seedError} role="alert">
					{seedError}
				</div>
			)}
		</nav>
	)
}

function DiscordLogo() {
	return (
		<svg width="28" height="20" viewBox="0 0 28 20" fill="currentColor">
			<path d="M23.0212 1.67671C21.3107 0.879656 19.5079 0.318797 17.6584 0C17.4062 0.461742 17.1749 0.934541 16.9708 1.4184C15.003 1.12145 12.9974 1.12145 11.0283 1.4184C10.8235 0.934541 10.5921 0.461742 10.3405 0C8.48663 0.321144 6.68094 0.882055 4.97028 1.67671C1.76356 6.0856 0.890861 10.3839 1.32645 14.6222C3.30085 16.0974 5.55094 17.2269 7.97572 17.9586C8.51377 17.2297 8.99325 16.4621 9.41021 15.6603C8.62773 15.3663 7.87269 15.0083 7.15294 14.5902C7.33988 14.4516 7.52289 14.3115 7.70096 14.1699C11.3908 15.9068 15.643 15.9068 19.2997 14.1699C19.4763 14.3115 19.6593 14.4516 19.8462 14.5902C19.1265 15.0083 18.3715 15.3663 17.589 15.6603C18.006 16.4621 18.4854 17.2297 19.0235 17.9586C21.4498 17.2269 23.6998 16.0974 25.6727 14.6222C26.1779 9.68439 24.7717 5.43147 23.0212 1.67671ZM9.68041 11.9983C8.38956 11.9983 7.32987 10.8157 7.32987 9.36775C7.32987 7.91979 8.35832 6.73579 9.68041 6.73579C11.0025 6.73579 12.0622 7.91979 12.0309 9.36775C12.0309 10.8157 10.9994 11.9983 9.68041 11.9983ZM18.3195 11.9983C17.0286 11.9983 15.9689 10.8157 15.9689 9.36775C15.9689 7.91979 16.9974 6.73579 18.3195 6.73579C19.6416 6.73579 20.7012 7.91979 20.6699 9.36775C20.6699 10.8157 19.6385 11.9983 18.3195 11.9983Z" />
		</svg>
	)
}

function getGuildAcronym(name: string): string {
	return name
		.split(/\s+/)
		.map((word) => word[0])
		.join('')
		.slice(0, 3)
		.toUpperCase()
}

function getGuildIconUrl(guild: StageGuild): string {
	// For mock server, icons might be URLs or base64
	if (guild.icon?.startsWith('http') || guild.icon?.startsWith('data:')) {
		return guild.icon
	}
	// Default Discord CDN format
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
}
