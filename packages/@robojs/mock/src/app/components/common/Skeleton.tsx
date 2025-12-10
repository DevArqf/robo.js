import styles from './Skeleton.module.css'

interface SkeletonTextProps {
	width?: string | number
	height?: string | number
	className?: string
}

/**
 * Animated text placeholder
 */
export function SkeletonText({ width = '100%', height = 16, className = '' }: SkeletonTextProps) {
	return (
		<div
			className={`${styles.skeleton} ${styles.text} ${className}`}
			style={{
				width: typeof width === 'number' ? `${width}px` : width,
				height: typeof height === 'number' ? `${height}px` : height
			}}
		/>
	)
}

interface SkeletonAvatarProps {
	size?: number
	className?: string
}

/**
 * Animated circular avatar placeholder
 */
export function SkeletonAvatar({ size = 40, className = '' }: SkeletonAvatarProps) {
	return (
		<div
			className={`${styles.skeleton} ${styles.avatar} ${className}`}
			style={{
				width: size,
				height: size
			}}
		/>
	)
}

interface SkeletonMessageProps {
	className?: string
	showAvatar?: boolean
}

/**
 * Full message skeleton with avatar and text lines
 */
export function SkeletonMessage({ className = '', showAvatar = true }: SkeletonMessageProps) {
	return (
		<div className={`${styles.message} ${className}`}>
			{showAvatar && <SkeletonAvatar size={40} />}
			<div className={styles.messageContent}>
				<div className={styles.messageHeader}>
					<SkeletonText width={120} height={14} />
					<SkeletonText width={60} height={12} />
				</div>
				<SkeletonText width="85%" height={16} />
				<SkeletonText width="60%" height={16} />
			</div>
		</div>
	)
}

interface SkeletonChannelProps {
	className?: string
}

/**
 * Channel list item skeleton
 */
export function SkeletonChannel({ className = '' }: SkeletonChannelProps) {
	return (
		<div className={`${styles.channel} ${className}`}>
			<SkeletonText width={16} height={16} />
			<SkeletonText width="70%" height={14} />
		</div>
	)
}

interface SkeletonMessagesProps {
	count?: number
	className?: string
}

/**
 * Multiple message skeletons for loading state
 */
export function SkeletonMessages({ count = 5, className = '' }: SkeletonMessagesProps) {
	return (
		<div className={`${styles.messages} ${className}`}>
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonMessage key={i} showAvatar={i % 3 === 0} />
			))}
		</div>
	)
}

interface SkeletonChannelsProps {
	count?: number
	className?: string
}

/**
 * Multiple channel skeletons for loading state
 */
export function SkeletonChannels({ count = 8, className = '' }: SkeletonChannelsProps) {
	return (
		<div className={`${styles.channels} ${className}`}>
			{/* Category header skeleton */}
			<SkeletonText width="50%" height={12} className={styles.categoryHeader} />
			{Array.from({ length: count }).map((_, i) => (
				<SkeletonChannel key={i} />
			))}
		</div>
	)
}
