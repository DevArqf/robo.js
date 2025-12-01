/**
 * Debug utilities for Discord bots
 * These provide dev commands and error handling for development mode
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
import { color, Flashcore, logger } from 'robo.js'
import { env } from 'robo.js/dist/core/env.js'
import { getClient, hasClient } from './client.js'
import type { ButtonInteraction, CommandInteraction, Message, TextChannel } from 'discord.js'
import type { CommandConfig } from '../types/commands.js'

// Debug mode is enabled when not in production
export const DEBUG_MODE = env.get('nodeEnv') !== 'production'

// Debug error response button ID
const FLASHCORE_KEY = '__robo_debug_error'
const DEBUG_ID_PREFIX = '__robo_debug_'

export const devLogCommandConfig: CommandConfig = {
	description: 'View recent Robo logs',
	sage: {
		defer: true,
		ephemeral: true
	}
}

export async function devLogCommand(interaction: CommandInteraction) {
	const logs = await Flashcore.get<string[]>('__robo_logs')

	if (!logs || logs.length === 0) {
		return 'No logs available.'
	}

	const embed = new EmbedBuilder()
		.setTitle('Recent Logs')
		.setDescription(codeBlock(logs.join('\n').slice(-4000)))
		.setColor(Colors.Blurple)
		.setTimestamp()

	return { embeds: [embed] }
}

export const devRestartCommandConfig: CommandConfig = {
	description: 'Restart the Robo',
	sage: {
		defer: true,
		ephemeral: true
	}
}

export async function devRestartCommand(interaction: CommandInteraction) {
	await interaction.editReply('Restarting...')

	// Use process messaging if available (for dev mode)
	if (process.send) {
		process.send({ type: 'restart' })
	} else {
		// Otherwise just exit and let the process manager restart us
		process.exit(0)
	}
}

export const devStatusCommandConfig: CommandConfig = {
	description: 'View the status of this Robo',
	sage: {
		defer: true,
		ephemeral: true
	}
}

export async function devStatusCommand(interaction: CommandInteraction) {
	const uptime = process.uptime()
	const hours = Math.floor(uptime / 3600)
	const minutes = Math.floor((uptime % 3600) / 60)
	const seconds = Math.floor(uptime % 60)

	const memoryUsage = process.memoryUsage()
	const heapUsed = (memoryUsage.heapUsed / 1024 / 1024).toFixed(2)
	const heapTotal = (memoryUsage.heapTotal / 1024 / 1024).toFixed(2)

	const embed = new EmbedBuilder()
		.setTitle('Robo Status')
		.setColor(Colors.Green)
		.addFields(
			{ name: 'Uptime', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
			{ name: 'Memory', value: `${heapUsed}MB / ${heapTotal}MB`, inline: true },
			{ name: 'Node.js', value: process.version, inline: true }
		)
		.setTimestamp()

	return { embeds: [embed] }
}

/**
 * Sends a debug error to a configured channel or DMs the bot owner
 */
export async function sendDebugError(error: unknown): Promise<boolean> {
	if (!DEBUG_MODE) {
		return false
	}

	const debugChannelId = env.get('discord.debugChannelId')
	if (!debugChannelId || !hasClient()) {
		return false
	}

	const client = getClient()
	if (!client.isReady()) {
		return false
	}

	try {
		const channel = await client.channels.fetch(debugChannelId)
		if (!channel || channel.type !== ChannelType.GuildText) {
			return false
		}

		const errorMessage = error instanceof Error ? error.stack || error.message : String(error)
		const embed = new EmbedBuilder()
			.setTitle('❌ Unhandled Error')
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

		await (channel as TextChannel).send({ embeds: [embed], components: [row] })
		return true
	} catch (e) {
		logger.debug('Failed to send debug error:', e)
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
		.setTitle('❌ Error')
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
		logger.debug('Failed to reply with error:', e)
	}
}
