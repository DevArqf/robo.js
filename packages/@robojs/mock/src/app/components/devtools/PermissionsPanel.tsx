import { useCallback, useState, useEffect } from 'react'
import { useStageData } from '../../hooks/useStageData'
import { useToaster } from '../common/Toaster'
import styles from './PermissionsPanel.module.css'

type EnforcementLevel = 'none' | 'basic' | 'strict'

interface PermissionOverride {
	id: string
	user_id: string
	channel_id: string | null
	guild_id: string | null
	permissions: Record<string, 'grant' | 'deny' | 'inherit'>
	expires_at: number | null
	created_at: number
	reason?: string
}

interface PermissionDeniedEvent {
	timestamp: number
	method: string
	path: string
	missing_permissions: string[]
	code: number
	message: string
	channel_id?: string
	guild_id?: string
}

export function PermissionsPanel() {
	const { sessionId } = useStageData()
	const { showToast } = useToaster()

	// Enforcement level state
	const [enforcementLevel, setEnforcementLevel] = useState<EnforcementLevel>('none')
	const [isRuntimeLevel, setIsRuntimeLevel] = useState(false)

	// Overrides state
	const [overrides, setOverrides] = useState<PermissionOverride[]>([])

	// Denied events state
	const [deniedEvents, setDeniedEvents] = useState<PermissionDeniedEvent[]>([])

	// Detect API prefix from current URL
	const getApiPrefix = useCallback(() => {
		const pathname = window.location.pathname
		const stageIndex = pathname.indexOf('/stage')
		return stageIndex !== -1 ? pathname.slice(0, stageIndex) : ''
	}, [])

	// Fetch initial data
	useEffect(() => {
		if (!sessionId) return

		const fetchData = async () => {
			const apiPrefix = getApiPrefix()

			// Fetch enforcement level
			try {
				const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/enforcement`)
				if (response.ok) {
					const data = await response.json()
					setEnforcementLevel(data.level)
					setIsRuntimeLevel(data.is_runtime)
				}
			} catch {
				// Ignore errors
			}

			// Fetch overrides
			try {
				const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/overrides`)
				if (response.ok) {
					const data = await response.json()
					setOverrides(data.overrides)
				}
			} catch {
				// Ignore errors
			}

			// Fetch denied events
			try {
				const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/denied`)
				if (response.ok) {
					const data = await response.json()
					setDeniedEvents(data.events)
				}
			} catch {
				// Ignore errors
			}
		}

		fetchData()
	}, [sessionId, getApiPrefix])

	// Change enforcement level
	const handleEnforcementChange = useCallback(
		async (level: EnforcementLevel) => {
			if (!sessionId) return

			const apiPrefix = getApiPrefix()
			try {
				const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/enforcement`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ level })
				})

				if (response.ok) {
					const data = await response.json()
					setEnforcementLevel(data.level)
					setIsRuntimeLevel(data.is_runtime)
					showToast(`Enforcement set to ${level}`, 'success')
				} else {
					showToast('Failed to change enforcement level', 'error')
				}
			} catch {
				showToast('Failed to change enforcement level', 'error')
			}
		},
		[sessionId, getApiPrefix, showToast]
	)

	// Remove override
	const handleRemoveOverride = useCallback(
		async (overrideId: string) => {
			if (!sessionId) return

			const apiPrefix = getApiPrefix()
			try {
				const response = await fetch(
					`${apiPrefix}/api/control/sessions/${sessionId}/permissions/overrides/${overrideId}`,
					{ method: 'DELETE' }
				)

				if (response.ok) {
					setOverrides((prev) => prev.filter((o) => o.id !== overrideId))
					showToast('Override removed', 'success')
				} else {
					showToast('Failed to remove override', 'error')
				}
			} catch {
				showToast('Failed to remove override', 'error')
			}
		},
		[sessionId, getApiPrefix, showToast]
	)

	// Clear denied events
	const handleClearDeniedEvents = useCallback(async () => {
		if (!sessionId) return

		const apiPrefix = getApiPrefix()
		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/denied`, {
				method: 'DELETE'
			})

			if (response.ok) {
				setDeniedEvents([])
				showToast('Denied events cleared', 'success')
			} else {
				showToast('Failed to clear denied events', 'error')
			}
		} catch {
			showToast('Failed to clear denied events', 'error')
		}
	}, [sessionId, getApiPrefix, showToast])

	// Add quick override (grant admin)
	const handleGrantAdmin = useCallback(async () => {
		if (!sessionId) return

		const apiPrefix = getApiPrefix()
		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/overrides`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: '*',
					permissions: { Administrator: 'grant' },
					reason: 'Quick grant - All users admin'
				})
			})

			if (response.ok) {
				const data = await response.json()
				setOverrides((prev) => [...prev, data.override])
				showToast('Administrator granted to all users', 'success')
			} else {
				showToast('Failed to add override', 'error')
			}
		} catch {
			showToast('Failed to add override', 'error')
		}
	}, [sessionId, getApiPrefix, showToast])

	// Deny all permissions
	const handleDenyAll = useCallback(async () => {
		if (!sessionId) return

		const apiPrefix = getApiPrefix()
		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/overrides`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: '*',
					permissions: { SendMessages: 'deny', ManageMessages: 'deny', ManageChannels: 'deny' },
					reason: 'Quick deny - Common permissions denied'
				})
			})

			if (response.ok) {
				const data = await response.json()
				setOverrides((prev) => [...prev, data.override])
				showToast('Common permissions denied', 'success')
			} else {
				showToast('Failed to add override', 'error')
			}
		} catch {
			showToast('Failed to add override', 'error')
		}
	}, [sessionId, getApiPrefix, showToast])

	// Clear all overrides
	const handleClearOverrides = useCallback(async () => {
		if (!sessionId) return

		const apiPrefix = getApiPrefix()
		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/permissions/overrides`, {
				method: 'DELETE'
			})

			if (response.ok) {
				setOverrides([])
				showToast('All overrides cleared', 'success')
			} else {
				showToast('Failed to clear overrides', 'error')
			}
		} catch {
			showToast('Failed to clear overrides', 'error')
		}
	}, [sessionId, getApiPrefix, showToast])

	// Format timestamp
	const formatTime = (ts: number) => {
		const date = new Date(ts)
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	}

	return (
		<div className={styles.container}>
			{/* Enforcement Level Section */}
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>
					<ShieldIcon />
					Enforcement Level
				</h3>
				<p className={styles.description}>
					Control how strictly permissions are checked for API requests.
				</p>

				<div className={styles.levelButtons}>
					<button
						className={`${styles.levelButton} ${enforcementLevel === 'none' ? styles.active : ''}`}
						onClick={() => handleEnforcementChange('none')}
					>
						<span className={styles.levelLabel}>None</span>
						<span className={styles.levelDesc}>All allowed</span>
					</button>
					<button
						className={`${styles.levelButton} ${enforcementLevel === 'basic' ? styles.active : ''}`}
						onClick={() => handleEnforcementChange('basic')}
					>
						<span className={styles.levelLabel}>Basic</span>
						<span className={styles.levelDesc}>Simple checks</span>
					</button>
					<button
						className={`${styles.levelButton} ${enforcementLevel === 'strict' ? styles.active : ''}`}
						onClick={() => handleEnforcementChange('strict')}
					>
						<span className={styles.levelLabel}>Strict</span>
						<span className={styles.levelDesc}>Full Discord</span>
					</button>
				</div>

				{isRuntimeLevel && (
					<p className={styles.runtimeNote}>Currently using runtime setting (not config default)</p>
				)}

				<div className={styles.quickActions}>
					<h4 className={styles.quickTitle}>Quick Actions</h4>
					<div className={styles.buttonGroup}>
						<button className={styles.quickButton} onClick={handleGrantAdmin} title="Grant admin to all">
							<GrantIcon /> Grant Admin
						</button>
						<button className={styles.quickButton} onClick={handleDenyAll} title="Deny common permissions">
							<DenyIcon /> Deny All
						</button>
						{overrides.length > 0 && (
							<button className={styles.quickButton} onClick={handleClearOverrides} title="Clear all overrides">
								<ClearIcon /> Reset
							</button>
						)}
					</div>
				</div>
			</div>

			{/* Overrides Section */}
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>
					<OverrideIcon />
					Permission Overrides
					{overrides.length > 0 && <span className={styles.badge}>{overrides.length}</span>}
				</h3>
				<p className={styles.description}>Active permission overrides for testing scenarios.</p>

				{overrides.length === 0 ? (
					<p className={styles.emptyState}>No overrides active</p>
				) : (
					<div className={styles.overridesList}>
						{overrides.map((override) => (
							<div key={override.id} className={styles.overrideItem}>
								<div className={styles.overrideHeader}>
									<span className={styles.overrideUser}>
										{override.user_id === '*' ? 'All Users' : override.user_id}
									</span>
									<button
										className={styles.removeButton}
										onClick={() => handleRemoveOverride(override.id)}
										title="Remove override"
									>
										<CloseIcon />
									</button>
								</div>
								<div className={styles.overridePermissions}>
									{Object.entries(override.permissions).map(([perm, value]) => (
										<span
											key={perm}
											className={`${styles.permTag} ${value === 'grant' ? styles.grant : value === 'deny' ? styles.deny : ''}`}
										>
											{perm}: {value}
										</span>
									))}
								</div>
								{override.reason && <p className={styles.overrideReason}>{override.reason}</p>}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Denied Events Section */}
			<div className={styles.section}>
				<div className={styles.sectionHeader}>
					<h3 className={styles.sectionTitle}>
						<DeniedIcon />
						Permission Denied Log
						{deniedEvents.length > 0 && <span className={styles.badge}>{deniedEvents.length}</span>}
					</h3>
					{deniedEvents.length > 0 && (
						<button className={styles.clearButton} onClick={handleClearDeniedEvents}>
							Clear
						</button>
					)}
				</div>
				<p className={styles.description}>Recent permission check failures.</p>

				{deniedEvents.length === 0 ? (
					<p className={styles.emptyState}>No denied events</p>
				) : (
					<div className={styles.eventsList}>
						{deniedEvents.slice(0, 10).map((event, i) => (
							<div key={i} className={styles.eventItem}>
								<span className={styles.eventTime}>{formatTime(event.timestamp)}</span>
								<span className={styles.eventMethod}>{event.method}</span>
								<span className={styles.eventPath}>{event.path}</span>
								<span className={styles.eventMissing}>
									{event.missing_permissions.join(', ')}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

// Icons
function ShieldIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z" />
		</svg>
	)
}

function OverrideIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z" />
			<path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z" />
		</svg>
	)
}

function DeniedIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}

function GrantIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
		</svg>
	)
}

function DenyIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}

function ClearIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1H2.5zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5zM8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5zm3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}
