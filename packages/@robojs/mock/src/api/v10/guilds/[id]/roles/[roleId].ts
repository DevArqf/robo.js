import type { RoboRequest } from '@robojs/server'
import { sessionManager } from '../../../../../core/manager.js'
import { parseMockToken } from '../../../../../utils/id.js'
import { mockRoleToAPIRole } from '../../../../../discord/payloads.js'
import { RoleLimits } from '../../../../../types/index.js'
import { enforcePermissions } from '../../../../../utils/permission-check.js'

/**
 * GET /api/v10/guilds/:id/roles/:roleId - Get a guild role
 * PATCH /api/v10/guilds/:id/roles/:roleId - Modify a guild role
 * DELETE /api/v10/guilds/:id/roles/:roleId - Delete a guild role
 *
 * @see https://discord.com/developers/docs/resources/guild#get-guild-role
 * @see https://discord.com/developers/docs/resources/guild#modify-guild-role
 * @see https://discord.com/developers/docs/resources/guild#delete-guild-role
 */
export default async (request: RoboRequest) => {
	// 1. Parse Authorization header → get session
	const authHeader = request.headers.get('Authorization') || ''
	const sessionId = parseMockToken(authHeader)

	if (!sessionId) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	const session = sessionManager.get(sessionId)
	if (!session) {
		return new Response(JSON.stringify({ error: 'Unauthorized', code: 0 }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 2. Extract IDs from params
	const { id: guildId, roleId } = request.params as { id: string; roleId: string }

	// 3. Validate guild exists
	const guild = session.state.guilds.get(guildId)
	if (!guild) {
		return new Response(JSON.stringify({ error: 'Unknown Guild', code: 10004 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 4. Validate role exists
	const role = session.state.getGuildRole(guildId, roleId)
	if (!role) {
		return new Response(JSON.stringify({ error: 'Unknown Role', code: 10011 }), {
			status: 404,
			headers: { 'Content-Type': 'application/json' }
		})
	}

	// 4b. Check permissions for PATCH/DELETE (Phase 4L-Extended)
	if (request.method === 'PATCH' || request.method === 'DELETE') {
		const permError = enforcePermissions(
			session,
			request.method,
			`/guilds/${guildId}/roles/${roleId}`,
			undefined,
			guildId,
			{ targetRoleId: roleId }
		)
		if (permError) return permError
	}

	// Handle GET - Get role
	if (request.method === 'GET') {
		return mockRoleToAPIRole(role)
	}

	// Handle PATCH - Modify role
	if (request.method === 'PATCH') {
		let body: {
			name?: string
			permissions?: string
			color?: number
			hoist?: boolean
			icon?: string | null
			unicode_emoji?: string | null
			mentionable?: boolean
			position?: number
		}

		try {
			body = await request.json()
		} catch {
			return new Response(JSON.stringify({ error: 'Invalid request body', code: 50035 }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Check if trying to modify @everyone's protected fields
		if (role.id === guildId) {
			if (body.name !== undefined || body.hoist !== undefined) {
				return new Response(
					JSON.stringify({ error: 'Cannot modify @everyone role name or hoist', code: 50028 }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				)
			}
		}

		// Validate name length if provided
		if (body.name !== undefined) {
			if (body.name.length < RoleLimits.MIN_NAME_LENGTH) {
				return new Response(
					JSON.stringify({ error: `Role name must be at least ${RoleLimits.MIN_NAME_LENGTH} character`, code: 50035 }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				)
			}

			if (body.name.length > RoleLimits.MAX_NAME_LENGTH) {
				return new Response(
					JSON.stringify({ error: `Role name cannot exceed ${RoleLimits.MAX_NAME_LENGTH} characters`, code: 50035 }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				)
			}
		}

		// Validate color if provided
		if (body.color !== undefined) {
			if (body.color < 0 || body.color > RoleLimits.MAX_COLOR_VALUE) {
				return new Response(
					JSON.stringify({ error: 'Invalid color value', code: 50035 }),
					{
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				)
			}
		}

		// Update the role
		const updatedRole = session.state.updateGuildRole(guildId, roleId, {
			name: body.name,
			permissions: body.permissions,
			color: body.color,
			hoist: body.hoist,
			icon: body.icon,
			unicodeEmoji: body.unicode_emoji,
			mentionable: body.mentionable
		})

		if (!updatedRole) {
			return new Response(JSON.stringify({ error: 'Failed to update role', code: 50035 }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Handle position update separately if provided
		if (body.position !== undefined) {
			session.state.updateGuildRolePositions(guildId, [{ id: roleId, position: body.position }])
		}

		// Record action
		session.recordAction(
			'role_updated',
			{
				role_id: roleId,
				guild_id: guildId,
				updates: body
			},
			{
				endpoint: `PATCH /guilds/${guildId}/roles/${roleId}`,
				method: 'PATCH'
			}
		)

		// Dispatch GUILD_ROLE_UPDATE event
		await session.dispatchGuildRoleUpdate(guildId, updatedRole)

		return mockRoleToAPIRole(updatedRole)
	}

	// Handle DELETE - Delete role
	if (request.method === 'DELETE') {
		// Cannot delete @everyone role
		if (roleId === guildId) {
			return new Response(
				JSON.stringify({ error: 'Cannot delete @everyone role', code: 50028 }),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			)
		}

		const deleted = session.state.deleteGuildRole(guildId, roleId)
		if (!deleted) {
			return new Response(JSON.stringify({ error: 'Failed to delete role', code: 50035 }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Record action
		session.recordAction(
			'role_deleted',
			{
				role_id: roleId,
				guild_id: guildId
			},
			{
				endpoint: `DELETE /guilds/${guildId}/roles/${roleId}`,
				method: 'DELETE'
			}
		)

		// Dispatch GUILD_ROLE_DELETE event
		await session.dispatchGuildRoleDelete(guildId, roleId)

		// Discord returns 204 No Content on successful delete
		return new Response(null, { status: 204 })
	}

	// Method not allowed
	return new Response(JSON.stringify({ error: 'Method not allowed' }), {
		status: 405,
		headers: { 'Content-Type': 'application/json' }
	})
}
