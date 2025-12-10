import { useState } from 'react'
import { TextDisplay } from './TextDisplay'
import { Section } from './Section'
import { MediaGallery } from './MediaGallery'
import { FileComponentV2 } from './FileComponentV2'
import { Separator } from './Separator'
import { ComponentRow, ComponentType, type ActionRowComponent } from './ComponentRow'
import {
	ComponentTypeV2,
	type ContainerComponent,
	type ContainerChildComponent,
	type TextDisplayComponent,
	type SectionComponent,
	type MediaGalleryComponent,
	type FileComponentData,
	type SeparatorComponent
} from './ComponentsV2.types'
import styles from './Container.module.css'

interface ContainerProps {
	component: ContainerComponent
	messageId: string
	channelId: string
	onButtonClick: (customId: string) => Promise<void>
	onSelectOption: (customId: string, values: string[]) => Promise<void>
}

/**
 * Container - Renders a styled wrapper with accent color (Components V2)
 * Can contain nested components including ActionRows, TextDisplay, Section, etc.
 * Supports spoiler blur with click-to-reveal
 */
export function Container({ component, messageId, channelId, onButtonClick, onSelectOption }: ContainerProps) {
	const { accent_color, spoiler, components } = component
	const [isRevealed, setIsRevealed] = useState(!spoiler)

	// Convert accent color to CSS hex
	const accentColor = accent_color !== undefined ? `#${accent_color.toString(16).padStart(6, '0')}` : undefined

	const handleClick = () => {
		if (!isRevealed) {
			setIsRevealed(true)
		}
	}

	return (
		<div
			className={`${styles.container} ${!isRevealed ? styles.spoiler : ''}`}
			style={{ borderLeftColor: accentColor }}
			onClick={!isRevealed ? handleClick : undefined}
		>
			{!isRevealed && <div className={styles.spoilerOverlay}>SPOILER</div>}

			<div className={styles.content}>
				{components.map((child, index) => (
					<ContainerChild
						key={index}
						component={child}
						messageId={messageId}
						channelId={channelId}
						onButtonClick={onButtonClick}
						onSelectOption={onSelectOption}
					/>
				))}
			</div>
		</div>
	)
}

interface ContainerChildProps {
	component: ContainerChildComponent
	messageId: string
	channelId: string
	onButtonClick: (customId: string) => Promise<void>
	onSelectOption: (customId: string, values: string[]) => Promise<void>
}

/**
 * Renders a single child component inside a Container
 */
function ContainerChild({ component, messageId, channelId, onButtonClick, onSelectOption }: ContainerChildProps) {
	const type = (component as { type: number }).type

	switch (type) {
		case ComponentType.ActionRow:
			return (
				<ComponentRow
					row={component as ActionRowComponent}
					messageId={messageId}
					channelId={channelId}
					onButtonClick={onButtonClick}
					onSelectOption={onSelectOption}
				/>
			)

		case ComponentTypeV2.TextDisplay:
			return <TextDisplay component={component as TextDisplayComponent} />

		case ComponentTypeV2.Section:
			return <Section component={component as SectionComponent} onButtonClick={onButtonClick} />

		case ComponentTypeV2.MediaGallery:
			return <MediaGallery component={component as MediaGalleryComponent} />

		case ComponentTypeV2.File:
			return <FileComponentV2 component={component as FileComponentData} />

		case ComponentTypeV2.Separator:
			return <Separator component={component as SeparatorComponent} />

		default:
			// Unknown component type, skip
			return null
	}
}
