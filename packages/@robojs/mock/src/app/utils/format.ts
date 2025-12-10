/**
 * Format file size in bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Constrain dimensions proportionally to fit within max bounds
 */
export function constrainDimensions(
	width: number,
	height: number,
	maxWidth: number,
	maxHeight: number
): { width: number; height: number } {
	const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
	return {
		width: Math.round(width * ratio),
		height: Math.round(height * ratio)
	}
}
