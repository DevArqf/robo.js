import { useSession } from '../../hooks/useSession'
import { ServerList } from '../sidebar/ServerList'
import { ChannelList } from '../sidebar/ChannelList'
import { Header } from './Header'
import { StatusBar } from './StatusBar'
import { MessageArea } from '../messages/MessageArea'
import { MemberList } from '../members/MemberList'
import { PlaybackControls } from '../playback/PlaybackControls'
import styles from './AppShell.module.css'

export function AppShell() {
	const { guilds, guildChannels, guildMembers, selectedGuildId, selectedChannelId, showMembers, selectGuild, selectChannel, toggleMembers, selectedChannel } =
		useSession()

	return (
		<div className={styles.shell}>
			{/* Server list (far left - guild icons) */}
			<div className={styles.serverList}>
				<ServerList guilds={guilds} selectedId={selectedGuildId} onSelect={selectGuild} />
			</div>

			{/* Channel list */}
			<div className={styles.channelList}>
				<ChannelList channels={guildChannels} selectedId={selectedChannelId} onSelect={selectChannel} />
			</div>

			{/* Main content area */}
			<div className={styles.main}>
				<Header channel={selectedChannel} onToggleMembers={toggleMembers} showMembers={showMembers} />

				<div className={styles.content}>
					<MessageArea channelId={selectedChannelId} />

					{showMembers && <MemberList members={guildMembers} />}
				</div>

				{/* Playback controls */}
				<PlaybackControls />

				{/* Status bar */}
				<StatusBar />
			</div>
		</div>
	)
}
