import type { SeparatorComponent } from './ComponentsV2.types'
import styles from './Separator.module.css'

interface SeparatorProps {
	component: SeparatorComponent
}

/**
 * Separator - Renders a horizontal divider (Components V2)
 */
export function Separator({ component }: SeparatorProps) {
	const { divider = true, spacing = 'small' } = component

	const classNames = [
		styles.separator,
		divider ? styles.withDivider : styles.noDivider,
		spacing === 'large' ? styles.spacingLarge : styles.spacingSmall
	].join(' ')

	return <div className={classNames} />
}
