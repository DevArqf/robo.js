import { Button, type ButtonComponentData } from './Button'
import { SelectMenu, type SelectMenuComponentData } from './SelectMenu'
import styles from './ComponentRow.module.css'

// Discord component types
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
}

/**
 * Container for all message components (action rows)
 */
export function ComponentsContainer({
	components,
	messageId,
	channelId,
	onButtonClick,
	onSelectOption
}: ComponentsContainerProps) {
	if (!components || components.length === 0) return null

	// Type guard for action rows
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

export { ComponentType }
export type { ActionRowComponent }
