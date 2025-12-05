import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../../core/manager.js'
import { mockMessageToAPIMessage } from '../../../../../../discord/payloads.js'
import { getGatewayServer } from '../../../../../../core/gateway.js'
import { generateSnowflake } from '../../../../../../utils/snowflake.js'
import { isMultipartRequest, parseMultipartMessage, MultipartError } from '../../../../../../utils/multipart.js'
import { getImageDimensions, isImageContentType } from '../../../../../../utils/image.js'
import type {
	MockInteraction,
	MockMessage,
	MockAttachment,
	AttachmentPayload,
	StoredAttachment
} from '../../../../../../types/index.js'
import { MessageFlags, createComponentValidationError, createV2ConflictError } from '../../../../../../types/index.js'
import { validateComponentsV2 } from '../../../../../../session/state.js'
import type { Session } from '../../../../../../session/session.js'

// Default port for CDN URLs (can be overridden via environment)
const CDN_BASE_URL = process.env.MOCK_CDN_URL || 'http://localhost:53596'

/**
 * GET/PATCH/DELETE /api/v10/webhooks/:app_id/:token/messages/:messageId
 *
 * GET - Get a followup message
 * PATCH - Edit a followup message
 * DELETE - Delete a followup message
 *
 * Request body (PATCH - JSON or multipart):
 * {
 *   content?: string,      // New message content
 *   embeds?: object[],     // New embed objects
 *   components?: object[], // New message components
 *   attachments?: object[] // Attachment metadata (IDs to keep, new file metadata)
 * }
 *
 * Response (GET/PATCH): APIMessage object
 * Response (DELETE): 204 No Content
 */
