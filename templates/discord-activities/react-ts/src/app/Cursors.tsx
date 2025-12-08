import { SyncCursors } from '@robojs/sync'

interface UserData {
	odId: string
	username: string
	odAvatar: string | null
}

interface CursorsProps {
	roomKey: (string | null)[]
}

export function Cursors({ roomKey }: CursorsProps) {
	return (
		<SyncCursors<UserData>
			roomKey={roomKey}
			throttle={16}
			showLabels={true}
			labelKey={(client) => client.data?.username ?? client.id.slice(0, 8)}
		/>
	)
}
