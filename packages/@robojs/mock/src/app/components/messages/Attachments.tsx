import { useState } from 'react'
import { formatFileSize, constrainDimensions } from '../../utils/format'
import styles from './Attachments.module.css'

/**
 * Minimal attachment type - matches Discord API structure
 */
interface AttachmentData {
	id: string
	filename: string
	description?: string
	content_type?: string
	size: number
	url: string
	proxy_url?: string
	width?: number
	height?: number
	duration_secs?: number
	waveform?: string
	spoiler?: boolean
}

interface AttachmentsProps {
	attachments: AttachmentData[]
}

export function Attachments({ attachments }: AttachmentsProps) {
	if (!attachments?.length) return null

	return (
		<div className={styles.attachments}>
			{attachments.map((attachment) => (
				<Attachment key={attachment.id} attachment={attachment} />
			))}
		</div>
	)
}

function Attachment({ attachment }: { attachment: AttachmentData }) {
	const isImage = attachment.content_type?.startsWith('image/')
	const isVideo = attachment.content_type?.startsWith('video/')
	const isAudio = attachment.content_type?.startsWith('audio/')
	const isSpoiler = attachment.spoiler || attachment.filename.startsWith('SPOILER_')

	if (isImage) {
		return <ImageAttachment attachment={attachment} isSpoiler={isSpoiler} />
	}

	if (isVideo) {
		return <VideoAttachment attachment={attachment} isSpoiler={isSpoiler} />
	}

	if (isAudio) {
		return <AudioAttachment attachment={attachment} />
	}

	return <FileAttachment attachment={attachment} />
}

function ImageAttachment({ attachment, isSpoiler }: { attachment: AttachmentData; isSpoiler: boolean }) {
	const [isExpanded, setIsExpanded] = useState(false)
	const [isRevealed, setIsRevealed] = useState(!isSpoiler)

	// Constrain dimensions (max 400x300 for thumbnails)
	const maxWidth = 400
	const maxHeight = 300
	const { width, height } = constrainDimensions(
		attachment.width || maxWidth,
		attachment.height || maxHeight,
		maxWidth,
		maxHeight
	)

	const handleClick = () => {
		if (!isRevealed) {
			setIsRevealed(true)
		} else {
			setIsExpanded(true)
		}
	}

	return (
		<>
			<div
				className={`${styles.imageWrapper} ${!isRevealed ? styles.spoiler : ''}`}
				style={{ width, height }}
				onClick={handleClick}
			>
				<img
					src={attachment.url}
					alt={attachment.description || attachment.filename}
					className={styles.image}
				/>
				{!isRevealed && <div className={styles.spoilerOverlay}>SPOILER</div>}
			</div>

			{/* Alt text */}
			{attachment.description && isRevealed && (
				<div className={styles.altText}>{attachment.description}</div>
			)}

			{/* Lightbox for expanded view */}
			{isExpanded && (
				<div className={styles.lightbox} onClick={() => setIsExpanded(false)}>
					<img
						src={attachment.url}
						alt={attachment.description || attachment.filename}
						className={styles.lightboxImage}
					/>
					<a
						href={attachment.url}
						className={styles.downloadLink}
						download={attachment.filename}
						onClick={(e) => e.stopPropagation()}
					>
						Open original
					</a>
				</div>
			)}
		</>
	)
}

function VideoAttachment({ attachment, isSpoiler }: { attachment: AttachmentData; isSpoiler: boolean }) {
	const [isRevealed, setIsRevealed] = useState(!isSpoiler)

	return (
		<div
			className={`${styles.videoWrapper} ${!isRevealed ? styles.spoiler : ''}`}
			onClick={() => !isRevealed && setIsRevealed(true)}
		>
			<video
				src={attachment.url}
				controls={isRevealed}
				className={styles.video}
				style={{ maxWidth: 400 }}
			/>
			{!isRevealed && <div className={styles.spoilerOverlay}>SPOILER</div>}
		</div>
	)
}

function AudioAttachment({ attachment }: { attachment: AttachmentData }) {
	return (
		<div className={styles.audioWrapper}>
			<div className={styles.audioIcon}>
				<AudioIcon />
			</div>
			<div className={styles.audioInfo}>
				<span className={styles.audioName}>{attachment.filename}</span>
				<span className={styles.audioSize}>{formatFileSize(attachment.size)}</span>
			</div>
			<audio src={attachment.url} controls className={styles.audio} />
		</div>
	)
}

function FileAttachment({ attachment }: { attachment: AttachmentData }) {
	const extension = attachment.filename.split('.').pop()?.toLowerCase() || ''

	return (
		<div className={styles.file}>
			<div className={styles.fileIcon}>
				<FileIcon extension={extension} />
			</div>
			<div className={styles.fileInfo}>
				<a href={attachment.url} className={styles.fileName} download>
					{attachment.filename}
				</a>
				<span className={styles.fileSize}>{formatFileSize(attachment.size)}</span>
			</div>
			<a href={attachment.url} className={styles.downloadButton} download title="Download">
				<DownloadIcon />
			</a>
		</div>
	)
}

function FileIcon({ extension }: { extension: string }) {
	// Simple file type icons based on extension
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

function AudioIcon() {
	return (
		<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
			<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
		</svg>
	)
}

function DownloadIcon() {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
		</svg>
	)
}
