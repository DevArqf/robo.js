import type { CommandInteraction } from 'discord.js'

export default async (interaction: CommandInteraction) => {
	const latency = Date.now() - interaction.createdTimestamp
	await interaction.reply(`Pong! Latency: ${latency}ms`)
}
