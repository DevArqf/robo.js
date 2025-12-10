import { Button, type ButtonComponentData } from './Button'
import { SelectMenu, type SelectMenuComponentData } from './SelectMenu'
import { TextDisplay } from './TextDisplay'
import { Section } from './Section'
import { MediaGallery } from './MediaGallery'
import { FileComponentV2 } from './FileComponentV2'
import { Separator } from './Separator'
import { Container } from './Container'
import {
	ComponentTypeV2,
	type TextDisplayComponent,
	type SectionComponent,
	type MediaGalleryComponent,
	type FileComponentData,
	type SeparatorComponent,
	type ContainerComponent
} from './ComponentsV2.types'
import styles from './ComponentRow.module.css'

// Discord component types (V1)
const ComponentType = {
	ActionRow: 1,
	Button: 2,
	StringSelect: 3,
	TextInput: 4,
	UserSelect: 5,
	RoleSelect: 6,
	MentionableSelect: 7,
	ChannelSelect: 8
} as const

interface ActionRowComponent {
	type: 1
	components: Array<ButtonComponentData | SelectMenuComponentData>
}

interface ComponentRowProps {
	row: ActionRowComponent
	messageId: string
	channelId: string
	onButtonClick: (customId: string) => Promise<void>
	onSelectOption: (customId: string, values: string[]) => Promise<void>
}

export function ComponentRow({ row, onButtonClick, onSelectOption }: ComponentRowProps) {
	return (
		<div className={styles.row}>
			{row.components.map((component, index) => {
				const key = (component as ButtonComponentData).custom_id ||
					(component as SelectMenuComponentData).custom_id ||
					index

				switch (component.type) {
					case ComponentType.Button:
						return (
							<Button
								key={key}
								button={component as ButtonComponentData}
								onClick={() => {
									const btn = component as ButtonComponentData
									// Don't send interaction for link buttons
									if (btn.style === 5) return Promise.resolve()
									return onButtonClick(btn.custom_id || '')
								}}
							/>
						)

					case ComponentType.StringSelect:
					case ComponentType.UserSelect:
					case ComponentType.RoleSelect:
					case ComponentType.MentionableSelect:
					case ComponentType.ChannelSelect:
						return (
							<SelectMenu
								key={key}
								select={component as SelectMenuComponentData}
								onSelect={(values) => onSelectOption((component as SelectMenuComponentData).custom_id, values)}
							/>
						)

					default:
						// Unknown component type, skip
						return null
				}
			})}
		</div>
	)
}

interface ComponentsContainerProps {
	components: unknown[]
	messageId: string
	channelId: string
	onButtonClick: (customId: string) => Promise<void>
	onSelectOption: (customId: string, values: string[]) => Promise<void>
	isV2?: boolean
}

/**
 * Container for all message components (V1 action rows and V2 display components)
 */
export function ComponentsContainer({
	components,
	messageId,
	channelId,
	onButtonClick,
	onSelectOption,
	isV2 = false
}: ComponentsContainerProps) {
	if (!components || components.length === 0) return null

	// V2 mode: render all component types
	if (isV2) {
		return (
			<div className={styles.container}>
				{components.map((component, index) => (
					<V2ComponentRenderer
						key={index}
						component={component}
						messageId={messageId}
						channelId={channelId}
						onButtonClick={onButtonClick}
						onSelectOption={onSelectOption}
					/>
				))}
			</div>
		)
	}

	// V1 mode: only render ActionRows
	const actionRows = components.filter((c): c is ActionRowComponent => {
		return typeof c === 'object' && c !== null && (c as ActionRowComponent).type === ComponentType.ActionRow
	})

	if (actionRows.length === 0) return null

	return (
		<div className={styles.container}>
			{actionRows.map((row, index) => (
				<ComponentRow
					key={index}
					row={row}
					messageId={messageId}
					channelId={channelId}
					onButtonClick={onButtonClick}
					onSelectOption={onSelectOption}
				/>
			))}
		</div>
	)
}

interface V2ComponentRendererProps {
	component: unknown
	messageId: string
	channelId: string
	onButtonClick: (customId: string) => Promise<void>
	onSelectOption: (customId: string, values: string[]) => Promise<void>
}

/**
 * Renders a single V2 component based on its type
 */
function V2ComponentRenderer({ component, messageId, channelId, onButtonClick, onSelectOption }: V2ComponentRendererProps) {
	if (typeof component !== 'object' || component === null) return null

	const type = (component as { type?: number }).type

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

		case ComponentTypeV2.Container:
			return (
				<Container
					component={component as ContainerComponent}
					messageId={messageId}
					channelId={channelId}
					onButtonClick={onButtonClick}
					onSelectOption={onSelectOption}
				/>
			)

		default:
			// Unknown component type, skip
			return null
	}
}

export { ComponentType }
export type { ActionRowComponent }
