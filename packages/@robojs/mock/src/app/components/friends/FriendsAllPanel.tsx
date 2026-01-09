import type { FriendRowData } from './friends.data'
import { FriendsList } from './FriendsList'

// UI-only: All is a copy of Online (no logic / no differences yet).
export function FriendsAllPanel({ onOpenFriend }: { onOpenFriend?: (friend: FriendRowData) => void }) {
	return <FriendsList onOpenFriend={onOpenFriend} />
}


