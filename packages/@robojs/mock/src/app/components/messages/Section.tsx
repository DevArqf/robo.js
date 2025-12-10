import { TextDisplay } from './TextDisplay'
import { Thumbnail } from './Thumbnail'
import { Button, type ButtonComponentData } from './Button'
import { ComponentTypeV2, type SectionComponent, type ThumbnailComponent } from './ComponentsV2.types'
import styles from './Section.module.css'

interface SectionProps {
	component: SectionComponent
	onButtonClick?: (customId: string) => Promise<void>
}

/**
 * Section - Renders text with an optional accessory (Components V2)
 * Contains 1-3 TextDisplay components and optional Thumbnail or Button accessory
 */
export function Section({ component, onButtonClick }: SectionProps) {
	const { components, accessory } = component

	return (
		<div className={styles.section}>
			{/* Text content column */}
			<div className={styles.content}>
				{components.map((textComponent, index) => (
					<TextDisplay key={index} component={textComponent} />
				))}
			</div>

			{/* Accessory column (Thumbnail or Button) */}
			{accessory && (
				<div className={styles.accessory}>
					{accessory.type === ComponentTypeV2.Thumbnail ? (
						<Thumbnail component={accessory as ThumbnailComponent} />
					) : accessory.type === ComponentTypeV2.Button ? (
						<Button
							button={accessory as ButtonComponentData}
							onClick={() => {
								const btn = accessory as ButtonComponentData
								// Don't send interaction for link buttons
								if (btn.style === 5) return Promise.resolve()
								return onButtonClick?.(btn.custom_id || '') ?? Promise.resolve()
							}}
						/>
					) : null}
				</div>
			)}
		</div>
	)
}
