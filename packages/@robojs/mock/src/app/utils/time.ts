/**
 * Format a timestamp for Discord-like display
 * @param timestamp - ISO timestamp string
 * @param format - 'full' for first message in group, 'short' for hover timestamp
 */
export function formatTimestamp(timestamp: string, format: 'full' | 'short' = 'full'): string {
	const date = new Date(timestamp)
	const now = new Date()

	if (format === 'short') {
		return date.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		})
	}

	// Full format
	const isToday = date.toDateString() === now.toDateString()

	const yesterday = new Date(now)
	yesterday.setDate(yesterday.getDate() - 1)
	const isYesterday = date.toDateString() === yesterday.toDateString()

	const timeStr = date.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
		hour12: true
	})

	if (isToday) {
		return `Today at ${timeStr}`
	}

	if (isYesterday) {
		return `Yesterday at ${timeStr}`
	}

	// Older messages show full date
	return date.toLocaleDateString(undefined, {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	}) + ` ${timeStr}`
}
