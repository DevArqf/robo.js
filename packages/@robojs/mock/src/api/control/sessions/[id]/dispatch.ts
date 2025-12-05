import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { validateMethod, notFound, badRequest } from '../../utils.js'

/**
 * POST /api/control/sessions/:id/dispatch - Dispatch an event to session connections
 *
 * Request body:
 * {
 *   event: string          // Event name (e.g., "MESSAGE_CREATE", "INTERACTION_CREATE")
 *   data: {                // Event-specific data
 *     // For MESSAGE_CREATE:
 *     channel_id: string   // Required for MESSAGE_CREATE
 *     content?: string     // Message content
 *     author?: {           // Optional author info
 *       id?: string
 *       username?: string
 *       bot?: boolean
 *     }
 *     embeds?: unknown[]
 *     attachments?: unknown[]
 *
 *     // For INTERACTION_CREATE (slash commands):
 *     command_name: string // Required for INTERACTION_CREATE
 *     options?: Record<string, string | number | boolean>
 *     user?: { id?: string, username?: string, bot?: boolean }
 *     channel_id?: string
 *     guild_id?: string
 *   }
 * }
 *
 * Response:
 * {
 *   success: true,
 *   dispatched: number,       // Number of connections event was sent to
 *   message_id?: string       // For MESSAGE_CREATE, the generated message ID
 *   interaction_id?: string   // For INTERACTION_CREATE, the generated interaction ID
 *   interaction_token?: string // For INTERACTION_CREATE, the interaction token
 * }
 */
