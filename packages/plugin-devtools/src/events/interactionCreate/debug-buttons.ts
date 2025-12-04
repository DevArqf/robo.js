/**
 * Button interaction handler for debug error messages
 * Handles dismiss and restart actions
 */
import { handleDebugButton } from '../../core/debug.js'
import type { Interaction } from 'discord.js'

export default async function (interaction: Interaction) {
	if (!interaction.isButton()) {
		return
	}

	await handleDebugButton(interaction)
}
