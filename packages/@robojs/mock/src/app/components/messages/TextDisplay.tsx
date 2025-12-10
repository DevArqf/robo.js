import { Markdown } from '../common/Markdown'
import type { TextDisplayComponent } from './ComponentsV2.types'
import styles from './TextDisplay.module.css'

interface TextDisplayProps {
	component: TextDisplayComponent
}

/**
 * TextDisplay - Renders a markdown text block (Components V2)
 */
export function TextDisplay({ component }: TextDisplayProps) {
	return (
		<div className={styles.textDisplay}>
			<Markdown text={component.content} />
		</div>
	)
}
