import type { Snowflake } from '../types/index.js'

/**
 * Discord mention syntax patterns
 */
const PATTERNS = {
	USER: /<@!?(\d{17,20})>/g, // <@123> or <@!123> (nickname)
	ROLE: /<@&(\d{17,20})>/g, // <@&456>
	CHANNEL: /<#(\d{17,20})>/g, // <#789>
	EVERYONE: /@everyone/g,
	HERE: /@here/g
}

/**
 * Structured representation of mentions found in message content
 */
export interface ParsedMentions {
	/** User IDs mentioned via <@id> or <@!id> syntax */
	users: Snowflake[]
	/** Role IDs mentioned via <@&id> syntax */
	roles: Snowflake[]
	/** Channel IDs mentioned via <#id> syntax */
	channels: Snowflake[]
	/** Whether @everyone was used */
	everyone: boolean
	/** Whether @here was used */
	here: boolean
}

/**
 * Utility class for parsing and formatting Discord mention syntax
 */
export class MentionParser {
	/**
	 * Parse mention syntax from message content
	 * Returns structured mention data with deduplicated IDs
	 *
	 * @param content - The message content to parse
	 * @returns Parsed mentions with user IDs, role IDs, channel IDs, and @everyone/@here flags
	 */
	static parse(content: string): ParsedMentions {
		if (!content) {
			return {
				users: [],
				roles: [],
				channels: [],
				everyone: false,
				here: false
			}
		}

		const users: Snowflake[] = []
		const roles: Snowflake[] = []
		const channels: Snowflake[] = []

		// Extract user mentions (<@123> or <@!123>)
		let match: RegExpExecArray | null
		const userPattern = new RegExp(PATTERNS.USER.source, 'g')
		while ((match = userPattern.exec(content)) !== null) {
			const userId = match[1]
			if (!users.includes(userId)) {
				users.push(userId)
			}
		}

		// Extract role mentions (<@&456>)
		const rolePattern = new RegExp(PATTERNS.ROLE.source, 'g')
		while ((match = rolePattern.exec(content)) !== null) {
			const roleId = match[1]
			if (!roles.includes(roleId)) {
				roles.push(roleId)
			}
		}

		// Extract channel mentions (<#789>)
		const channelPattern = new RegExp(PATTERNS.CHANNEL.source, 'g')
		while ((match = channelPattern.exec(content)) !== null) {
			const channelId = match[1]
			if (!channels.includes(channelId)) {
				channels.push(channelId)
			}
		}

		// Check for @everyone and @here
		const everyone = PATTERNS.EVERYONE.test(content)
		const here = PATTERNS.HERE.test(content)

		return { users, roles, channels, everyone, here }
	}

	/**
	 * Format a user ID as a mention string
	 *
	 * @param userId - The user ID to format
	 * @returns The formatted mention string (e.g., "<@123456789>")
	 */
	static formatUserMention(userId: Snowflake): string {
		return `<@${userId}>`
	}

	/**
	 * Format a user ID as a nickname mention string
	 *
	 * @param userId - The user ID to format
	 * @returns The formatted nickname mention string (e.g., "<@!123456789>")
	 */
	static formatNicknameMention(userId: Snowflake): string {
		return `<@!${userId}>`
	}

	/**
	 * Format a role ID as a mention string
	 *
	 * @param roleId - The role ID to format
	 * @returns The formatted mention string (e.g., "<@&123456789>")
	 */
	static formatRoleMention(roleId: Snowflake): string {
		return `<@&${roleId}>`
	}

	/**
	 * Format a channel ID as a mention string
	 *
	 * @param channelId - The channel ID to format
	 * @returns The formatted mention string (e.g., "<#123456789>")
	 */
	static formatChannelMention(channelId: Snowflake): string {
		return `<#${channelId}>`
	}

	/**
	 * Check if content contains any mentions
	 *
	 * @param content - The message content to check
	 * @returns True if content contains any mention syntax
	 */
	static hasMentions(content: string): boolean {
		if (!content) return false
		return (
			PATTERNS.USER.test(content) ||
			PATTERNS.ROLE.test(content) ||
			PATTERNS.CHANNEL.test(content) ||
			PATTERNS.EVERYONE.test(content) ||
			PATTERNS.HERE.test(content)
		)
	}

	/**
	 * Strip all mention syntax from content, leaving just the raw text
	 *
	 * @param content - The message content to strip
	 * @returns Content with mention syntax removed
	 */
	static stripMentions(content: string): string {
		if (!content) return ''
		return content
			.replace(/<@!?\d{17,20}>/g, '')
			.replace(/<@&\d{17,20}>/g, '')
			.replace(/<#\d{17,20}>/g, '')
			.replace(/@everyone/g, '')
			.replace(/@here/g, '')
			.replace(/\s+/g, ' ')
			.trim()
	}
}
