import { useState } from 'react'
import type { MediaGalleryComponent, MediaGalleryItem } from './ComponentsV2.types'
import styles from './MediaGallery.module.css'

interface MediaGalleryProps {
	component: MediaGalleryComponent
}

/**
 * MediaGallery - Renders a grid of 1-10 images (Components V2)
 * Supports per-item spoiler and lightbox expansion
 */
export function MediaGallery({ component }: MediaGalleryProps) {
	const { items } = component
	const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

	// Determine grid layout class based on item count
	const gridClass =
		items.length === 1 ? styles.single : items.length === 2 ? styles.double : styles.grid

	return (
		<>
			<div className={`${styles.gallery} ${gridClass}`}>
				{items.map((item, index) => (
					<GalleryItem key={index} item={item} onExpand={() => setExpandedIndex(index)} />
				))}
			</div>

			{/* Lightbox for expanded view */}
			{expandedIndex !== null && (
				<div className={styles.lightbox} onClick={() => setExpandedIndex(null)}>
					<img
						src={items[expandedIndex].media.url}
						alt={items[expandedIndex].description || ''}
						className={styles.lightboxImage}
					/>
					{items[expandedIndex].description && (
						<div className={styles.lightboxDescription}>{items[expandedIndex].description}</div>
					)}
					<a
						href={items[expandedIndex].media.url}
						className={styles.downloadLink}
						download
						onClick={(e) => e.stopPropagation()}
					>
						Open original
					</a>
				</div>
			)}
		</>
	)
}

interface GalleryItemProps {
	item: MediaGalleryItem
	onExpand: () => void
}

function GalleryItem({ item, onExpand }: GalleryItemProps) {
	const { media, description, spoiler } = item
	const [isRevealed, setIsRevealed] = useState(!spoiler)

	const handleClick = () => {
		if (!isRevealed) {
			setIsRevealed(true)
		} else {
			onExpand()
		}
	}

	return (
		<div
			className={`${styles.item} ${!isRevealed ? styles.spoiler : ''}`}
			onClick={handleClick}
			title={description}
		>
			<img src={media.url} alt={description || ''} className={styles.image} />
			{!isRevealed && <div className={styles.spoilerOverlay}>SPOILER</div>}
		</div>
	)
}
