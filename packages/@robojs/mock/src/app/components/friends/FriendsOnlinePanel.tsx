import type { FriendRowData } from './friends.data'
import { FriendsList } from './FriendsList'

export function FriendsOnlinePanel({ onOpenFriend }: { onOpenFriend?: (friend: FriendRowData) => void }) {
	return <FriendsList onOpenFriend={onOpenFriend} />
}


