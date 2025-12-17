import { useState, useEffect, useCallback } from 'react'
import { usePlaybackStore } from '../../stores/playbackStore'
import { useWebSocket } from '../../stores/sessionStore'
import { loadRecordingToPlayback } from '../../utils/loadRecordingToPlayback'
import { apiFetch } from '../../utils/api'
import { useToaster } from '../common/Toaster'
import { JsonViewer } from './JsonViewer'
import styles from './TestResults.module.css'

// Types matching the registry
interface TestSessionRegistry {
	runId: string
	startedAt: number
	completedAt?: number
	status: 'running' | 'passed' | 'failed' | 'error'
	testFiles: TestFileEntry[]
}

interface TestFileEntry {
	path: string
	sessionId: string
	status: 'running' | 'passed' | 'failed'
	startedAt: number
	completedAt?: number
	tests: TestResult[]
	pendingAssertions?: AssertionResult[]
	recordingPath?: string
}

interface TestResult {
	name: string
	status: 'passed' | 'failed' | 'skipped'
	duration: number
	assertions: AssertionResult[]
	error?: {
		message: string
		stack?: string
	}
}

interface AssertionResult {
	description: string
	passed: boolean
	expected: unknown
	actual: unknown
	diff?: string
}

// Sub-components
function StatusBadge({ status }: { status: string }) {
	const className = `${styles.statusBadge} ${styles[status] || ''}`
	return <span className={className}>{status}</span>
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
	return `${(ms / 60000).toFixed(1)}m`
}

// Log level type
type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug'

// Log viewer sub-component with filtering
function LogViewer({ testFile }: { testFile: string }) {
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [levelFilter, setLevelFilter] = useState<LogLevel>('all')

	useEffect(() => {
		const logName = testFile.split('/').pop()?.replace(/\.test\.(ts|js|tsx|jsx)$/, '.log') || ''
		if (!logName) {
			setLoading(false)
			setError('Could not determine log file name')
			return
		}

		apiFetch(`/control/tests/logs?file=${encodeURIComponent(logName)}`)
			.then((res) => res.json())
			.then((data) => {
				if (data.exists) {
					setContent(data.content)
				} else {
					setError('Log file not found')
				}
				setLoading(false)
			})
			.catch((err) => {
				setError(err.message)
				setLoading(false)
			})
	}, [testFile])

	// Filter and search logs
	// Robo.js logger format: "prefix: level - message" where level is padded to 5 chars
	// Examples: "mock: error -", "mock: debug -", "mock: info  -", "mock: warn  -"
	const filteredLines = content.split('\n').filter((line) => {
		// Apply level filter
		if (levelFilter !== 'all') {
			const lowerLine = line.toLowerCase()
			// Match Robo.js logger format: "level -" or "level  -" (with padding)
			const isError = /\berror\s+-/.test(lowerLine)
			const isWarn = /\bwarn\s+-/.test(lowerLine)
			const isDebug = /\bdebug\s+-/.test(lowerLine)
			const isTrace = /\btrace\s+-/.test(lowerLine)
			const isInfo = /\binfo\s+-/.test(lowerLine) || (!isError && !isWarn && !isDebug && !isTrace)

			if (levelFilter === 'error' && !isError) return false
			if (levelFilter === 'warn' && !isWarn) return false
			if (levelFilter === 'info' && !isInfo) return false
			if (levelFilter === 'debug' && !(isDebug || isTrace)) return false
		}

		// Apply search filter
		if (searchQuery && !line.toLowerCase().includes(searchQuery.toLowerCase())) {
			return false
		}

		return true
	})

	if (loading) return <div className={styles.logLoading}>Loading logs...</div>
	if (error) return <div className={styles.logError}>{error}</div>
	if (!content) return <div className={styles.logEmpty}>No logs available</div>

	return (
		<div className={styles.logViewerContainer}>
			<div className={styles.logFilters}>
				<input
					type="text"
					className={styles.logSearchInput}
					placeholder="Search logs..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
				<div className={styles.logLevelFilters}>
					{(['all', 'error', 'warn', 'info', 'debug'] as LogLevel[]).map((level) => (
						<button
							key={level}
							className={`${styles.logLevelButton} ${levelFilter === level ? styles.active : ''} ${styles[level]}`}
							onClick={() => setLevelFilter(level)}
						>
							{level.toUpperCase()}
						</button>
					))}
				</div>
				<span className={styles.logCount}>
					{filteredLines.length} / {content.split('\n').length} lines
				</span>
			</div>
			<pre className={styles.logContent}>
				{filteredLines.map((line, i) => {
					let lineClass = styles.logLine
					const lowerLine = line.toLowerCase()
					if (/\berror\s+-/.test(lowerLine)) lineClass += ` ${styles.logLineError}`
					else if (/\bwarn\s+-/.test(lowerLine)) lineClass += ` ${styles.logLineWarn}`
					else if (/\b(debug|trace)\s+-/.test(lowerLine)) lineClass += ` ${styles.logLineDebug}`

					// Highlight search matches
					if (searchQuery) {
						const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
						const parts = line.split(regex)
						return (
							<div key={i} className={lineClass}>
								{parts.map((part, j) =>
									regex.test(part) ? (
										<mark key={j} className={styles.logHighlight}>
											{part}
										</mark>
									) : (
										part
									)
								)}
							</div>
						)
					}

					return (
						<div key={i} className={lineClass}>
							{line}
						</div>
					)
				})}
			</pre>
		</div>
	)
}

