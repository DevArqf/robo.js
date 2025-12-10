import { useState } from 'react'
import type { ThumbnailComponent } from './ComponentsV2.types'
import styles from './Thumbnail.module.css'

interface ThumbnailProps {
	component: ThumbnailComponent
}

/**
 * Thumbnail - Renders an image accessory for Section (Components V2)
 * Supports spoiler blur with click-to-reveal
 */
export function Thumbnail({ component }: ThumbnailProps) {
	const { media, description, spoiler } = component
	const [isRevealed, setIsRevealed] = useState(!spoiler)

	const handleClick = () => {
		if (!isRevealed) {
			setIsRevealed(true)
		}
	}

	return (
		<div
			className={`${styles.thumbnail} ${!isRevealed ? styles.spoiler : ''}`}
			onClick={handleClick}
			title={description}
		>
			<img src={media.url} alt={description || ''} className={styles.image} />
			{!isRevealed && <div className={styles.spoilerOverlay}>SPOILER</div>}
		</div>
	)
}
