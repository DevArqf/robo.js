import { useState } from 'react'
import type { FileComponentData } from './ComponentsV2.types'
import styles from './FileComponentV2.module.css'

interface FileComponentV2Props {
	component: FileComponentData
}

/**
 * FileComponentV2 - Renders a single file display (Components V2)
 * Supports spoiler blur with click-to-reveal
 */
export function FileComponentV2({ component }: FileComponentV2Props) {
	const { file, spoiler } = component
	const [isRevealed, setIsRevealed] = useState(!spoiler)

	// Extract filename from URL
	const filename = getFilenameFromUrl(file.url)
	const extension = filename.split('.').pop()?.toLowerCase() || ''

	const handleClick = () => {
		if (!isRevealed) {
			setIsRevealed(true)
		}
	}

	return (
		<div
			className={`${styles.file} ${!isRevealed ? styles.spoiler : ''}`}
			onClick={!isRevealed ? handleClick : undefined}
		>
			<div className={styles.fileIcon}>
				<FileIcon extension={extension} />
			</div>
			<div className={styles.fileInfo}>
				{isRevealed ? (
					<a href={file.url} className={styles.fileName} download>
						{filename}
					</a>
				) : (
					<span className={styles.fileName}>{filename}</span>
				)}
			</div>
			{isRevealed && (
				<a href={file.url} className={styles.downloadButton} download title="Download">
					<DownloadIcon />
				</a>
			)}
			{!isRevealed && <div className={styles.spoilerBadge}>SPOILER</div>}
		</div>
	)
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url: string): string {
	// Handle attachment:// URLs
	if (url.startsWith('attachment://')) {
		return url.replace('attachment://', '')
	}
	// Handle regular URLs
	try {
		const urlObj = new URL(url)
		const pathname = urlObj.pathname
		return pathname.split('/').pop() || 'file'
	} catch {
		return url.split('/').pop() || 'file'
	}
}

function FileIcon({ extension }: { extension: string }) {
	const iconMap: Record<string, string> = {
		pdf: '📄',
		doc: '📝',
		docx: '📝',
		txt: '📃',
		xls: '📊',
		xlsx: '📊',
		ppt: '📽️',
		pptx: '📽️',
		zip: '📦',
		rar: '📦',
		'7z': '📦',
		exe: '⚙️',
		js: '📜',
		ts: '📜',
		py: '🐍',
		json: '{ }',
		html: '🌐',
		css: '🎨'
	}

	return <span>{iconMap[extension] || '📁'}</span>
}

function DownloadIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
		</svg>
	)
}
