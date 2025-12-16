import type { ChangeEventHandler } from 'react'
import MagnifyingGlass from '../icons/magnifying_glass'
import styles from './SearchInput.module.css'

export interface SearchInputProps {
	placeholder: string
	value?: string
	onChange?: ChangeEventHandler<HTMLInputElement>
	className?: string
}

export function SearchInput({ placeholder, value, onChange, className }: SearchInputProps) {
	return (
		<div className={[styles.root, className].filter(Boolean).join(' ')}>
			<input className={styles.input} placeholder={placeholder} value={value} onChange={onChange} />
			<span className={styles.icon} aria-hidden="true">
				<MagnifyingGlass width={16} height={16} fill="currentColor" />
			</span>
		</div>
	)
}