// Assertion detail component
function AssertionDetail({ assertion }: { assertion: AssertionResult }) {
	const [expanded, setExpanded] = useState(false)

	return (
		<div className={`${styles.assertion} ${assertion.passed ? styles.passed : styles.failed}`}>
			<div className={styles.assertionHeader} onClick={() => setExpanded(!expanded)}>
				<span className={styles.assertionIcon}>{assertion.passed ? '✓' : '✗'}</span>
				<span className={styles.assertionDescription}>{assertion.description}</span>
				<span className={styles.expandIcon}>{expanded ? '▼' : '▶'}</span>
			</div>
			{expanded && (
				<div className={styles.assertionDetails}>
					<div className={styles.assertionValuePair}>
						<div className={styles.assertionValue}>
							<strong>Expected:</strong>
							<div className={styles.jsonViewerWrapper}>
								<JsonViewer data={assertion.expected} collapsed={-1} />
							</div>
						</div>
						<div className={styles.assertionValue}>
							<strong>Actual:</strong>
							<div className={styles.jsonViewerWrapper}>
								<JsonViewer data={assertion.actual} collapsed={-1} />
							</div>
						</div>
					</div>
					{assertion.diff && (
						<div className={styles.assertionDiff}>
							<strong>Diff:</strong>
							<pre>{assertion.diff}</pre>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// Compact file list item for split view
function FileListItem({
	file,
	isSelected,
	onSelect
}: {
	file: TestFileEntry
	isSelected: boolean
	onSelect: () => void
}) {
	const fileName = file.path.split('/').pop() || file.path
	const passedCount = file.tests.filter((t) => t.status === 'passed').length
	const failedCount = file.tests.filter((t) => t.status === 'failed').length

	return (
		<div
			className={`${styles.fileListItem} ${styles[file.status]} ${isSelected ? styles.selected : ''}`}
			onClick={onSelect}
		>
			<div className={styles.fileListItemMain}>
				<span className={styles.fileListItemStatus}>
					{file.status === 'passed' ? '✓' : file.status === 'failed' ? '✗' : '○'}
				</span>
				<span className={styles.fileListItemName} title={file.path}>
					{fileName}
				</span>
			</div>
			<div className={styles.fileListItemStats}>
				{passedCount > 0 && <span className={styles.passedCount}>{passedCount}</span>}
				{failedCount > 0 && <span className={styles.failedCount}>{failedCount}</span>}
			</div>
		</div>
	)
}

// Compact detail view for split pane
function CompactDetailView({
	file,
	onReplay,
	onCopySessionId,
	replayLoading
}: {
	file: TestFileEntry
	onReplay: (sessionId: string) => void
	onCopySessionId: (sessionId: string) => void
	replayLoading?: boolean
}) {
	const [activeSection, setActiveSection] = useState<'tests' | 'logs'>('tests')

	return (
		<div className={styles.compactDetailView}>
			<div className={styles.compactDetailHeader}>
				<div className={styles.compactDetailInfo}>
					<StatusBadge status={file.status} />
					<span className={styles.compactDetailPath} title={file.path}>
						{file.path}
					</span>
					{file.completedAt && (
						<span className={styles.compactDetailDuration}>
							{formatDuration(file.completedAt - file.startedAt)}
						</span>
					)}
					<span
						className={styles.compactDetailSessionId}
						title={`Session ID: ${file.sessionId}\nClick to copy`}
						onClick={(e) => {
							e.stopPropagation()
							navigator.clipboard.writeText(file.sessionId)
							onCopySessionId(file.sessionId)
						}}
					>
						{file.sessionId.slice(0, 8)}...
					</span>
				</div>
				<button
					className={`${styles.replaySessionButton} ${!file.recordingPath ? styles.disabled : ''}`}
					onClick={() => onReplay(file.sessionId)}
					disabled={replayLoading || !file.recordingPath}
					title={file.recordingPath ? 'Play back this test session in the Stage view above' : 'No recording available for this session'}
				>
					{replayLoading ? (
						<>
							<span className={styles.replaySpinner} />
							Loading...
						</>
					) : (
						<>
							<span className={styles.replayIcon}>▶</span>
							Replay
						</>
					)}
				</button>
			</div>

			<div className={styles.compactSectionTabs}>
				<button
					className={`${styles.compactSectionTab} ${activeSection === 'tests' ? styles.active : ''}`}
					onClick={() => setActiveSection('tests')}
				>
					Tests ({file.tests.length})
				</button>
				<button
					className={`${styles.compactSectionTab} ${activeSection === 'logs' ? styles.active : ''}`}
					onClick={() => setActiveSection('logs')}
				>
					Logs
				</button>
			</div>

			<div className={styles.compactSectionContent}>
				{activeSection === 'tests' && (
					<div className={styles.compactTestsList}>
						{file.tests.length === 0 && (
							<div className={styles.emptyState}>No test results recorded</div>
						)}
						{file.tests.map((test, i) => (
							<div key={i} className={`${styles.compactTestItem} ${styles[test.status]}`}>
								<div className={styles.compactTestHeader}>
									<span className={styles.compactTestIcon}>
										{test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○'}
									</span>
									<span className={styles.compactTestName}>{test.name}</span>
									<span className={styles.compactTestDuration}>{formatDuration(test.duration)}</span>
								</div>
								{test.error && (
									<div className={styles.compactTestError}>
										{test.error.message}
										{test.error.stack && (
											<pre className={styles.compactErrorStack}>{test.error.stack}</pre>
										)}
									</div>
								)}
								{test.assertions.length > 0 && (
									<div className={styles.compactAssertionsList}>
										{test.assertions.map((assertion, j) => (
											<AssertionDetail key={j} assertion={assertion} />
										))}
									</div>
								)}
							</div>
						))}
					</div>
				)}
				{activeSection === 'logs' && <LogViewer testFile={file.path} />}
			</div>
		</div>
	)
}

// Main component
export function TestResults() {
	const [registry, setRegistry] = useState<TestSessionRegistry | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedFile, setSelectedFile] = useState<TestFileEntry | null>(null)
	const [summaryCollapsed, setSummaryCollapsed] = useState(false)
	const { showToast } = useToaster()

	const fetchRegistry = useCallback(() => {
		setLoading(true)
		apiFetch('/control/tests/registry')
			.then((res) => res.json())
			.then((data) => {
				setRegistry(data.registry)
				setLoading(false)
			})
			.catch((err) => {
				setError(err.message)
				setLoading(false)
			})
	}, [])

	useEffect(() => {
		fetchRegistry()
		// Poll for updates every 2 seconds while tests are running
		const interval = setInterval(() => {
			if (registry?.status === 'running') {
				fetchRegistry()
			}
		}, 2000)
		return () => clearInterval(interval)
	}, [fetchRegistry, registry?.status])

	// Auto-select first file if none selected
	useEffect(() => {
		if (registry && registry.testFiles.length > 0 && !selectedFile) {
			setSelectedFile(registry.testFiles[0])
		}
	}, [registry, selectedFile])

	const { dispatch: playbackDispatch } = usePlaybackStore()
	const { disconnect } = useWebSocket()
	const [replayLoading, setReplayLoading] = useState(false)

	const handleReplay = useCallback(
		async (sessionId: string) => {
			setReplayLoading(true)

			// Set playback mode FIRST so UI doesn't show "disconnected" state
			// This signals to the UI that we're transitioning to playback
			playbackDispatch({ type: 'SET_MODE', payload: 'playback' })

			// Disconnect from any current session - playback mode uses recorded data, not live
			disconnect()

			// Load the recording into playback store
			const result = await loadRecordingToPlayback(sessionId, playbackDispatch)

			setReplayLoading(false)

			if (!result.success) {
				// If loading failed, revert to live mode
				playbackDispatch({ type: 'SET_MODE', payload: 'live' })
				showToast(`Failed to load recording: ${result.error}`, 'error')
				return
			}

			// Playback mode is now active - UI will show recorded channels/members/messages
			showToast('Playback loaded - use timeline to navigate', 'success', 3000)
		},
		[playbackDispatch, disconnect, showToast]
	)

	if (loading && !registry) {
		return (
			<div className={styles.container}>
				<div className={styles.loading}>Loading test results...</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className={styles.container}>
				<div className={styles.error}>Error loading test results: {error}</div>
			</div>
		)
	}

	if (!registry) {
		return (
			<div className={styles.container}>
				<div className={styles.emptyState}>
					<h3>No Test Results</h3>
					<p>
						Run tests using <code>robo mock test</code> to see results here.
					</p>
				</div>
			</div>
		)
	}

	// Calculate summary stats
	const totalTests = registry.testFiles.reduce((sum, f) => sum + f.tests.length, 0)
	const passedTests = registry.testFiles.reduce(
		(sum, f) => sum + f.tests.filter((t) => t.status === 'passed').length,
		0
	)
	const failedTests = registry.testFiles.reduce(
		(sum, f) => sum + f.tests.filter((t) => t.status === 'failed').length,
		0
	)
	const skippedTests = registry.testFiles.reduce(
		(sum, f) => sum + f.tests.filter((t) => t.status === 'skipped').length,
		0
	)
	const duration = registry.completedAt ? registry.completedAt - registry.startedAt : Date.now() - registry.startedAt

	return (
		<div className={styles.container}>
			{/* Collapsible Summary Bar */}
			<div className={`${styles.summaryBar} ${summaryCollapsed ? styles.collapsed : ''}`}>
				<button className={styles.summaryToggle} onClick={() => setSummaryCollapsed(!summaryCollapsed)}>
					{summaryCollapsed ? '▶' : '▼'}
				</button>
				<StatusBadge status={registry.status} />
				<span className={styles.summaryRunId}>{registry.runId}</span>
				<div className={styles.summaryInlineStats}>
					<span className={styles.summaryStatTotal}>{totalTests}</span>
					<span className={styles.summaryStatPassed}>{passedTests} ✓</span>
					{failedTests > 0 && <span className={styles.summaryStatFailed}>{failedTests} ✗</span>}
					{skippedTests > 0 && <span className={styles.summaryStatSkipped}>{skippedTests} ○</span>}
					<span className={styles.summaryStatDuration}>{formatDuration(duration)}</span>
				</div>
				<button className={styles.refreshButton} onClick={fetchRegistry} title="Refresh">
					↻
				</button>
			</div>

			{/* Split Pane Layout */}
			<div className={styles.splitPane}>
				{/* Left: File List */}
				<div className={styles.fileListPane}>
					{registry.testFiles.map((file, i) => (
						<FileListItem
							key={i}
							file={file}
							isSelected={selectedFile?.sessionId === file.sessionId}
							onSelect={() => setSelectedFile(file)}
						/>
					))}
				</div>

				{/* Right: Detail View */}
				<div className={styles.detailPane}>
					{selectedFile ? (
						<CompactDetailView
							file={selectedFile}
							onReplay={handleReplay}
							onCopySessionId={(id) => showToast(`Session ID copied: ${id}`, 'success', 2000)}
							replayLoading={replayLoading}
						/>
					) : (
						<div className={styles.noSelection}>Select a test file to view details</div>
					)}
				</div>
			</div>
		</div>
	)
}
