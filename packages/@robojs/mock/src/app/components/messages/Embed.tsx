import { Markdown } from '../common/Markdown'
import { formatTimestamp } from '../../utils/time'
import styles from './Embed.module.css'

/**
 * Minimal embed type - matches Discord API structure
 */
interface EmbedData {
	color?: number
	author?: {
		name?: string
		url?: string
		icon_url?: string
	}
	title?: string
	url?: string
	description?: string
	fields?: Array<{
		name: string
		value: string
		inline?: boolean
	}>
	image?: {
		url: string
		width?: number
		height?: number
	}
	thumbnail?: {
		url: string
	}
	video?: {
		url: string
		width?: number
		height?: number
	}
	footer?: {
		text: string
		icon_url?: string
	}
	timestamp?: string
}

interface EmbedProps {
	embed: EmbedData
}

export function Embed({ embed }: EmbedProps) {
	const { color, author, title, url, description, fields, image, thumbnail, video, footer, timestamp } = embed

	const accentColor = color ? `#${color.toString(16).padStart(6, '0')}` : undefined

	return (
		<div className={styles.embed} style={{ borderLeftColor: accentColor }}>
			<div className={styles.grid}>
				{/* Content column */}
				<div className={styles.content}>
					{/* Author */}
					{author && (
						<div className={styles.author}>
							{author.icon_url && <img src={author.icon_url} alt="" className={styles.authorIcon} />}
							{author.url ? (
								<a href={author.url} className={styles.authorName} target="_blank" rel="noopener noreferrer">
									{author.name}
								</a>
							) : (
								<span className={styles.authorName}>{author.name}</span>
							)}
						</div>
					)}

					{/* Title */}
					{title &&
						(url ? (
							<a href={url} className={styles.title} target="_blank" rel="noopener noreferrer">
								{title}
							</a>
						) : (
							<div className={styles.title}>{title}</div>
						))}

					{/* Description */}
					{description && (
						<div className={styles.description}>
							<Markdown text={description} />
						</div>
					)}

					{/* Fields */}
					{fields && fields.length > 0 && (
						<div className={styles.fields}>
							{fields.map((field, i) => (
								<div key={i} className={`${styles.field} ${field.inline ? styles.inline : ''}`}>
									<div className={styles.fieldName}>{field.name}</div>
									<div className={styles.fieldValue}>
										<Markdown text={field.value} />
									</div>
								</div>
							))}
						</div>
					)}

					{/* Image */}
					{image && (
						<div className={styles.image}>
							<img src={image.url} alt="" />
						</div>
					)}

					{/* Video */}
					{video && (
						<div className={styles.video}>
							<video src={video.url} controls style={{ maxWidth: video.width || 400 }} />
						</div>
					)}
				</div>

				{/* Thumbnail column */}
				{thumbnail && (
					<div className={styles.thumbnail}>
						<img src={thumbnail.url} alt="" />
					</div>
				)}
			</div>

			{/* Footer */}
			{(footer || timestamp) && (
				<div className={styles.footer}>
					{footer?.icon_url && <img src={footer.icon_url} alt="" className={styles.footerIcon} />}
					<span className={styles.footerText}>
						{footer?.text}
						{footer?.text && timestamp && ' • '}
						{timestamp && formatTimestamp(timestamp)}
					</span>
				</div>
			)}
		</div>
	)
}
