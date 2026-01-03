import { useState, useCallback, useMemo } from 'react'
import type { SessionLogEntry } from '../../../types/index.js'
import { AnsiText, stripAnsi } from './AnsiText.js'
import styles from './LogEntry.module.css'

interface LogEntryProps {
	log: SessionLogEntry
	onSeek?: () => void
	/** Show date separator if this is first log of a new day */
	showDateSeparator?: boolean
}

export function LogEntry({ log, onSeek, showDateSeparator }: LogEntryProps) {
	const [expanded, setExpanded] = useState(false)
	const [copied, setCopied] = useState(false)

	const handleCopy = useCallback(async () => {
		const text = formatLogForCopy(log)
		await navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}, [log])

	const handleToggleExpand = useCallback(() => {
		setExpanded((prev) => !prev)
	}, [])

	const hasData = log.data && log.data.length > 0
	// Strip ANSI for length calculations to avoid counting escape codes
	const strippedMessage = useMemo(() => stripAnsi(log.message), [log.message])
	const hasExpandableContent = hasData || strippedMessage.length > 100 || strippedMessage.includes('\n')

	return (
		<>
			{/* Date separator */}
			{showDateSeparator && <DateSeparator timestamp={log.timestamp} />}

			<div className={`${styles.entry} ${styles[log.level]} ${expanded ? styles.expanded : ''}`}>
				{/* Table row layout */}
				<div className={styles.row}>
					{/* Time column */}
					<span className={styles.time}>{formatTimestamp(log.timestamp)}</span>

					{/* Source column */}
					{log.prefix && (
						<span className={styles.source}>
							<SourceIcon />
							<span className={styles.sourceName}>{log.prefix}</span>
						</span>
					)}

					{/* Level column */}
					<span className={`${styles.level} ${styles[`level_${log.level}`]}`}>
						<span className={styles.levelDot} />
						<span className={styles.levelLabel}>{log.level.toUpperCase()}</span>
					</span>

					{/* Message column - render with ANSI colors */}
					<span className={styles.message}>
						{expanded ? (
							<AnsiText text={log.message} />
						) : (
							<AnsiText text={truncateMessage(log.message, strippedMessage)} />
						)}
					</span>

					{/* Hover actions */}
					<div className={styles.actions}>
						<button
							className={`${styles.actionButton} ${copied ? styles.copied : ''}`}
							onClick={handleCopy}
							title={copied ? 'Copied!' : 'Copy log'}
						>
							{copied ? <CheckIcon /> : <CopyIcon />}
						</button>
						{onSeek && (
							<button className={styles.actionButton} onClick={onSeek} title="Seek to this time">
								<SeekIcon />
							</button>
						)}
						{hasExpandableContent && (
							<button
								className={`${styles.actionButton} ${expanded ? styles.active : ''}`}
								onClick={handleToggleExpand}
								title={expanded ? 'Collapse' : 'Expand'}
							>
								<ExpandIcon expanded={expanded} />
							</button>
						)}
					</div>
				</div>

				{/* Expanded details */}
				{expanded && hasData && (
					<div className={styles.details}>
						<pre className={styles.detailsCode}>{JSON.stringify(log.data, null, 2)}</pre>
					</div>
				)}
			</div>
		</>
	)
}

/** Date separator row */
function DateSeparator({ timestamp }: { timestamp: number }) {
	const date = new Date(timestamp)
	const label = date.toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		second: '2-digit'
	})

	return (
		<div className={styles.dateSeparator}>
			<span className={styles.dateSeparatorLine} />
			<span className={styles.dateSeparatorLabel}>{label}</span>
			<span className={styles.dateSeparatorLine} />
		</div>
	)
}

