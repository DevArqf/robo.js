import type { MockMessage, Snowflake } from '../types/index.js'
import type { MockServerState } from '../session/state.js'
import { MentionParser } from './mention-parser.js'

/**
 * Result of resolving notifications for a message
 */
export interface NotificationResult {
	/** Set of user IDs that should be notified */
	notifiedUsers: Set<Snowflake>
	/** Whether the current Stage UI user is mentioned */
	mentionsCurrentUser: boolean
	/** Channel IDs mentioned in the message (for link highlighting) */
	mentionedChannels: Snowflake[]
	/** Role IDs mentioned in the message */
	mentionedRoles: Snowflake[]
	/** Whether @everyone was used */
	mentionsEveryone: boolean
	/** Whether @here was used */
	mentionsHere: boolean
}

/**
 * Utility class for resolving who should be notified by a message
 */
export class NotificationResolver {
	/**
	 * Resolve who should be notified by a message
	 *
	 * @param message - The message being sent
	 * @param state - Session state for member/role lookups
	 * @param currentUserId - The current Stage UI user ID (for mention highlighting)
	 * @returns Notification result with user IDs to notify and metadata
	 */
	static resolve(
		message: MockMessage,
		state: MockServerState,
		currentUserId?: Snowflake
	): NotificationResult {
		const notifiedUsers = new Set<Snowflake>()
		let mentionsCurrentUser = false

		// Parse mentions from content
		const parsed = MentionParser.parse(message.content)

		// Add directly mentioned users
		for (const userId of parsed.users) {
			// Verify user exists in state
			if (state.users.has(userId)) {
				notifiedUsers.add(userId)
				if (userId === currentUserId) {
					mentionsCurrentUser = true
				}
			}
		}

		// Expand role mentions to members
		if (message.guildId && parsed.roles.length > 0) {
			for (const roleId of parsed.roles) {
				// Verify role exists
				const role = state.roles.get(roleId)
				if (!role) continue

				// Get all members with this role
				const guildMembers = state.getGuildMembers(message.guildId)
				for (const member of guildMembers) {
					if (member.roles.includes(roleId)) {
						notifiedUsers.add(member.userId)
						if (member.userId === currentUserId) {
							mentionsCurrentUser = true
						}
					}
				}
			}
		}

		// Handle @everyone and @here
		if ((parsed.everyone || parsed.here) && message.guildId) {
			const guildMembers = state.getGuildMembers(message.guildId)

			for (const member of guildMembers) {
				if (parsed.here) {
					// @here only notifies online members
					const user = state.users.get(member.userId)
					const status = user?.status ?? 'online'
					if (status === 'online' || status === 'idle' || status === 'dnd') {
						notifiedUsers.add(member.userId)
					}
				} else {
					// @everyone notifies all guild members
					notifiedUsers.add(member.userId)
				}

				if (member.userId === currentUserId) {
					mentionsCurrentUser = true
				}
			}
		}

		// Don't notify the message author
		notifiedUsers.delete(message.authorId)

		return {
			notifiedUsers,
			mentionsCurrentUser,
			mentionedChannels: parsed.channels,
			mentionedRoles: parsed.roles,
			mentionsEveryone: parsed.everyone,
			mentionsHere: parsed.here
		}
	}

	/**
	 * Quick check if a message mentions a specific user
	 *
	 * @param message - The message to check
	 * @param userId - The user ID to check for
	 * @param state - Session state for role expansion
	 * @returns True if the user is mentioned directly or via role/@everyone/@here
	 */
	static mentionsUser(message: MockMessage, userId: Snowflake, state: MockServerState): boolean {
		const parsed = MentionParser.parse(message.content)

		// Check direct mention
		if (parsed.users.includes(userId)) {
			return true
		}

		// Check @everyone/@here
		if (parsed.everyone || parsed.here) {
			// If user is a member of the guild, they're mentioned
			if (message.guildId) {
				const member = state.getGuildMember(message.guildId, userId)
				if (member) {
					// For @here, check if user is online
					if (parsed.here) {
						const user = state.users.get(userId)
						const status = user?.status ?? 'online'
						return status === 'online' || status === 'idle' || status === 'dnd'
					}
					return true
				}
			}
		}

		// Check role mentions
		if (message.guildId && parsed.roles.length > 0) {
			const member = state.getGuildMember(message.guildId, userId)
			if (member) {
				for (const roleId of parsed.roles) {
					if (member.roles.includes(roleId)) {
						return true
					}
				}
			}
		}

		return false
	}

	/**
	 * Get the count of users that would be notified by a message
	 *
	 * @param message - The message to check
	 * @param state - Session state for lookups
	 * @returns Number of users that would be notified
	 */
	static getNotificationCount(message: MockMessage, state: MockServerState): number {
		const result = this.resolve(message, state)
		return result.notifiedUsers.size
	}
}
