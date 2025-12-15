import { color } from 'robo.js'
import { mockLogger } from './logger.js'
import type { Session } from '../session/session.js'
import type { SessionState } from '../types/index.js'

/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "1h 23m 45s" or "45s" or "123ms"
 */
function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`
	}

	const seconds = Math.floor(ms / 1000)
	const minutes = Math.floor(seconds / 60)
	const hours = Math.floor(minutes / 60)

	const parts: string[] = []

	if (hours > 0) {
		parts.push(`${hours}h`)
	}
	if (minutes % 60 > 0 || hours > 0) {
		parts.push(`${minutes % 60}m`)
	}
	if (seconds % 60 > 0 || parts.length === 0) {
		parts.push(`${seconds % 60}s`)
	}

	return parts.join(' ')
}

/**
 * Counts the total number of guild members across all guilds.
 */
function countMembers(state: SessionState): number {
	return state.guildMembers.size
}

/**
 * Counts the number of slash commands that were invoked during the session.
 * This is based on interactions that were slash commands.
 */
function countSlashCommands(state: SessionState): number {
	let count = 0
	for (const interaction of state.interactions.values()) {
		// Type 2 = APPLICATION_COMMAND
		if (interaction.type === 2) {
			count++
		}
	}
	return count
}

/**
 * Counts button clicks (component interactions).
 */
function countButtonClicks(state: SessionState): number {
	let count = 0
	for (const interaction of state.interactions.values()) {
		// Type 3 = MESSAGE_COMPONENT
		if (interaction.type === 3) {
			count++
		}
	}
	return count
}

/**
 * Summary statistics for a mock session.
 */
export interface SessionSummary {
	sessionId: string
	sessionName: string | undefined
	duration: number
	durationFormatted: string
	messages: number
	slashCommands: number
	buttonClicks: number
	totalInteractions: number
	members: number
	guilds: number
	channels: number
}

/**
 * Generates a summary of session statistics.
 */
export function generateSessionSummary(session: Session): SessionSummary {
	const state = session.state
	const duration = Date.now() - session.createdAt

	return {
		sessionId: session.id,
		sessionName: session.name,
		duration,
		durationFormatted: formatDuration(duration),
		messages: state.messages.size,
		slashCommands: countSlashCommands(state),
		buttonClicks: countButtonClicks(state),
		totalInteractions: state.interactions.size,
		members: countMembers(state),
		guilds: state.guilds.size,
		channels: state.channels.size
	}
}

/**
 * Prints a formatted summary of the mock session to the console.
 * Called when the mock server shuts down.
 */
export function printSessionSummary(session: Session): void {
	const summary = generateSessionSummary(session)

	mockLogger.log('')
	mockLogger.log(color.bold('  Mock Session Summary'))
	mockLogger.log(color.dim('  ' + '─'.repeat(38)))
	mockLogger.log(`   Session:      ${summary.sessionName ?? summary.sessionId}`)
	mockLogger.log(`   Duration:     ${summary.durationFormatted}`)
	mockLogger.log('')
	mockLogger.log(`   Messages:     ${summary.messages}`)
	mockLogger.log(`   Commands:     ${summary.slashCommands}`)
	mockLogger.log(`   Buttons:      ${summary.buttonClicks}`)
	mockLogger.log(`   Interactions: ${summary.totalInteractions}`)
	mockLogger.log('')
	mockLogger.log(`   Guilds:       ${summary.guilds}`)
	mockLogger.log(`   Channels:     ${summary.channels}`)
	mockLogger.log(`   Members:      ${summary.members}`)
	mockLogger.log(color.dim('  ' + '─'.repeat(38)))
	mockLogger.log('')
}

/**
 * Generates a compact one-line summary for logging.
 */
export function getCompactSummary(session: Session): string {
	const summary = generateSessionSummary(session)
	return `${summary.durationFormatted} | ${summary.messages} msgs | ${summary.slashCommands} cmds | ${summary.totalInteractions} interactions`
}
