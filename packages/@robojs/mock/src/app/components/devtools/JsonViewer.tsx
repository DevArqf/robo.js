import { useState, useCallback, useMemo } from 'react'
import styles from './JsonViewer.module.css'

interface JsonViewerProps {
	data: unknown
	collapsed?: number // Initial collapse depth (0 = all collapsed, -1 = all expanded)
	rootName?: string
}

export function JsonViewer({ data, collapsed = 2, rootName }: JsonViewerProps) {
	return (
		<div className={styles.viewer}>
			<JsonNode value={data} name={rootName} depth={0} initialCollapsed={collapsed} />
		</div>
	)
}

interface JsonNodeProps {
	value: unknown
	name?: string
	depth: number
	initialCollapsed: number
}

function JsonNode({ value, name, depth, initialCollapsed }: JsonNodeProps) {
	const shouldStartCollapsed = initialCollapsed >= 0 && depth >= initialCollapsed
	const [isCollapsed, setIsCollapsed] = useState(shouldStartCollapsed)

	const toggle = useCallback(() => setIsCollapsed((c) => !c), [])

	const { type, preview, isExpandable, children, length } = useMemo(() => {
		return analyzeValue(value)
	}, [value])

	// Copy value to clipboard
	const handleCopy = useCallback((e: React.MouseEvent) => {
		e.stopPropagation()
		try {
			const text = JSON.stringify(value, null, 2)
			navigator.clipboard.writeText(text)
		} catch {
			// Ignore copy errors
		}
	}, [value])

	// Render primitive values inline
	if (!isExpandable) {
		return (
			<div className={styles.node}>
				{name !== undefined && <span className={styles.key}>{name}: </span>}
				<span className={`${styles.value} ${styles[type]}`}>{preview}</span>
			</div>
		)
	}

	// Render expandable objects/arrays
	const bracketOpen = type === 'array' ? '[' : '{'
	const bracketClose = type === 'array' ? ']' : '}'

	return (
		<div className={styles.node}>
			<div className={styles.expandable} onClick={toggle}>
				<span className={`${styles.arrow} ${isCollapsed ? styles.collapsed : ''}`}>
					<ChevronIcon />
				</span>
				{name !== undefined && <span className={styles.key}>{name}: </span>}
				<span className={styles.bracket}>{bracketOpen}</span>
				{isCollapsed && (
					<>
						<span className={styles.preview}>{length} items</span>
						<span className={styles.bracket}>{bracketClose}</span>
					</>
				)}
				<button className={styles.copyButton} onClick={handleCopy} title="Copy to clipboard">
					<CopyIcon />
				</button>
			</div>
			{!isCollapsed && (
				<div className={styles.children}>
					{children.map(([childKey, childValue], i) => (
						<JsonNode
							key={childKey ?? i}
							value={childValue}
							name={type === 'array' ? String(i) : childKey}
							depth={depth + 1}
							initialCollapsed={initialCollapsed}
						/>
					))}
					<div className={styles.closeBracket}>{bracketClose}</div>
				</div>
			)}
		</div>
	)
}

function analyzeValue(value: unknown): {
	type: string
	preview: string
	isExpandable: boolean
	children: [string, unknown][]
	length: number
} {
	if (value === null) {
		return { type: 'null', preview: 'null', isExpandable: false, children: [], length: 0 }
	}

	if (value === undefined) {
		return { type: 'undefined', preview: 'undefined', isExpandable: false, children: [], length: 0 }
	}

	if (typeof value === 'boolean') {
		return { type: 'boolean', preview: String(value), isExpandable: false, children: [], length: 0 }
	}

	if (typeof value === 'number') {
		return { type: 'number', preview: String(value), isExpandable: false, children: [], length: 0 }
	}

	if (typeof value === 'string') {
		const escaped = JSON.stringify(value)
		return { type: 'string', preview: escaped, isExpandable: false, children: [], length: 0 }
	}

	if (Array.isArray(value)) {
		return {
			type: 'array',
			preview: `Array(${value.length})`,
			isExpandable: value.length > 0,
			children: value.map((v, i) => [String(i), v]),
			length: value.length
		}
	}

	if (typeof value === 'object') {
		const entries = Object.entries(value)
		return {
			type: 'object',
			preview: `Object`,
			isExpandable: entries.length > 0,
			children: entries,
			length: entries.length
		}
	}

	return { type: 'unknown', preview: String(value), isExpandable: false, children: [], length: 0 }
}

// Icons
function ChevronIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
			<path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" fill="none" />
		</svg>
	)
}

function CopyIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z" />
		</svg>
	)
}
