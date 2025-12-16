import { useState, useEffect, useCallback } from 'react'
import { usePlaybackStore } from '../../stores/playbackStore'
import { loadRecordingToPlayback } from '../../utils/loadRecordingToPlayback'
import { apiFetch } from '../../utils/api'
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

function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString()
}

// Log viewer sub-component
function LogViewer({ testFile }: { testFile: string }) {
	const [content, setContent] = useState<string>('')
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

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

	if (loading) return <div className={styles.logLoading}>Loading logs...</div>
	if (error) return <div className={styles.logError}>{error}</div>
	if (!content) return <div className={styles.logEmpty}>No logs available</div>

	return (
		<pre className={styles.logContent}>
			{content.split('\n').map((line, i) => {
				let lineClass = styles.logLine
				if (line.includes(' ERROR ') || line.includes('[error]')) lineClass += ` ${styles.logError}`
				else if (line.includes(' WARN ') || line.includes('[warn]')) lineClass += ` ${styles.logWarn}`
				else if (line.includes(' DEBUG ') || line.includes('[debug]')) lineClass += ` ${styles.logDebug}`
				return (
					<div key={i} className={lineClass}>
						{line}
					</div>
				)
			})}
		</pre>
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
					<div className={styles.assertionValue}>
						<strong>Expected:</strong>
						<pre>{JSON.stringify(assertion.expected, null, 2)}</pre>
					</div>
					<div className={styles.assertionValue}>
						<strong>Actual:</strong>
						<pre>{JSON.stringify(assertion.actual, null, 2)}</pre>
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

// Test file detail view
function TestFileDetail({
	file,
	onBack,
	onReplay,
	replayLoading
}: {
	file: TestFileEntry
	onBack: () => void
	onReplay: (sessionId: string) => void
	replayLoading?: boolean
}) {
	const [activeSection, setActiveSection] = useState<'tests' | 'logs'>('tests')

	return (
		<div className={styles.detailView}>
			<div className={styles.detailHeader}>
				<button className={styles.backButton} onClick={onBack}>
					← Back
				</button>
				<h3 className={styles.detailTitle}>{file.path}</h3>
				<StatusBadge status={file.status} />
			</div>

			<div className={styles.detailMeta}>
				<span>Session: {file.sessionId}</span>
				<span>Started: {formatTime(file.startedAt)}</span>
				{file.completedAt && <span>Duration: {formatDuration(file.completedAt - file.startedAt)}</span>}
			</div>

			<div className={styles.detailActions}>
				{file.recordingPath && (
					<button
						className={styles.replayButton}
						onClick={() => onReplay(file.sessionId)}
						disabled={replayLoading}
					>
						{replayLoading ? 'Loading...' : '▶ Replay Session'}
					</button>
				)}
			</div>

			<div className={styles.sectionTabs}>
				<button
					className={`${styles.sectionTab} ${activeSection === 'tests' ? styles.active : ''}`}
					onClick={() => setActiveSection('tests')}
				>
					Tests ({file.tests.length})
				</button>
				<button
					className={`${styles.sectionTab} ${activeSection === 'logs' ? styles.active : ''}`}
					onClick={() => setActiveSection('logs')}
				>
					Logs
				</button>
			</div>

			<div className={styles.sectionContent}>
				{activeSection === 'tests' && (
					<div className={styles.testsList}>
						{file.tests.length === 0 && (
							<div className={styles.emptyState}>No test results recorded</div>
						)}
						{file.tests.map((test, i) => (
							<div key={i} className={`${styles.testItem} ${styles[test.status]}`}>
								<div className={styles.testHeader}>
									<StatusBadge status={test.status} />
									<span className={styles.testName}>{test.name}</span>
									<span className={styles.testDuration}>{formatDuration(test.duration)}</span>
								</div>
								{test.error && (
									<div className={styles.testError}>
										<strong>Error:</strong> {test.error.message}
										{test.error.stack && <pre className={styles.errorStack}>{test.error.stack}</pre>}
									</div>
								)}
								{test.assertions.length > 0 && (
									<div className={styles.assertionsList}>
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

	const { dispatch } = usePlaybackStore()
	const [replayLoading, setReplayLoading] = useState(false)

	const handleReplay = useCallback(
		async (sessionId: string) => {
			setReplayLoading(true)
			const result = await loadRecordingToPlayback(sessionId, dispatch)
			setReplayLoading(false)

			if (!result.success) {
				alert(`Failed to load recording: ${result.error}`)
			}
		},
		[dispatch]
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
					<p>Run tests using <code>robo mock test</code> to see results here.</p>
				</div>
			</div>
		)
	}

	// Show detail view if a file is selected
	if (selectedFile) {
		return (
			<div className={styles.container}>
				<TestFileDetail
					file={selectedFile}
					onBack={() => setSelectedFile(null)}
					onReplay={handleReplay}
					replayLoading={replayLoading}
				/>
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
			{/* Summary Header */}
			<div className={styles.summary}>
				<div className={styles.summaryHeader}>
					<h3>Test Run: {registry.runId}</h3>
					<StatusBadge status={registry.status} />
					<button className={styles.refreshButton} onClick={fetchRegistry} title="Refresh">
						↻
					</button>
				</div>
				<div className={styles.summaryStats}>
					<div className={styles.stat}>
						<span className={styles.statValue}>{totalTests}</span>
						<span className={styles.statLabel}>Total</span>
					</div>
					<div className={`${styles.stat} ${styles.passed}`}>
						<span className={styles.statValue}>{passedTests}</span>
						<span className={styles.statLabel}>Passed</span>
					</div>
					<div className={`${styles.stat} ${styles.failed}`}>
						<span className={styles.statValue}>{failedTests}</span>
						<span className={styles.statLabel}>Failed</span>
					</div>
					<div className={`${styles.stat} ${styles.skipped}`}>
						<span className={styles.statValue}>{skippedTests}</span>
						<span className={styles.statLabel}>Skipped</span>
					</div>
					<div className={styles.stat}>
						<span className={styles.statValue}>{formatDuration(duration)}</span>
						<span className={styles.statLabel}>Duration</span>
					</div>
				</div>
			</div>

			{/* Test Files List */}
			<div className={styles.filesList}>
				{registry.testFiles.map((file, i) => (
					<div
						key={i}
						className={`${styles.fileItem} ${styles[file.status]}`}
						onClick={() => setSelectedFile(file)}
					>
						<div className={styles.fileHeader}>
							<StatusBadge status={file.status} />
							<span className={styles.filePath}>{file.path}</span>
							<span className={styles.fileStats}>
								{file.tests.length} test{file.tests.length !== 1 ? 's' : ''}
							</span>
						</div>
						{file.tests.length > 0 && (
							<div className={styles.fileTests}>
								{file.tests.slice(0, 3).map((test, j) => (
									<span
										key={j}
										className={`${styles.testDot} ${styles[test.status]}`}
										title={test.name}
									/>
								))}
								{file.tests.length > 3 && (
									<span className={styles.moreTests}>+{file.tests.length - 3}</span>
								)}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	)
}
