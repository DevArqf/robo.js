import { useEffect, useRef, useState, useCallback } from 'react'
import type { StageApplicationCommandOption, StageMember, StageChannel } from '../../types/stage'
import styles from './CommandOptionInput.module.css'

// Discord application command option types
const OptionType = {
	SubCommand: 1,
	SubCommandGroup: 2,
	String: 3,
	Integer: 4,
	Boolean: 5,
	User: 6,
	Channel: 7,
	Role: 8,
	Mentionable: 9,
	Number: 10,
	Attachment: 11
} as const

interface CommandOptionInputProps {
	option: StageApplicationCommandOption
	value: unknown
	onChange: (value: unknown) => void
	isFocused?: boolean
	members?: StageMember[]
	channels?: StageChannel[]
}

export function CommandOptionInput({ option, value, onChange, isFocused, members = [], channels = [] }: CommandOptionInputProps) {
	const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)
	const [showDropdown, setShowDropdown] = useState(false)

	// Auto-focus when isFocused changes
	useEffect(() => {
		if (isFocused && inputRef.current) {
			inputRef.current.focus()
		}
	}, [isFocused])

	// Render based on option type
	const renderInput = () => {
		// If option has predefined choices, render a select
		if (option.choices && option.choices.length > 0) {
			return (
				<select
					ref={inputRef as React.RefObject<HTMLSelectElement>}
					className={styles.select}
					value={value as string ?? ''}
					onChange={(e) => {
						const choice = option.choices?.find(c => String(c.value) === e.target.value)
						onChange(choice?.value ?? e.target.value)
					}}
				>
					<option value="">Select an option...</option>
					{option.choices.map((choice) => (
						<option key={String(choice.value)} value={String(choice.value)}>
							{choice.name}
						</option>
					))}
				</select>
			)
		}

		switch (option.type) {
			case OptionType.String:
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="text"
						className={styles.input}
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
						placeholder={option.description}
						minLength={option.min_length}
						maxLength={option.max_length}
					/>
				)

			case OptionType.Integer:
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="number"
						className={styles.input}
						value={value as number ?? ''}
						onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : undefined)}
						placeholder={option.description}
						min={option.min_value}
						max={option.max_value}
						step="1"
					/>
				)

			case OptionType.Number:
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="number"
						className={styles.input}
						value={value as number ?? ''}
						onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
						placeholder={option.description}
						min={option.min_value}
						max={option.max_value}
						step="any"
					/>
				)

			case OptionType.Boolean:
				return (
					<div className={styles.checkboxWrapper}>
						<input
							ref={inputRef as React.RefObject<HTMLInputElement>}
							type="checkbox"
							className={styles.checkbox}
							checked={value as boolean ?? false}
							onChange={(e) => onChange(e.target.checked)}
							id={`option-${option.name}`}
						/>
						<label htmlFor={`option-${option.name}`} className={styles.checkboxLabel}>
							{value ? 'True' : 'False'}
						</label>
					</div>
				)

			case OptionType.User:
			case OptionType.Mentionable:
				return (
					<select
						ref={inputRef as React.RefObject<HTMLSelectElement>}
						className={styles.select}
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
					>
						<option value="">Select a user...</option>
						{members.map((member) => (
							<option key={member.user.id} value={member.user.id}>
								{member.nick || member.user.username}
								{member.user.bot && ' [BOT]'}
							</option>
						))}
					</select>
				)

			case OptionType.Channel:
				const filteredChannels = option.channel_types
					? channels.filter(c => option.channel_types!.includes(c.type))
					: channels
				return (
					<select
						ref={inputRef as React.RefObject<HTMLSelectElement>}
						className={styles.select}
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
					>
						<option value="">Select a channel...</option>
						{filteredChannels.map((channel) => (
							<option key={channel.id} value={channel.id}>
								#{channel.name}
							</option>
						))}
					</select>
				)

			case OptionType.Role:
				// Roles not yet in session state, use text input
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="text"
						className={styles.input}
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
						placeholder="Enter role ID..."
					/>
				)

			case OptionType.Attachment:
				// Attachments not yet supported, show placeholder
				return (
					<div className={styles.placeholder}>
						Attachments not yet supported
					</div>
				)

			default:
				return (
					<input
						ref={inputRef as React.RefObject<HTMLInputElement>}
						type="text"
						className={styles.input}
						value={value as string ?? ''}
						onChange={(e) => onChange(e.target.value)}
						placeholder={option.description}
					/>
				)
		}
	}

	return (
		<div className={styles.container}>
			<label className={styles.label}>
				{option.name}
				{option.required && <span className={styles.required}>*</span>}
			</label>
			<div className={styles.description}>{option.description}</div>
			{renderInput()}
		</div>
	)
}
