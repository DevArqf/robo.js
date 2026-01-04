/**
 * Debug utilities for development mode
 * Provides error forwarding and debug button handling
 */
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Colors,
	EmbedBuilder,
	codeBlock
} from 'discord.js'
import { getPluginOptions, Mode } from 'robo.js'
import { devLogger } from './helpers.js'
import type { ButtonInteraction, Client, CommandInteraction, Message, TextChannel } from 'discord.js'
import type { DevPluginConfig } from '../types.js'

// Debug mode is enabled when running via `robo dev`
export const DEBUG_MODE = Mode.isDev()

// Debug error response button ID prefix
const DEBUG_ID_PREFIX = '__robo_debug_'

/**
 * Gets the Discord client from the discordjs plugin
 */
function getClient(): Client | null {
	try {
		// Try to import from @robojs/discordjs
		const discordjs = require('@robojs/discordjs')
		if (discordjs?.getClient && discordjs?.hasClient?.()) {
			return discordjs.getClient()
		}
	} catch {
		// Plugin not available
	}
	return null
}

/**
 * Sends a debug error to a configured channel
 */
export async function sendDebugError(error: unknown): Promise<boolean> {
	if (!DEBUG_MODE) {
		return false
	}

	const options = getPluginOptions('@robojs/dev') as DevPluginConfig | null
	const debugChannelId = options?.debugChannelId ?? process.env.DISCORD_DEBUG_CHANNEL_ID

	if (!debugChannelId) {
		return false
	}

	const client = getClient()
	if (!client?.isReady()) {
		return false
	}

	try {
		const channel = await client.channels.fetch(debugChannelId)
		if (!channel || channel.type !== ChannelType.GuildText) {
			return false
		}

		const errorMessage = error instanceof Error ? error.stack || error.message : String(error)
		const embed = new EmbedBuilder()
			.setTitle('Unhandled Error')
			.setDescription(codeBlock(errorMessage.slice(0, 4000)))
			.setColor(Colors.Red)
			.setTimestamp()

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId(DEBUG_ID_PREFIX + 'dismiss')
				.setLabel('Dismiss')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(DEBUG_ID_PREFIX + 'restart')
				.setLabel('Restart')
				.setStyle(ButtonStyle.Danger)
		)

		// Check if we should ping a role
		const pingRoleId = options?.errorPingRoleId
		const content = pingRoleId ? `<@&${pingRoleId}>` : undefined

		await (channel as TextChannel).send({ content, embeds: [embed], components: [row] })
		return true
	} catch (e) {
		devLogger.debug('Failed to send debug error:', e)
		return false
	}
}

/**
 * Handles debug button interactions
 */
export async function handleDebugButton(interaction: ButtonInteraction): Promise<boolean> {
	// Only handle button interactions with the debug prefix
	if (!interaction.isButton?.() || !interaction.customId?.startsWith(DEBUG_ID_PREFIX)) {
		return false
	}

	const action = interaction.customId.replace(DEBUG_ID_PREFIX, '')

	if (action === 'dismiss') {
		await interaction.message.delete()
		return true
	}

	if (action === 'restart') {
		await interaction.reply({ content: 'Restarting...', ephemeral: true })
		if (process.send) {
			process.send({ type: 'restart' })
		} else {
			process.exit(0)
		}
		return true
	}

	return false
}

/**
 * Prints an error response to a command or message
 */
export async function printErrorResponse(
	error: unknown,
	interaction: CommandInteraction | Message | ButtonInteraction
): Promise<void> {
	const errorMessage = error instanceof Error ? error.message : String(error)
	const embed = new EmbedBuilder()
		.setTitle('Error')
		.setDescription(codeBlock(errorMessage.slice(0, 4000)))
		.setColor(Colors.Red)

	try {
		// Handle Message (has channel property but no deferred/replied)
		if ('channel' in interaction && !('deferred' in interaction)) {
			await (interaction as Message).reply({ embeds: [embed] })
			return
		}

		// Handle CommandInteraction or ButtonInteraction
		const commandInteraction = interaction as CommandInteraction | ButtonInteraction
		if (commandInteraction.deferred) {
			await commandInteraction.editReply({ embeds: [embed] })
		} else if (commandInteraction.replied) {
			await commandInteraction.followUp({ embeds: [embed], ephemeral: true })
		} else {
			await commandInteraction.reply({ embeds: [embed], ephemeral: true })
		}
	} catch (e) {
		devLogger.debug('Failed to reply with error:', e)
	}
}
