/**
 * Discord Snowflake ID generation
 *
 * Discord Snowflake format (64-bit):
 * - Bits 63-22: Timestamp (ms since Discord Epoch: 2015-01-01T00:00:00.000Z)
 * - Bits 21-17: Internal worker ID
 * - Bits 16-12: Internal process ID
 * - Bits 11-0: Increment (sequence number)
 */

// Discord epoch: January 1, 2015 00:00:00 UTC
const DISCORD_EPOCH = 1420070400000n

// Internal counters for uniqueness
let increment = 0n
const workerId = 1n
const processId = 1n

/**
 * Generate a Discord-compatible snowflake ID
 * Uses current timestamp and internal counters for uniqueness
 */
export function generateSnowflake(): string {
	const timestamp = BigInt(Date.now()) - DISCORD_EPOCH

	// Increment wraps around at 4096 (12 bits)
	increment = (increment + 1n) & 0xfffn

	// Construct snowflake:
	// timestamp << 22 | workerId << 17 | processId << 12 | increment
	const snowflake = (timestamp << 22n) | (workerId << 17n) | (processId << 12n) | increment

	return snowflake.toString()
}

/**
 * Extract timestamp from a snowflake ID
 */
export function snowflakeToTimestamp(snowflake: string): number {
	const id = BigInt(snowflake)
	const timestamp = (id >> 22n) + DISCORD_EPOCH
	return Number(timestamp)
}

/**
 * Create a snowflake from a specific timestamp
 * Useful for creating IDs that sort correctly by time
 */
export function timestampToSnowflake(timestamp: number): string {
	const discordTimestamp = BigInt(timestamp) - DISCORD_EPOCH
	increment = (increment + 1n) & 0xfffn

	const snowflake = (discordTimestamp << 22n) | (workerId << 17n) | (processId << 12n) | increment

	return snowflake.toString()
}
