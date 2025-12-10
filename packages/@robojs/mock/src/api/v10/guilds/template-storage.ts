/**
 * Shared template storage across all template endpoints
 *
 * This ensures templates created via one endpoint are accessible from others.
 */

export interface GuildTemplate {
	code: string
	name: string
	description: string | null
	usage_count: number
	creator_id: string
	creator: {
		id: string
		username: string
		discriminator: string
		avatar: string | null
	}
	created_at: string
	updated_at: string
	source_guild_id: string
	serialized_source_guild: {
		name: string
		description: string | null
		region: string | null
		icon_hash: string | null
		verification_level: number
		default_message_notifications: number
		explicit_content_filter: number
		roles: Array<{
			id: string
			name: string
			color: number
			hoist: boolean
			mentionable: boolean
			permissions: string
		}>
		channels: Array<{
			id: string
			type: number
			name: string
			position: number
			topic: string | null
			bitrate?: number
			user_limit?: number
			rate_limit_per_user?: number
			parent_id: string | null
			permission_overwrites: Array<{
				id: string
				type: number
				allow: string
				deny: string
			}>
		}>
		afk_channel_id: string | null
		afk_timeout: number
		system_channel_id: string | null
		system_channel_flags: number
	}
	is_dirty: boolean | null
}

// Global in-memory storage for templates (per session)
const templateStorage = new Map<string, Map<string, GuildTemplate>>()

export function getTemplatesForSession(sessionId: string): Map<string, GuildTemplate> {
	if (!templateStorage.has(sessionId)) {
		templateStorage.set(sessionId, new Map())
	}
	return templateStorage.get(sessionId)!
}

export function generateTemplateCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
	let code = ''
	for (let i = 0; i < 8; i++) {
		code += chars.charAt(Math.floor(Math.random() * chars.length))
	}
	return code
}
