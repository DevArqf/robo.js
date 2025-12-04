/**
 * /dev restart - Restart the Robo
 */
import type { ChatInputCommandInteraction } from 'discord.js'

interface CommandConfig {
	description: string
	sage?: {
		defer?: boolean
		ephemeral?: boolean
	}
}

export const config: CommandConfig = {
	description: 'Restart the Robo',
	sage: {
		defer: true,
		ephemeral: true
	}
}

export default async function (interaction: ChatInputCommandInteraction) {
	await interaction.editReply('Restarting...')

	// Use process messaging if available (for dev mode)
	if (process.send) {
		process.send({ type: 'restart' })
	} else {
		// Otherwise just exit and let the process manager restart us
		process.exit(0)
	}
}
