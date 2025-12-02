/**
 * Discord Invite Command
 *
 * Generates a Discord invite link for adding the bot to servers.
 * Reads permissions from the Discord metadata in the manifest.
 */

import type { CliCommandConfig, CliContext } from 'robo.js'
import { color, composeColors, Env, env, Manifest, Mode } from 'robo.js'
import type { AggregatedMetadata } from 'robo.js'

// Permission flag bits for Discord (same as discord.js PermissionFlagsBits)
const PermissionFlagsBits: Record<string, bigint> = {
	AddReactions: BigInt(1) << BigInt(6),
	Administrator: BigInt(1) << BigInt(3),
	AttachFiles: BigInt(1) << BigInt(15),
	BanMembers: BigInt(1) << BigInt(2),
	ChangeNickname: BigInt(1) << BigInt(26),
	Connect: BigInt(1) << BigInt(20),
	CreateInstantInvite: BigInt(1) << BigInt(0),
	CreatePrivateThreads: BigInt(1) << BigInt(36),
	CreatePublicThreads: BigInt(1) << BigInt(35),
	DeafenMembers: BigInt(1) << BigInt(23),
	EmbedLinks: BigInt(1) << BigInt(14),
	KickMembers: BigInt(1) << BigInt(1),
	ManageChannels: BigInt(1) << BigInt(4),
	ManageEmojisAndStickers: BigInt(1) << BigInt(30),
	ManageEvents: BigInt(1) << BigInt(33),
	ManageGuild: BigInt(1) << BigInt(5),
	ManageMessages: BigInt(1) << BigInt(13),
	ManageNicknames: BigInt(1) << BigInt(27),
	ManageRoles: BigInt(1) << BigInt(28),
	ManageThreads: BigInt(1) << BigInt(34),
	ManageWebhooks: BigInt(1) << BigInt(29),
	MentionEveryone: BigInt(1) << BigInt(17),
	ModerateMembers: BigInt(1) << BigInt(40),
	MoveMembers: BigInt(1) << BigInt(24),
	MuteMembers: BigInt(1) << BigInt(22),
	PrioritySpeaker: BigInt(1) << BigInt(8),
	ReadMessageHistory: BigInt(1) << BigInt(16),
	RequestToSpeak: BigInt(1) << BigInt(32),
	SendMessages: BigInt(1) << BigInt(11),
	SendMessagesInThreads: BigInt(1) << BigInt(38),
	SendTTSMessages: BigInt(1) << BigInt(12),
	SendVoiceMessages: BigInt(1) << BigInt(46),
	Speak: BigInt(1) << BigInt(21),
	Stream: BigInt(1) << BigInt(9),
	UseApplicationCommands: BigInt(1) << BigInt(31),
	UseEmbeddedActivities: BigInt(1) << BigInt(39),
	UseExternalEmojis: BigInt(1) << BigInt(18),
	UseExternalSounds: BigInt(1) << BigInt(45),
	UseExternalStickers: BigInt(1) << BigInt(37),
	UseSoundboard: BigInt(1) << BigInt(42),
	UseVAD: BigInt(1) << BigInt(25),
	ViewAuditLog: BigInt(1) << BigInt(7),
	ViewChannel: BigInt(1) << BigInt(10),
	ViewCreatorMonetizationAnalytics: BigInt(1) << BigInt(41),
	ViewGuildInsights: BigInt(1) << BigInt(19)
}

// Default scopes for Discord bots
const DEFAULT_SCOPES = ['bot', 'applications.commands']

// Discord metadata interface
interface DiscordMetadata extends AggregatedMetadata {
	namespace: 'discordjs'
	permissions?: {
		bot: string[]
		bySource?: Record<string, string[]>
		byHandler?: Record<string, string[]>
	}
	scopes?: {
		required: string[]
		optional?: string[]
		bySource?: Record<string, string[]>
	}
}

export const config: CliCommandConfig = {
	description: 'Generates a Discord invite link for servers to add your Robo.',
	options: [
		{ alias: '-h', name: '--help', description: 'Shows the available command options' }
	]
}

export default async function inviteCommand({ logger }: CliContext) {
	logger.info(`Generating Robo invite ...`)
	logger.warn(
		`This is experimental and may not generate the correct permissions. If you have issues, use the ${color.bold(
			'Discord Developer Portal'
		)} to generate an invite URL manually.`
	)

	// Set NODE_ENV if not already set
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = 'development'
	}

	// Make sure environment variables are loaded
	const defaultMode = Mode.get()
	await Env.load({ mode: defaultMode })

	// Throw error if no client ID is set
	const clientId = env.get('discord.clientId')
	if (!clientId) {
		logger.error(`No client ID set. Please set the ${color.bold('DISCORD_CLIENT_ID')} environment variable.`)
		return
	}

	// Get Discord metadata from the granular manifest
	const discordMetadata = Manifest.metadata<DiscordMetadata>('discordjs')

	// Get permissions from metadata
	const permissions = getPermissionsFromMetadata(discordMetadata, logger)

	// Get scopes from metadata
	const scopes = discordMetadata?.scopes?.required ?? DEFAULT_SCOPES

	// Generate the invite link
	const scope = scopes.join('%20')
	const inviteLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=${scope}&permissions=${permissions}`

	// Pretty log output
	const boxWidth = inviteLink.length + 4
	const horizontalLine = '═'.repeat(boxWidth)
	const robotLines = ['      ____   ', '     [____]    ', '     ]()()[    ', '   ___\\__/___  ']

	const inviteLabel = "Beep boop, here's your invite link!"
	const maxLineLength = Math.max(inviteLabel.length, boxWidth + 2)
	const padding = ' '.repeat(maxLineLength - robotLines[0].length - 2)

	robotLines.forEach((line) => {
		logger.log(composeColors(color.bold, color.blue)(padding + line))
	})

	logger.log(
		color.green(inviteLabel) +
			padding.slice(0, -inviteLabel.length) +
			composeColors(color.bold, color.blue)('  |__|    |__|  ')
	)
	logger.log(color.green(`╒${horizontalLine}╕`))
	logger.log(color.green(`│${' '.repeat(boxWidth)}│`))
	logger.log(
		color.green(`│  `) + composeColors(color.bold, color.underline, color.blue)(inviteLink) + color.green(`  │`)
	)
	logger.log(color.green(`│${' '.repeat(boxWidth)}│`))
	logger.log(color.green(`╘${horizontalLine}╛\n`))

	// Additional message
	logger.log(`Share your Robo's invite link with server owners. Remember to keep it running.`)
	logger.log(
		`Get free hosting from ${color.bold('RoboPlay')} at ${composeColors(
			color.bold,
			color.underline,
			color.blue
		)('https://roboplay.dev')}\n`
	)
}

function getPermissionsFromMetadata(
	metadata: DiscordMetadata | undefined,
	logger: CliContext['logger']
): bigint {
	if (!metadata?.permissions?.bot) {
		logger.warn('No permissions found in Discord metadata...')
		return BigInt(0)
	}

	// Add required permissions based on the metadata
	let permissions = BigInt(0)
	for (const flag of metadata.permissions.bot) {
		const permBit = PermissionFlagsBits[flag]
		if (permBit) {
			permissions |= permBit
		}
	}

	return permissions
}
