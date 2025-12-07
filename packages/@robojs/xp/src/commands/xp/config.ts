import { MessageFlags } from 'discord.js'
import { createCommandConfig } from '@robojs/discordjs'
import { getConfig } from '../../config.js'
import { xpLogger } from '../../core/logger.js'
import {
	hasAdminPermission,
	getRequiredPermissionBit,
	requireGuild,
	createErrorEmbed,
	createPermissionError
} from '../../core/utils.js'
import { COMPONENT_FLAGS, buildMainMenuView } from '../../core/config-ui.js'
import type { CommandResult } from '@robojs/discordjs'
import type { ChatInputCommandInteraction } from 'discord.js'

export const config = createCommandConfig({
	description: 'Configure XP system settings',
	defaultMemberPermissions: getRequiredPermissionBit(),
	dmPermission: false
} as const)

export default async function (interaction: ChatInputCommandInteraction): Promise<CommandResult> {
	try {
		const guildCheck = requireGuild(interaction)
		if (typeof guildCheck === 'string') {
			return {
				embeds: [createErrorEmbed('Server Only', guildCheck)],
				flags: MessageFlags.Ephemeral
			}
		}

		if (!hasAdminPermission(interaction)) {
			return createPermissionError()
		}

		const guildConfig = await getConfig(guildCheck.guildId)
		const view = buildMainMenuView(guildConfig, interaction.user.id)

		return {
			components: view.components,
			flags: COMPONENT_FLAGS | MessageFlags.Ephemeral
		}
	} catch (error) {
		xpLogger.error('Error in /xp config command:', error)
		return {
			embeds: [
				createErrorEmbed(
					'Error',
					error instanceof Error ? error.message : 'An unexpected error occurred while loading XP config'
				)
			],
			flags: MessageFlags.Ephemeral
		}
	}
}
