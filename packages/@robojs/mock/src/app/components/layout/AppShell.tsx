import { useCallback, useMemo, useState } from 'react'
import { useStageData } from '../../hooks/useStageData'
import { useLogs } from '../../stores/logsStore'
import { FriendsAppShell } from '../friends'
import { ServerList } from '../sidebar/ServerList'
import { ChannelList } from '../sidebar/ChannelList'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { MessageArea } from '../messages/MessageArea'
import { MemberList } from '../members/MemberList'
import { ThreadList } from '../threads/ThreadList'
import { LogsPanel } from '../logs'
import { PlaybackControls } from '../playback/PlaybackControls'
import { DevToolsPanel } from '../devtools/DevToolsPanel'
import styles from './AppShell.module.css'

export function AppShell() {
	// Unified hook handles live/playback mode switching automatically
	const {
		guilds,
		channels,
		members,
		roles,
		voiceStates,
		users,
		selectedGuildId,
		selectedChannelId,
		selectedGuild,
		selectedChannel,
		showMembers,
		selectGuild,
		selectChannel,
		toggleMembers,
		botUser,
		currentUser,
		sessionId,
		joinVoice,
		leaveVoice,
		unreadMentions
	} = useStageData()

	// Home view toggle (Friends UI) via the top-left Home button in the server list.
	const [showHome, setShowHome] = useState(false)
	const [homeTitle, setHomeTitle] = useState('Friends')
	const [homeResetKey, setHomeResetKey] = useState(0)

	// Mobile sidebar state
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

	// Threads panel state
	const [showThreads, setShowThreads] = useState(false)

	// Notifications dropdown state
	const [showNotifications, setShowNotifications] = useState(false)

	// Pinned messages dropdown state
	const [showPinnedMessages, setShowPinnedMessages] = useState(false)

	// Logs panel state from context
	const { isOpen: showLogs } = useLogs()

	// Combine users with botUser and currentUser for voice channel display
	const allUsers = useMemo(() => {
		const result = [...users]
		// Add botUser if not already in list
		if (botUser && !result.some((u) => u.id === botUser.id)) {
			result.push(botUser)
		}
		// Add currentUser if not already in list
		if (currentUser && !result.some((u) => u.id === currentUser.id)) {
			result.push(currentUser)
		}
		return result
	}, [users, botUser, currentUser])

	const handleMobileMenuToggle = useCallback(() => {
		setMobileSidebarOpen((prev) => !prev)
	}, [])

	// Wrap guild selection to exit Home view
	const handleGuildSelect = useCallback(
		(guildId: string | null) => {
			setShowHome(false)
			selectGuild(guildId)
		},
		[selectGuild]
	)

	// Wrap channel selection to close mobile sidebar
	const handleChannelSelect = useCallback(
		(channelId: string | null) => {
			if (channelId) {
				selectChannel(channelId)
			}
			setMobileSidebarOpen(false)
		},
		[selectChannel]
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
		setHomeTitle('Friends')
		setHomeResetKey((k) => k + 1)
		selectGuild(null)
		selectChannel(null)
		// Close any open mobile sidebars/dropdowns when switching
		setMobileSidebarOpen(false)
		setShowThreads(false)
		setShowNotifications(false)
		setShowPinnedMessages(false)
	}, [selectGuild, selectChannel])

	const guildName = () => {
		if (selectedGuild) {
			return `${selectedGuild.icon ? selectedGuild.icon + ' | ' : ''}  ${selectedGuild.name}`
		}
		return 'unknown guild name'
	}

	const topTitle = showHome ? homeTitle : guildName()

	const shellClassName = `${styles.shell}${mobileSidebarOpen ? ` ${styles.sidebarOpen}` : ''}`

	return (
		<div className={shellClassName}>
			<div className={styles.topShell}>
				<div className={styles.topTitle}>{topTitle}</div>
				<div className={styles.topIcons} aria-label="Top bar actions">
					<button className="icon-button" aria-label="Inbox" title="Inbox" type="button">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M3 3h18v12h-5l-2 3h-4l-2-3H3V3Zm2 2v8h4l2 3h2l2-3h4V5H5Z" />
						</svg>
					</button>
					<button className="icon-button" aria-label="New message" title="New message" type="button">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M20 2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7l-4 4V4a2 2 0 0 1 2-2h15Zm0 2H5v13.17L6.17 16H20V4Zm-3 3v2h-3v3h-2V9H9V7h3V4h2v3h3Z" />
						</svg>
					</button>
					<button className="icon-button" aria-label="Help" title="Help" type="button">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm0 17a1.25 1.25 0 1 1 0-2.5A1.25 1.25 0 0 1 12 19Zm2.2-7.8c-.6.55-1 1-1 2.3h-2c0-2 .7-2.9 1.6-3.7c.8-.7 1.2-1.1 1.2-1.8c0-.9-.7-1.5-1.8-1.5c-1 0-1.8.5-2.1 1.5l-1.9-.8C8.7 5.7 10.1 5 12.1 5c2.3 0 3.9 1.3 3.9 3.2c0 1.5-.9 2.4-1.8 3Z" />
						</svg>
					</button>
				</div>
			</div>

			<div className={styles.contentWrapper}>
				<div className={styles.serverList}>
					<ServerList
						guilds={guilds}
						selectedId={selectedGuildId}
						onSelect={handleGuildSelect}
						sessionId={sessionId}
						onHomeClick={handleHomeClick}
						homeSelected={showHome}
					/>
				</div>

				<div className={styles.mainContent}>
					{showHome ? (
						<FriendsAppShell onTitleChange={setHomeTitle} resetKey={homeResetKey} />
					) : (
						<>
							<ChannelList
								guild={selectedGuild ?? undefined}
								channels={displayChannels}
								selectedId={selectedChannelId}
								onSelect={handleChannelSelect}
								voiceStates={guildVoiceStates}
								users={allUsers}
								onJoinVoice={joinVoice}
								onLeaveVoice={leaveVoice}
								currentUserId={botUser?.id}
							/>
						</div>

						<div className={styles.mainContent}>
							{showHome ? (
								<FriendsAppShell />
							) : (
								<>
									<ChannelList
										guild={selectedGuild ?? undefined}
										channels={channels}
										selectedId={selectedChannelId}
										onSelect={handleChannelSelect}
										mentionCounts={unreadMentions}
										voiceStates={voiceStates}
										users={allUsers}
										onJoinVoice={joinVoice}
										onLeaveVoice={leaveVoice}
										currentUserId={currentUser?.id}
									/>
									<div className={styles.main}>
										<Header
											channel={selectedChannel}
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
											<MessageArea channelId={selectedChannelId} />
											{showThreads && <ThreadList />}
											{showMembers && <MemberList members={members} roles={roles} />}
										</div>
									</div>
								</>
							)}
						</div>
					</div>
				</div>

				{/* Logs panel - outside main area to push everything left */}
				{showLogs && <LogsPanel />}
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
