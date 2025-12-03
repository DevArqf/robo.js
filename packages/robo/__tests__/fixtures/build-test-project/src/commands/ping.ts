/**
 * Simple ping command for testing build output
 */
export const config = {
	description: 'Replies with pong'
}

export default function ping(): string {
	return 'pong'
}
