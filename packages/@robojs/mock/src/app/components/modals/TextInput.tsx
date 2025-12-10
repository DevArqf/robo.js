import styles from './Modal.module.css'

// Discord TextInput styles
const TextInputStyle = {
	Short: 1,
	Paragraph: 2
} as const

export interface TextInputComponentData {
	type: 4
	custom_id: string
	style: 1 | 2
	label: string
	min_length?: number
	max_length?: number
	required?: boolean
	value?: string
	placeholder?: string
}

interface TextInputProps {
	component: TextInputComponentData
	value: string
	error?: string
	onChange: (value: string) => void
}

export function TextInput({ component, value, error, onChange }: TextInputProps) {
	const isMultiline = component.style === TextInputStyle.Paragraph
	const charCount = value.length
	const maxLength = component.max_length

	// Determine character count state for styling
	let charCountClass = styles.charCount
	if (maxLength) {
		const percentage = charCount / maxLength
		if (percentage >= 1) {
			charCountClass = `${styles.charCount} ${styles.atLimit}`
		} else if (percentage >= 0.9) {
			charCountClass = `${styles.charCount} ${styles.nearLimit}`
		}
	}

	const inputClass = error ? `${styles.input} ${styles.error}` : styles.input
	const textareaClass = error ? `${styles.textarea} ${styles.error}` : styles.textarea

	return (
		<div className={styles.inputGroup}>
			<label className={styles.label}>
				{component.label}
				{component.required && <span className={styles.required}>*</span>}
			</label>

			{isMultiline ? (
				<textarea
					className={textareaClass}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={component.placeholder}
					minLength={component.min_length}
					maxLength={component.max_length}
					rows={4}
				/>
			) : (
				<input
					type="text"
					className={inputClass}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={component.placeholder}
					minLength={component.min_length}
					maxLength={component.max_length}
				/>
			)}

			<div className={styles.inputFooter}>
				{error && <span className={styles.errorText}>{error}</span>}
				{maxLength && (
					<span className={charCountClass}>
						{charCount}/{maxLength}
					</span>
				)}
			</div>
		</div>
	)
}

export { TextInputStyle }