// Format timestamp as YYYY-MM-DD HH:MM:SS.mmm TZ
function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp)
	const year = date.getFullYear()
	const month = (date.getMonth() + 1).toString().padStart(2, '0')
	const day = date.getDate().toString().padStart(2, '0')
	const hours = date.getHours().toString().padStart(2, '0')
	const minutes = date.getMinutes().toString().padStart(2, '0')
	const seconds = date.getSeconds().toString().padStart(2, '0')
	const ms = date.getMilliseconds().toString().padStart(3, '0')

	// Get short timezone
	const tz =
		new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
			.formatToParts(date)
			.find((p) => p.type === 'timeZoneName')?.value || ''

	return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms} ${tz}`
}

// Truncate long messages for display
// Takes raw message (with ANSI) and stripped version for length calculation
function truncateMessage(message: string, strippedMessage: string, maxLength = 200): string {
	// Handle multi-line messages using stripped version for detection
	const strippedFirstLine = strippedMessage.split('\n')[0]
	const rawFirstLine = message.split('\n')[0]

	if (strippedFirstLine.length > maxLength) {
		// Need to truncate - but we need to be careful with ANSI codes
		// Simple approach: find where to cut in stripped, then cut raw proportionally
		// This preserves ANSI codes up to that point
		return truncateWithAnsi(rawFirstLine, strippedFirstLine, maxLength) + '...'
	}
	if (strippedMessage.includes('\n')) {
		return rawFirstLine + ' ...'
	}
	return message
}

// Truncate a message with ANSI codes to approximately maxLength visible characters
function truncateWithAnsi(raw: string, stripped: string, maxLength: number): string {
	if (stripped.length <= maxLength) {
		return raw
	}

	// Walk through raw string, tracking visible character count
	const ANSI_PATTERN = /\x1b\[([0-9;]+)m/g
	let result = ''
	let visibleCount = 0
	let lastIndex = 0
	let match: RegExpExecArray | null

	ANSI_PATTERN.lastIndex = 0

	while ((match = ANSI_PATTERN.exec(raw)) !== null) {
		// Add text before this ANSI code
		const textBefore = raw.slice(lastIndex, match.index)
		const charsToAdd = Math.min(textBefore.length, maxLength - visibleCount)

		if (charsToAdd > 0) {
			result += textBefore.slice(0, charsToAdd)
			visibleCount += charsToAdd
		}

		if (visibleCount >= maxLength) {
			return result
		}

		// Always include the ANSI code (it's invisible)
		result += match[0]
		lastIndex = ANSI_PATTERN.lastIndex
	}

	// Handle remaining text after last ANSI code
	const remaining = raw.slice(lastIndex)
	const charsToAdd = Math.min(remaining.length, maxLength - visibleCount)
	if (charsToAdd > 0) {
		result += remaining.slice(0, charsToAdd)
	}

	return result
}

// Format log for clipboard (strip ANSI codes for clean text)
function formatLogForCopy(log: SessionLogEntry): string {
	const timestamp = new Date(log.timestamp).toISOString()
	const prefix = log.prefix ? `[${log.prefix}] ` : ''
	// Strip ANSI codes for clipboard text
	const cleanMessage = stripAnsi(log.message)
	let text = `[${timestamp}] [${log.level.toUpperCase()}] ${prefix}${cleanMessage}`
	if (log.data && log.data.length > 0) {
		text += '\n' + JSON.stringify(log.data, null, 2)
	}
	return text
}

// Icons
function SourceIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className={styles.sourceIcon}>
			<path d="M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z" />
		</svg>
	)
}

function CopyIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
			<path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
		</svg>
	)
}

function CheckIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z" />
		</svg>
	)
}

function SeekIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M12.5 4a.5.5 0 0 0-1 0v3.248L5.233 3.612C4.693 3.3 4 3.678 4 4.308v7.384c0 .63.692 1.008 1.233.696L11.5 8.752V12a.5.5 0 0 0 1 0V4z" />
		</svg>
	)
}

function ExpandIcon({ expanded }: { expanded: boolean }) {
	return (
		<svg
			width="12"
			height="12"
			viewBox="0 0 16 16"
			fill="currentColor"
			style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
		>
			<path
				fillRule="evenodd"
				d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
			/>
		</svg>
	)
}
