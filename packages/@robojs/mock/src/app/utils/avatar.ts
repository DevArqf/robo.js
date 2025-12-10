/**
 * Get avatar URL for a user
 * Handles Discord CDN URLs, data URIs, and generates default avatar URL
 */
export function getAvatarUrl(userId: string, avatar: string | null, size: number = 40): string {
	if (!avatar) {
		// Discord's default avatar system uses discriminator % 5 or (user_id >> 22) % 6 for new users
		// For simplicity, we'll use user_id hash
		const defaultIndex = Math.abs(hashCode(userId)) % 5
		return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
	}

	// Already a full URL or data URI
	if (avatar.startsWith('http') || avatar.startsWith('data:')) {
		return avatar
	}

	// Discord CDN hash
	const extension = avatar.startsWith('a_') ? 'gif' : 'png'
	return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${extension}?size=${size}`
}

/**
 * Simple string hash function
 */
function hashCode(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash = hash & hash // Convert to 32-bit integer
	}
	return hash
}
