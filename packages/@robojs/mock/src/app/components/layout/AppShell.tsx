import { useCallback, useMemo, useState, useEffect } from 'react'
import { useSession } from '../../hooks/useSession'
import { useIsPlaybackMode, usePlaybackChannels, usePlaybackMembers, usePlaybackGuilds } from '../../stores/playbackStore'
import { FriendsAppShell } from '../friends'
import { ServerList } from '../sidebar/ServerList'
import { ChannelList } from '../sidebar/ChannelList'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { MessageArea } from '../messages/MessageArea'
import { MemberList } from '../members/MemberList'
import { ThreadList } from '../threads/ThreadList'
import { PlaybackControls } from '../playback/PlaybackControls'
import { DevToolsPanel } from '../devtools/DevToolsPanel'
import styles from './AppShell.module.css'

export function AppShell() {
	const {
		guilds,
		guildChannels,
		guildMembers,
		guildRoles,
		guildVoiceStates,
		users,
		selectedGuildId,
		selectedChannelId,
		showMembers,
		selectGuild,
		selectChannel,
		toggleMembers,
		botUser,
		sessionId,
		joinVoice,
		leaveVoice
	} = useSession()

	// Home view toggle (Friends UI) via the top-left Home button in the server list.
	const [showHome, setShowHome] = useState(false)

	// Mobile sidebar state
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

	// Threads panel state
	const [showThreads, setShowThreads] = useState(false)

	// Notifications dropdown state
	const [showNotifications, setShowNotifications] = useState(false)

	// Pinned messages dropdown state
	const [showPinnedMessages, setShowPinnedMessages] = useState(false)

	// Playback mode hooks
	const isPlaybackMode = useIsPlaybackMode()
	const playbackGuilds = usePlaybackGuilds()

	// In playback mode, we need our own guild/channel selection since session data may be stale
	const [playbackSelectedGuildId, setPlaybackSelectedGuildId] = useState<string | null>(null)
	const [playbackSelectedChannelId, setPlaybackSelectedChannelId] = useState<string | null>(null)

	// Determine which guild/channel ID to use based on mode
	const activeGuildId = isPlaybackMode && playbackSelectedGuildId ? playbackSelectedGuildId : selectedGuildId
	const activeChannelId = isPlaybackMode && playbackSelectedChannelId ? playbackSelectedChannelId : selectedChannelId

	const playbackChannels = usePlaybackChannels(activeGuildId)
	const playbackMembers = usePlaybackMembers(activeGuildId)

	// Use playback data when in playback mode, otherwise use session data
	const displayGuilds = isPlaybackMode && playbackGuilds !== null ? playbackGuilds : guilds
	const displayChannels = isPlaybackMode && playbackChannels !== null ? playbackChannels : guildChannels
	const displayMembers = isPlaybackMode && playbackMembers !== null ? playbackMembers : guildMembers

	// Get the selected guild/channel objects based on mode
	const displaySelectedGuild = useMemo(() => {
		if (!activeGuildId) return null
		return displayGuilds.find(g => g.id === activeGuildId) ?? null
	}, [displayGuilds, activeGuildId])

	const displaySelectedChannel = useMemo(() => {
		if (!activeChannelId) return null
		return displayChannels.find(c => c.id === activeChannelId) ?? null
	}, [displayChannels, activeChannelId])

	// Auto-select first guild when entering playback mode
	useEffect(() => {
		if (isPlaybackMode && playbackGuilds && playbackGuilds.length > 0 && !playbackSelectedGuildId) {
			setPlaybackSelectedGuildId(playbackGuilds[0].id)
		}
		// Reset when leaving playback mode
		if (!isPlaybackMode && playbackSelectedGuildId) {
			setPlaybackSelectedGuildId(null)
			setPlaybackSelectedChannelId(null)
		}
	}, [isPlaybackMode, playbackGuilds, playbackSelectedGuildId])

	// Auto-select first channel when guild changes in playback mode
	useEffect(() => {
		if (isPlaybackMode && playbackChannels && playbackChannels.length > 0 && !playbackSelectedChannelId) {
			// Find first text channel (type 0)
			const textChannel = playbackChannels.find(c => c.type === 0)
			if (textChannel) {
				setPlaybackSelectedChannelId(textChannel.id)
			} else if (playbackChannels.length > 0) {
				setPlaybackSelectedChannelId(playbackChannels[0].id)
			}
		}
	}, [isPlaybackMode, playbackChannels, playbackSelectedChannelId])

	// Combine users with botUser for voice channel display (Phase 5P)
	const allUsers = useMemo(() => {
		if (!botUser) return users
		const botInUsers = users.some((u) => u.id === botUser.id)
		return botInUsers ? users : [...users, botUser]
	}, [users, botUser])

	const handleMobileMenuToggle = useCallback(() => {
		setMobileSidebarOpen((prev) => !prev)
	}, [])

	// Wrap guild selection to exit Home view
	const handleGuildSelect = useCallback(
		(guildId: string | null) => {
			setShowHome(false)
			if (isPlaybackMode) {
				setPlaybackSelectedGuildId(guildId)
				setPlaybackSelectedChannelId(null) // Reset channel when guild changes
			} else {
				selectGuild(guildId)
			}
		},
		[selectGuild, isPlaybackMode]
	)

	// Wrap channel selection to close mobile sidebar
	const handleChannelSelect = useCallback(
		(channelId: string | null) => {
			if (channelId) {
				if (isPlaybackMode) {
					setPlaybackSelectedChannelId(channelId)
				} else {
					selectChannel(channelId)
				}
			}
			setMobileSidebarOpen(false)
		},
		[selectChannel, isPlaybackMode]
	)

	const handleToggleThreads = useCallback(() => {
		setShowThreads((prev) => {
			if (!prev) {
				setShowNotifications(false)
				setShowPinnedMessages(false)
			}
			return !prev
		})
	}, [])

	const handleToggleNotifications = useCallback(() => {
		setShowNotifications((prev) => {
			if (!prev) {
				setShowThreads(false)
				setShowPinnedMessages(false)
			}
			return !prev
		})
	}, [])

	const handleTogglePinnedMessages = useCallback(() => {
		setShowPinnedMessages((prev) => {
			if (!prev) {
				setShowThreads(false)
				setShowNotifications(false)
			}
			return !prev
		})
	}, [])

	const handleHomeClick = useCallback(() => {
		// Home button should always take you to Friends/Home (no toggle-off).
		// Users go back to the server UI by clicking a server.
		setShowHome(true)
		selectGuild(null)
		selectChannel(null)
		// Close any open mobile sidebars/dropdowns when switching
		setMobileSidebarOpen(false)
		setShowThreads(false)
		setShowNotifications(false)
		setShowPinnedMessages(false)
	}, [selectGuild, selectChannel])

	const guildName = () => {
		const filterGuilds = displayGuilds.filter((guild) => guild.id === activeGuildId)
		if (filterGuilds.length > 0) {
			return `${filterGuilds[0].icon ? filterGuilds[0].icon + ' | ' : ''}  ${filterGuilds[0].name}`
		}
		return 'unknown guild name'
	}

	const shellClassName = `${styles.shell}${mobileSidebarOpen ? ` ${styles.sidebarOpen}` : ''}`

	return (
		<div className={shellClassName}>
			<div className={styles.topShell}>
				<span>{guildName()}</span>
			</div>

			<div className={styles.contentWrapper}>
				<div className={styles.serverList}>
					<ServerList
						guilds={displayGuilds}
						selectedId={activeGuildId}
						onSelect={handleGuildSelect}
						sessionId={sessionId}
						onHomeClick={handleHomeClick}
						homeSelected={showHome}
					/>
				</div>

				<div className={styles.mainContent}>
					{showHome ? (
						<FriendsAppShell />
					) : (
						<>
							<ChannelList
								guild={displaySelectedGuild ?? undefined}
								channels={displayChannels}
								selectedId={activeChannelId}
								onSelect={handleChannelSelect}
								voiceStates={guildVoiceStates}
								users={allUsers}
								onJoinVoice={joinVoice}
								onLeaveVoice={leaveVoice}
								currentUserId={botUser?.id}
							/>
							<div className={styles.main}>
								<Header
									channel={displaySelectedChannel}
									onToggleMembers={toggleMembers}
									showMembers={showMembers}
									onToggleThreads={handleToggleThreads}
									showThreads={showThreads}
									onToggleNotifications={handleToggleNotifications}
									showNotifications={showNotifications}
									onTogglePinnedMessages={handleTogglePinnedMessages}
									showPinnedMessages={showPinnedMessages}
									onMobileMenuToggle={handleMobileMenuToggle}
									isMobileSidebarOpen={mobileSidebarOpen}
								/>

								<div className={styles.content}>
									<MessageArea channelId={activeChannelId} />
									{showThreads && <ThreadList />}
									{showMembers && <MemberList members={displayMembers} roles={guildRoles} />}
								</div>
							</div>
						</>
					)}
				</div>
			</div>

			{/* Bottom bar with playback controls and status */}
			<div className={styles.bottomBar}>
				<PlaybackControls />
				<StatusBar />
			</div>

			{/* Developer Tools Panel */}
			<DevToolsPanel />
		</div>
	)
}