export default async (request: RoboRequest) => {
	// 1. Validate method
	if (request.method !== 'GET' && request.method !== 'PATCH' && request.method !== 'DELETE') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract params from URL
	const { app_id: appId, token, messageId } = request.params as { app_id: string; token: string; messageId: string }

	// 3. Find session containing this interaction (lookup by token)
	const session = sessionManager.findSessionByInteractionToken(token)
	if (!session) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 4. Get the interaction from state
	const interaction = session.state.getInteractionByToken(token)
	if (!interaction) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 5. Validate app_id matches interaction's applicationId
	if (interaction.applicationId !== appId) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 6. Check expiration (interactions expire after 15 minutes)
	if (Date.now() > interaction.expiresAt) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Webhook',
				code: 10015
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 7. Validate messageId is a followup message for this interaction
	const isFollowup = interaction.followupMessageIds?.includes(messageId) ?? false
	if (!isFollowup) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Message',
				code: 10008
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Get the message
	const message = session.state.getMessage(messageId)
	if (!message) {
		return new Response(
			JSON.stringify({
				error: 'Unknown Message',
				code: 10008
			}),
			{
				status: 404,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 9. Handle based on method
	if (request.method === 'GET') {
		return handleGet(session, message)
	} else if (request.method === 'PATCH') {
		return handlePatch(request, session, interaction, message, appId, token, messageId)
	} else {
		return handleDelete(session, interaction, message, appId, token, messageId)
	}
}

function handleGet(session: Session, message: MockMessage) {
	const author = session.state.getUser(message.authorId) || session.state.botUser
	return mockMessageToAPIMessage(message, author)
}

async function handlePatch(
	request: RoboRequest,
	session: Session,
	interaction: MockInteraction,
	message: MockMessage,
	appId: string,
	token: string,
	messageId: string
) {
	const channelId = message.channelId

	// Parse body (JSON or multipart)
	let body: {
		content?: string
		embeds?: unknown[]
		components?: unknown[]
		flags?: number
		attachments?: (AttachmentPayload | { id: string })[]
	}

	const newAttachments: MockAttachment[] = []

	try {
		if (isMultipartRequest(request)) {
			// Handle multipart/form-data (file uploads)
			const parsed = await parseMultipartMessage(request)
			body = parsed.body as typeof body

			// Process each uploaded file
			for (let i = 0; i < parsed.files.length; i++) {
				const file = parsed.files[i]
				const attachmentId = generateSnowflake()

				// Find metadata from payload_json.attachments (if provided)
				const meta = body.attachments?.find((a) => a.id === i) || {}

				// Detect image dimensions if applicable
				let width: number | undefined
				let height: number | undefined
				if (isImageContentType(file.contentType)) {
					const dims = getImageDimensions(file.data, file.contentType)
					if (dims) {
						width = dims.width
						height = dims.height
					}
				}

				// Store attachment data in session state
				const storedAttachment: StoredAttachment = {
					id: attachmentId,
					channelId,
					messageId,
					filename: ('filename' in meta && meta.filename) || file.filename,
					contentType: file.contentType,
					size: file.size,
					data: file.data,
					width,
					height
				}
				session.state.storeAttachment(storedAttachment)

				// Build attachment metadata for message
				const attachment: MockAttachment = {
					id: attachmentId,
					filename: storedAttachment.filename,
					title: 'title' in meta ? meta.title : undefined,
					description: 'description' in meta ? meta.description : undefined,
					content_type: file.contentType,
					size: file.size,
					url: `${CDN_BASE_URL}/cdn/attachments/${channelId}/${attachmentId}/${encodeURIComponent(storedAttachment.filename)}`,
					proxy_url: `${CDN_BASE_URL}/cdn/attachments/${channelId}/${attachmentId}/${encodeURIComponent(storedAttachment.filename)}`,
					width,
					height
				}
				newAttachments.push(attachment)
			}
		} else {
			// Standard JSON body
			body = await request.json()
		}
	} catch (error) {
		if (error instanceof MultipartError) {
			return new Response(JSON.stringify({ error: error.message, code: error.code }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Validate Components V2 if flag is set (Phase 4F)
	if (body.flags && body.flags & MessageFlags.IsComponentsV2) {
		// V2 components cannot coexist with content or embeds
		if (body.content || (body.embeds && body.embeds.length > 0)) {
			return new Response(JSON.stringify(createV2ConflictError()), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Validate V2 component structure
		const attachmentFilenames = new Set(newAttachments.map((a) => a.filename))
		const validation = validateComponentsV2(body.components ?? [], attachmentFilenames)
		if (!validation.valid) {
			return new Response(JSON.stringify(createComponentValidationError(validation.errors)), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}
	}

	// Determine final attachments array
	let finalAttachments: MockAttachment[]

	if (body.attachments !== undefined) {
		// If attachments array is provided, only keep listed existing attachments + add new ones
		finalAttachments = []

		// Process attachment references in body
		for (const attachmentRef of body.attachments) {
			// Check if this is an existing attachment reference (string ID)
			if (typeof attachmentRef.id === 'string') {
				const existing = message.attachments.find((a) => a.id === attachmentRef.id)
				if (existing) {
					finalAttachments.push(existing)
				}
			}
		}

		// Add newly uploaded files
		finalAttachments.push(...newAttachments)

		// Clean up removed attachments from storage
		for (const oldAttachment of message.attachments) {
			if (!finalAttachments.find((a) => a.id === oldAttachment.id)) {
				session.state.deleteAttachment(oldAttachment.id)
			}
		}
	} else {
		// No attachments field means keep existing + add new
		finalAttachments = [...message.attachments, ...newAttachments]
	}

	// Update message in state
	const updatedMessage = session.state.updateMessage(message.id, {
		content: body.content ?? message.content,
		embeds: body.embeds ?? message.embeds,
		attachments: finalAttachments,
		// Phase 4F: Components V2 support
		flags: body.flags ?? message.flags,
		components: body.components ?? message.components
	})

	if (!updatedMessage) {
		return new Response(JSON.stringify({ error: 'Failed to update message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Get channel for guild ID
	const channel = session.state.getChannel(message.channelId)

	// Record action
	session.recorder.record(
		'interaction_edit',
		{
			interaction_id: interaction.id,
			message_id: messageId,
			channel_id: message.channelId,
			guild_id: message.guildId,
			content: updatedMessage.content,
			embeds: updatedMessage.embeds,
			attachments: updatedMessage.attachments,
			edited_timestamp: updatedMessage.editedTimestamp,
			is_original: false,
			command_name: interaction.commandName
		},
		{
			endpoint: `PATCH /webhooks/${appId}/${token}/messages/${messageId}`,
			method: 'PATCH',
			interactionId: interaction.id
		}
	)

	// Dispatch MESSAGE_UPDATE event via Gateway
	const author = session.state.getUser(message.authorId) || session.state.botUser
	const apiMessage = mockMessageToAPIMessage(updatedMessage, author)

	// Build dispatch data with guild-specific fields
	const dispatchData: Record<string, unknown> = { ...apiMessage }
	if (updatedMessage.guildId) {
		dispatchData.guild_id = updatedMessage.guildId
	}

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_UPDATE', dispatchData, channel?.guildId)

	// Return updated message
	return mockMessageToAPIMessage(updatedMessage, author)
}

function handleDelete(
	session: Session,
	interaction: MockInteraction,
	message: MockMessage,
	appId: string,
	token: string,
	messageId: string
) {
	// Get channel before deleting for dispatch
	const channel = session.state.getChannel(message.channelId)

	// Delete message from state (this also cleans up attachments)
	const deleted = session.state.deleteMessage(message.id)
	if (!deleted) {
		return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// Remove from followupMessageIds on interaction
	if (interaction.followupMessageIds) {
		const index = interaction.followupMessageIds.indexOf(messageId)
		if (index !== -1) {
			interaction.followupMessageIds.splice(index, 1)
		}
	}

	// Record action
	session.recorder.record(
		'interaction_edit',
		{
			interaction_id: interaction.id,
			message_id: messageId,
			channel_id: message.channelId,
			guild_id: message.guildId,
			deleted: true,
			is_original: false,
			command_name: interaction.commandName
		},
		{
			endpoint: `DELETE /webhooks/${appId}/${token}/messages/${messageId}`,
			method: 'DELETE',
			interactionId: interaction.id
		}
	)

	// Dispatch MESSAGE_DELETE event via Gateway
	const dispatchData: { id: string; channel_id: string; guild_id?: string } = {
		id: messageId,
		channel_id: message.channelId
	}

	if (message.guildId) {
		dispatchData.guild_id = message.guildId
	}

	getGatewayServer().dispatchToSession(session.id, 'MESSAGE_DELETE', dispatchData, channel?.guildId)

	// Return 204 No Content (Discord API behavior)
	return new Response(null, { status: 204 })
}
