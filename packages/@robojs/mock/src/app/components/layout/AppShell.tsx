import { useState, useCallback, useMemo } from 'react'
import { useSession } from '../../hooks/useSession'
import { useIsPlaybackMode, usePlaybackChannels, usePlaybackMembers } from '../../stores/playbackStore'
import { ServerList } from '../sidebar/ServerList'
import { ChannelList } from '../sidebar/ChannelList'
import { UserArea } from '../sidebar/UserArea'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { MessageArea } from '../messages/MessageArea'
import { MemberList } from '../members/MemberList'
import { PlaybackControls } from '../playback/PlaybackControls'
import { DevToolsPanel } from '../devtools/DevToolsPanel'
import styles from './AppShell.module.css'

export function AppShell() {
	const { guilds, guildChannels, guildMembers, guildRoles, guildVoiceStates, users, selectedGuildId, selectedChannelId, showMembers, selectGuild, selectChannel, toggleMembers, selectedChannel, selectedGuild, botUser, sessionId, joinVoice, leaveVoice } =
		useSession()

	// Mobile sidebar state
	const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

	// Playback mode hooks
	const isPlaybackMode = useIsPlaybackMode()
	const playbackChannels = usePlaybackChannels(selectedGuildId)
	const playbackMembers = usePlaybackMembers(selectedGuildId)

	// Use playback data when in playback mode, otherwise use session data
	const displayChannels = isPlaybackMode && playbackChannels !== null ? playbackChannels : guildChannels
	const displayMembers = isPlaybackMode && playbackMembers !== null ? playbackMembers : guildMembers

	// Combine users with botUser for voice channel display (Phase 5P)
	const allUsers = useMemo(() => {
		if (!botUser) return users
		// Check if botUser is already in users
		const botInUsers = users.some((u) => u.id === botUser.id)
		return botInUsers ? users : [...users, botUser]
	}, [users, botUser])

	const handleMobileMenuToggle = useCallback(() => {
		setMobileSidebarOpen((prev) => !prev)
	}, [])

	const handleCloseMobileSidebar = useCallback(() => {
		setMobileSidebarOpen(false)
	}, [])

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

	const shellClassName = `${styles.shell}${mobileSidebarOpen ? ` ${styles.sidebarOpen}` : ''}`

	return (
		<div className={shellClassName}>
			{/* Server list (far left - guild icons) */}
			<div className={styles.serverList}>
				<ServerList guilds={guilds} selectedId={selectedGuildId} onSelect={selectGuild} sessionId={sessionId} />
			</div>

			{/* Channel list */}
			<div className={styles.channelList}>
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
				<UserArea user={botUser} />
			</div>

			{/* Mobile sidebar overlay */}
			<div className={styles.sidebarOverlay} onClick={handleCloseMobileSidebar} aria-hidden="true" />

			{/* Mobile sidebar (duplicates server + channel list for mobile) */}
			<div className={styles.sidebarMobile} role="navigation" aria-label="Server and channel navigation">
				<div className={styles.serverList}>
					<ServerList guilds={guilds} selectedId={selectedGuildId} onSelect={selectGuild} sessionId={sessionId} />
				</div>
				<div className={styles.channelList}>
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
					<UserArea user={botUser} />
				</div>
			</div>

			{/* Main content area */}
			<div className={styles.main}>
				<Header
					channel={selectedChannel}
					onToggleMembers={toggleMembers}
					showMembers={showMembers}
					onMobileMenuToggle={handleMobileMenuToggle}
					isMobileSidebarOpen={mobileSidebarOpen}
				/>

				<div className={styles.content}>
					<MessageArea channelId={selectedChannelId} />

					{showMembers && <MemberList members={displayMembers} roles={guildRoles} />}
				</div>
			</div>

			{/* Bottom bar - full width with playback controls and status */}
			<div className={styles.bottomBar}>
				<PlaybackControls />
				<StatusBar />
			</div>

			{/* Developer Tools Panel */}
			<DevToolsPanel />
		</div>
	)
}
