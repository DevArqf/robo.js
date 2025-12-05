import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../core/manager.js'
import { mockMessageToAPIMessage } from '../../../../discord/payloads.js'
import { generateSnowflake } from '../../../../utils/snowflake.js'
import { isMultipartRequest, parseMultipartMessage, MultipartError } from '../../../../utils/multipart.js'
import { getImageDimensions, isImageContentType } from '../../../../utils/image.js'
import type { MockAttachment, AttachmentPayload, StoredAttachment } from '../../../../types/index.js'
import { MessageFlags, createComponentValidationError, createV2ConflictError } from '../../../../types/index.js'
import { validateComponentsV2 } from '../../../../session/state.js'

// Default port for CDN URLs (can be overridden via environment)
const CDN_BASE_URL = process.env.MOCK_CDN_URL || 'http://localhost:53596'

/**
 * POST /api/v10/webhooks/:app_id/:token - Send followup message for interaction
 *
 * This endpoint allows bots to send followup messages after the initial interaction response.
 * Discord.js uses this when calling interaction.followUp()
 *
 * Supports both:
 * - JSON body: { content, embeds, components, tts, flags }
 * - Multipart: payload_json + files[0], files[1], etc.
 *
 * Response: APIMessage object
 */
export default async (request: RoboRequest) => {
	// 1. Validate POST method
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract app_id and token from URL params
	const { app_id: appId, token } = request.params as { app_id: string; token: string }

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

	// 7. Validate interaction has been responded to (deferred or replied)
	if (!interaction.response) {
		return new Response(
			JSON.stringify({
				error: 'Interaction has not been acknowledged',
				code: 40060
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}

	// 8. Parse message payload (JSON or multipart)
	let body: {
		content?: string
		embeds?: unknown[]
		components?: unknown[]
		tts?: boolean
		flags?: number
		attachments?: AttachmentPayload[] // Metadata for uploaded files
	}

	const attachments: MockAttachment[] = []
	const messageId = generateSnowflake() // Pre-generate for attachment URLs
	const channelId = interaction.channelId

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
					filename: meta.filename || file.filename,
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
					title: meta.title,
					description: meta.description,
					content_type: file.contentType,
					size: file.size,
					url: `${CDN_BASE_URL}/cdn/attachments/${channelId}/${attachmentId}/${encodeURIComponent(storedAttachment.filename)}`,
					proxy_url: `${CDN_BASE_URL}/cdn/attachments/${channelId}/${attachmentId}/${encodeURIComponent(storedAttachment.filename)}`,
					width,
					height
				}
				attachments.push(attachment)
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
		return new Response(JSON.stringify({ error: 'Invalid request body' }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 8b. Validate Components V2 if flag is set (Phase 4F)
	if (body.flags && body.flags & MessageFlags.IsComponentsV2) {
		// V2 components cannot coexist with content or embeds
		if (body.content || (body.embeds && body.embeds.length > 0)) {
			return new Response(JSON.stringify(createV2ConflictError()), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Validate V2 component structure
		const attachmentFilenames = new Set(attachments.map((a) => a.filename))
		const validation = validateComponentsV2(body.components ?? [], attachmentFilenames)
		if (!validation.valid) {
			return new Response(JSON.stringify(createComponentValidationError(validation.errors)), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}
	}

	// 9. Create followup message in state
	const message = session.state.createMessage({
		id: messageId, // Use pre-generated ID for attachment consistency
		channelId: interaction.channelId,
		guildId: interaction.guildId,
		authorId: session.state.botUser.id,
		content: body.content ?? '',
		embeds: body.embeds ?? [],
		attachments, // Phase 4E: Include uploaded attachments
		tts: body.tts ?? false,
		// Phase 4F: Components V2 support
		flags: body.flags,
		components: body.components
	})

	// 10. Track followup message ID on interaction
	if (!interaction.followupMessageIds) {
		interaction.followupMessageIds = []
	}
	interaction.followupMessageIds.push(message.id)

	// 11. Record as 'interaction_followup' action
	session.recorder.record(
		'interaction_followup',
		{
			interaction_id: interaction.id,
			message_id: message.id,
			channel_id: interaction.channelId,
			guild_id: interaction.guildId,
			content: message.content,
			embeds: message.embeds,
			attachments: attachments.length > 0 ? attachments : undefined,
			components: message.components,
			flags: message.flags,
			command_name: interaction.commandName
		},
		{
			endpoint: `POST /webhooks/${appId}/${token}`,
			method: 'POST',
			interactionId: interaction.id
		}
	)

	// 12. Return APIMessage response
	return mockMessageToAPIMessage(message, session.state.botUser)
}
