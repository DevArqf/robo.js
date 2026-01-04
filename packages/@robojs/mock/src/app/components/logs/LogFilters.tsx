import { useCallback } from 'react'
import { useLogsFilters } from '../../stores/logsStore'
import type { SessionLogLevel } from '../../../types/index.js'
import styles from './LogFilters.module.css'

const LOG_LEVELS: { level: SessionLogLevel; label: string; color: string }[] = [
	{ level: 'trace', label: 'T', color: '#72767d' },
	{ level: 'debug', label: 'D', color: '#5865f2' },
	{ level: 'info', label: 'I', color: '#3ba55c' },
	{ level: 'warn', label: 'W', color: '#faa81a' },
	{ level: 'error', label: 'E', color: '#ed4245' }
]

export function LogFilters() {
	const { filters, setSearchFilter, toggleLevelFilter, setLevelFilter } = useLogsFilters()

	const handleSearchChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setSearchFilter(e.target.value)
		},
		[setSearchFilter]
	)

	const handleClearSearch = useCallback(() => {
		setSearchFilter('')
	}, [setSearchFilter])

	const handleLevelToggle = useCallback(
		(level: SessionLogLevel) => {
			toggleLevelFilter(level)
		},
		[toggleLevelFilter]
	)

	const handleShowAll = useCallback(() => {
		setLevelFilter(new Set())
	}, [setLevelFilter])

	const handleShowErrors = useCallback(() => {
		setLevelFilter(new Set(['error', 'warn'] as SessionLogLevel[]))
	}, [setLevelFilter])

	const hasActiveFilter = filters.levels.size > 0

	return (
		<div className={styles.container}>
			{/* Search input */}
			<div className={styles.searchContainer}>
				<SearchIcon />
				<input
					type="text"
					className={styles.searchInput}
					placeholder="Search logs..."
					value={filters.search}
					onChange={handleSearchChange}
				/>
				{filters.search && (
					<button className={styles.clearButton} onClick={handleClearSearch}>
						<ClearIcon />
					</button>
				)}
			</div>

			{/* Level filters */}
			<div className={styles.levelFilters}>
				{LOG_LEVELS.map(({ level, label, color }) => {
					const isActive = filters.levels.size === 0 || filters.levels.has(level)
					return (
						<button
							key={level}
							className={`${styles.levelButton} ${isActive ? styles.active : ''}`}
							style={{ '--level-color': color } as React.CSSProperties}
							onClick={() => handleLevelToggle(level)}
							title={`Toggle ${level} logs`}
						>
							{label}
						</button>
					)
				})}

				<div className={styles.separator} />

				<button
					className={`${styles.presetButton} ${!hasActiveFilter ? styles.active : ''}`}
					onClick={handleShowAll}
					title="Show all levels"
				>
					All
				</button>
				<button
					className={`${styles.presetButton} ${filters.levels.has('error') && filters.levels.has('warn') && filters.levels.size === 2 ? styles.active : ''}`}
					onClick={handleShowErrors}
					title="Show only warnings and errors"
				>
					Errors
				</button>
			</div>
		</div>
	)
}

// Icons
function SearchIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={styles.searchIcon}>
			<path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
		</svg>
	)
}

function ClearIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}
