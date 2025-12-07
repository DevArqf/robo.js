import { SyncContextProvider } from '@robojs/sync'
import { DiscordContextProvider, useDiscordSdk } from '../hooks/useDiscordSdk'
import { Activity } from './Activity'
import './App.css'

/**
 * Set `authenticate` to true to enable Discord authentication.
 * You can also set the `scope` prop to request additional permissions.
 *
 * ```
 * <DiscordContextProvider authenticate scope={['identify', 'guilds']}>
 *  <Activity />
 * </DiscordContextProvider>
 * ```
 */
export default function App() {
	return (
		<DiscordContextProvider authenticate={false}>
			<SyncWrapper>
				<Activity />
			</SyncWrapper>
		</DiscordContextProvider>
	)
}

interface UserData {
	odId: string
	username: string
	odAvatar: string | null
}

function SyncWrapper({ children }: { children: React.ReactNode }) {
	const { session } = useDiscordSdk()

	// Provide user data to other clients via sync
	const clientData: UserData | undefined = session?.user
		? {
				odId: session.user.id,
				username: session.user.username,
				odAvatar: session.user.avatar ?? null
			}
		: undefined

	return (
		<SyncContextProvider
			clientData={clientData}
			loadingScreen={
				<div className="loading">
					<div className="spinner" />
					<p>Connecting...</p>
				</div>
			}
		>
			{children}
		</SyncContextProvider>
	)
}