export default async (request: RoboRequest) => {
	validateMethod(request, ['POST'])

	const { id } = request.params as { id: string }

	if (!id) {
		return notFound('Session ID required')
	}

	const session = sessionManager.get(id)

	if (!session) {
		return notFound('Session not found')
	}

	// Parse request body
	let body: {
		event: string
		data: Record<string, unknown>
	}

	try {
		body = await request.json()
	} catch {
		return badRequest('Invalid JSON body')
	}

	// Validate required fields
	if (!body.event || typeof body.event !== 'string') {
		return badRequest('Missing or invalid "event" field')
	}

	if (!body.data || typeof body.data !== 'object') {
		return badRequest('Missing or invalid "data" field')
	}

	// Handle MESSAGE_CREATE specially
	if (body.event === 'MESSAGE_CREATE') {
		const data = body.data as {
			channel_id?: string
			content?: string
			author?: {
				id?: string
				username?: string
				bot?: boolean
			}
			embeds?: unknown[]
			attachments?: unknown[]
		}

		if (!data.channel_id) {
			return badRequest('MESSAGE_CREATE requires "channel_id" in data')
		}

		try {
			const message = await session.dispatchMessage({
				channelId: data.channel_id,
				content: data.content,
				author: data.author,
				embeds: data.embeds,
				attachments: data.attachments
			})

			return {
				success: true,
				dispatched: session.connections.size,
				message_id: message.id
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle INTERACTION_CREATE specially for slash commands, button clicks, select menus, and autocomplete
	if (body.event === 'INTERACTION_CREATE') {
		const data = body.data as {
			// Slash command fields
			command_name?: string
			options?: Record<string, string | number | boolean>
			// Autocomplete fields (Phase 3F)
			focused_option?: {
				name: string
				value: string
				type?: number
			}
			// Button click fields (Phase 3C)
			custom_id?: string
			message_id?: string
			// Select menu fields (Phase 3D)
			values?: string[]
			component_type?: number
			// Context menu fields (Phase 3G)
			target_id?: string
			context_menu_type?: 2 | 3
			// Common fields
			user?: {
				id?: string
				username?: string
				bot?: boolean
			}
			channel_id?: string
			guild_id?: string
		}

		// Select menu interaction (Phase 3D) - check BEFORE button since both have custom_id
		// Select menus have values array, buttons don't
		if (data.custom_id && data.values !== undefined) {
			if (!data.message_id) {
				return badRequest('Select menu interaction requires "message_id" in data')
			}

			try {
				const interaction = await session.dispatchSelectMenu({
					customId: data.custom_id,
					messageId: data.message_id,
					values: data.values,
					componentType: data.component_type,
					user: data.user,
					channelId: data.channel_id,
					guildId: data.guild_id
				})

				return {
					success: true,
					dispatched: session.connections.size,
					interaction_id: interaction.id,
					interaction_token: interaction.token,
					custom_id: interaction.customId,
					message_id: interaction.messageId,
					values: interaction.values,
					component_type: interaction.componentType,
					channel_id: interaction.channelId,
					guild_id: interaction.guildId
				}
			} catch (error) {
				return badRequest((error as Error).message)
			}
		}

		// Button click interaction (Phase 3C)
		if (data.custom_id) {
			if (!data.message_id) {
				return badRequest('Button click requires "message_id" in data')
			}

			try {
				const interaction = await session.dispatchButtonClick({
					customId: data.custom_id,
					messageId: data.message_id,
					user: data.user,
					channelId: data.channel_id,
					guildId: data.guild_id
				})

				return {
					success: true,
					dispatched: session.connections.size,
					interaction_id: interaction.id,
					interaction_token: interaction.token,
					custom_id: interaction.customId,
					message_id: interaction.messageId,
					channel_id: interaction.channelId,
					guild_id: interaction.guildId
				}
			} catch (error) {
				return badRequest((error as Error).message)
			}
		}

		// Context menu interaction (Phase 3G)
		// Context menus have target_id + context_menu_type
		if (data.target_id && data.context_menu_type) {
			if (!data.command_name) {
				return badRequest('Context menu interaction requires "command_name" in data')
			}

			if (data.context_menu_type !== 2 && data.context_menu_type !== 3) {
				return badRequest('context_menu_type must be 2 (USER) or 3 (MESSAGE)')
			}

			try {
				const interaction = await session.dispatchContextMenu({
					commandName: data.command_name,
					targetId: data.target_id,
					contextMenuType: data.context_menu_type,
					user: data.user,
					channelId: data.channel_id,
					guildId: data.guild_id
				})

				return {
					success: true,
					dispatched: session.connections.size,
					interaction_id: interaction.id,
					interaction_token: interaction.token,
					command_name: interaction.commandName,
					target_id: interaction.targetId,
					context_menu_type: interaction.contextMenuType,
					channel_id: interaction.channelId,
					guild_id: interaction.guildId
				}
			} catch (error) {
				return badRequest((error as Error).message)
			}
		}

		// Autocomplete interaction (Phase 3F)
		// Autocomplete has command_name + focused_option (not custom_id)
		if (data.command_name && data.focused_option) {
			const focusedOption = data.focused_option

			if (!focusedOption.name || focusedOption.value === undefined) {
				return badRequest('Autocomplete requires "focused_option" with "name" and "value"')
			}

			try {
				const interaction = await session.dispatchAutocomplete({
					commandName: data.command_name,
					focusedOption,
					options: data.options,
					user: data.user,
					channelId: data.channel_id,
					guildId: data.guild_id
				})

				return {
					success: true,
					dispatched: session.connections.size,
					interaction_id: interaction.id,
					interaction_token: interaction.token,
					command_name: interaction.commandName,
					focused_option: focusedOption.name,
					channel_id: interaction.channelId,
					guild_id: interaction.guildId
				}
			} catch (error) {
				return badRequest((error as Error).message)
			}
		}

		// Slash command interaction
		if (!data.command_name) {
			return badRequest('INTERACTION_CREATE requires "command_name", "custom_id", "focused_option", or "target_id" with "context_menu_type" in data')
		}

		try {
			const interaction = await session.dispatchSlashCommand({
				commandName: data.command_name,
				options: data.options,
				user: data.user,
				channelId: data.channel_id,
				guildId: data.guild_id
			})

			return {
				success: true,
				dispatched: session.connections.size,
				interaction_id: interaction.id,
				interaction_token: interaction.token,
				command_name: interaction.commandName,
				channel_id: interaction.channelId,
				guild_id: interaction.guildId
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle THREAD_CREATE (Phase 4D)
	if (body.event === 'THREAD_CREATE') {
		const data = body.data as {
			name: string
			parent_channel_id: string
			type?: 10 | 11 | 12
			auto_archive_duration?: 60 | 1440 | 4320 | 10080
			invitable?: boolean
			user?: {
				id?: string
				username?: string
				bot?: boolean
			}
		}

		if (!data.name || !data.parent_channel_id) {
			return badRequest('THREAD_CREATE requires "name" and "parent_channel_id" in data')
		}

		try {
			const thread = await session.dispatchThreadCreate({
				name: data.name,
				parentChannelId: data.parent_channel_id,
				type: data.type,
				autoArchiveDuration: data.auto_archive_duration,
				invitable: data.invitable,
				user: data.user
			})

			return {
				success: true,
				dispatched: session.connections.size,
				thread_id: thread.id,
				parent_id: thread.parentId,
				type: thread.type,
				name: thread.name
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle THREAD_UPDATE (Phase 4D)
	if (body.event === 'THREAD_UPDATE') {
		const data = body.data as {
			thread_id: string
			name?: string
			archived?: boolean
			locked?: boolean
			auto_archive_duration?: 60 | 1440 | 4320 | 10080
			invitable?: boolean
		}

		if (!data.thread_id) {
			return badRequest('THREAD_UPDATE requires "thread_id" in data')
		}

		try {
			const thread = await session.dispatchThreadUpdate(data.thread_id, {
				name: data.name,
				archived: data.archived,
				locked: data.locked,
				autoArchiveDuration: data.auto_archive_duration,
				invitable: data.invitable
			})

			return {
				success: true,
				dispatched: session.connections.size,
				thread_id: thread.id,
				name: thread.name,
				archived: thread.threadMetadata.archived,
				locked: thread.threadMetadata.locked
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle THREAD_DELETE (Phase 4D)
	if (body.event === 'THREAD_DELETE') {
		const data = body.data as {
			thread_id: string
		}

		if (!data.thread_id) {
			return badRequest('THREAD_DELETE requires "thread_id" in data')
		}

		try {
			await session.dispatchThreadDelete(data.thread_id)

			return {
				success: true,
				dispatched: session.connections.size,
				thread_id: data.thread_id
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle THREAD_MEMBER_UPDATE (join/leave) (Phase 4D)
	if (body.event === 'THREAD_MEMBER_UPDATE') {
		const data = body.data as {
			thread_id: string
			action: 'join' | 'leave'
			user_id?: string
		}

		if (!data.thread_id || !data.action) {
			return badRequest('THREAD_MEMBER_UPDATE requires "thread_id" and "action" in data')
		}

		try {
			if (data.action === 'join') {
				if (data.user_id) {
					await session.dispatchThreadMemberAdd(data.thread_id, data.user_id)
				} else {
					await session.dispatchThreadJoin(data.thread_id)
				}
			} else {
				if (data.user_id) {
					await session.dispatchThreadMemberRemove(data.thread_id, data.user_id)
				} else {
					await session.dispatchThreadLeave(data.thread_id)
				}
			}

			return {
				success: true,
				dispatched: session.connections.size,
				thread_id: data.thread_id,
				action: data.action,
				user_id: data.user_id ?? session.state.botUser.id
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// Handle THREAD_LIST_SYNC (Phase 4D)
	if (body.event === 'THREAD_LIST_SYNC') {
		const data = body.data as {
			guild_id: string
			channel_ids?: string[]
		}

		if (!data.guild_id) {
			return badRequest('THREAD_LIST_SYNC requires "guild_id" in data')
		}

		try {
			await session.dispatchThreadListSync(data.guild_id, data.channel_ids)

			return {
				success: true,
				dispatched: session.connections.size,
				guild_id: data.guild_id
			}
		} catch (error) {
			return badRequest((error as Error).message)
		}
	}

	// For other events, dispatch raw data
	await session.dispatch(body.event, body.data)

	return {
		success: true,
		dispatched: session.connections.size
	}
}
