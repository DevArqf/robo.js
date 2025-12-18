import { createCommandConfig } from '@robojs/discordjs'
import type { ChatInputCommandInteraction } from 'discord.js'

/**
 * Command for testing dynamic import HMR.
 * Uses a literal dynamic import to load the lazy utility module.
 */
export const config = createCommandConfig({
	description: 'Tests lazy loading with dynamic imports'
} as const)

export default async (interaction: ChatInputCommandInteraction) => {
	// Dynamic import with literal specifier - HMR should track this dependency
	const { getLazyMessage } = await import('../utils/lazy.js')
	interaction.reply(getLazyMessage())
}
