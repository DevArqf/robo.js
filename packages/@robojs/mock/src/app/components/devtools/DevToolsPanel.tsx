import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react'
import { EventLog } from './EventLog'
import { StateViewer } from './StateViewer'
import { NetworkLog } from './NetworkLog'
import { PerformanceMetrics } from './PerformanceMetrics'
import { ToolsPanel } from './ToolsPanel'
import styles from './DevToolsPanel.module.css'

type Tab = 'events' | 'state' | 'network' | 'performance' | 'tools'

const STORAGE_KEY = 'stage_devtools_open'

// Context for external control of DevTools
interface DevToolsContextValue {
	isOpen: boolean
	toggle: () => void
	open: () => void
	close: () => void
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null)

export function useDevTools(): DevToolsContextValue {
	const context = useContext(DevToolsContext)
	if (!context) {
		throw new Error('useDevTools must be used within a DevToolsProvider')
	}
	return context
}

interface DevToolsProviderProps {
	children: ReactNode
}

export function DevToolsProvider({ children }: DevToolsProviderProps) {
	const [isOpen, setIsOpen] = useState(() => {
		const stored = localStorage.getItem(STORAGE_KEY)
		return stored === 'true'
	})

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, String(isOpen))
	}, [isOpen])

	const toggle = useCallback(() => setIsOpen((o) => !o), [])
	const open = useCallback(() => setIsOpen(true), [])
	const close = useCallback(() => setIsOpen(false), [])

	return (
		<DevToolsContext.Provider value={{ isOpen, toggle, open, close }}>
			{children}
		</DevToolsContext.Provider>
	)
}

export function DevToolsPanel() {
	const { isOpen, toggle } = useDevTools()
	const [activeTab, setActiveTab] = useState<Tab>('events')

	// Keyboard shortcut: Ctrl/Cmd + Shift + D
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
				e.preventDefault()
				toggle()
			}
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [toggle])

	// Collapsed state - no floating button, controlled via PlaybackControls
	if (!isOpen) {
		return null
	}

	return (
		<div className={styles.panel}>
			{/* Header with tabs */}
			<div className={styles.header}>
				<div className={styles.tabs}>
					<button
						className={`${styles.tab} ${activeTab === 'events' ? styles.active : ''}`}
						onClick={() => setActiveTab('events')}
					>
						<EventsIcon />
						Events
					</button>
					<button
						className={`${styles.tab} ${activeTab === 'state' ? styles.active : ''}`}
						onClick={() => setActiveTab('state')}
					>
						<StateIcon />
						State
					</button>
					<button
						className={`${styles.tab} ${activeTab === 'network' ? styles.active : ''}`}
						onClick={() => setActiveTab('network')}
					>
						<NetworkIcon />
						Network
					</button>
					<button
						className={`${styles.tab} ${activeTab === 'performance' ? styles.active : ''}`}
						onClick={() => setActiveTab('performance')}
					>
						<MetricsIcon />
						Performance
					</button>
					<button
						className={`${styles.tab} ${activeTab === 'tools' ? styles.active : ''}`}
						onClick={() => setActiveTab('tools')}
					>
						<ToolsIcon />
						Tools
					</button>
				</div>

				<button className={styles.closeButton} onClick={toggle} title="Close Dev Tools">
					<CloseIcon />
				</button>
			</div>

			{/* Tab content */}
			<div className={styles.content}>
				{activeTab === 'events' && <EventLog />}
				{activeTab === 'state' && <StateViewer />}
				{activeTab === 'network' && <NetworkLog />}
				{activeTab === 'performance' && <PerformanceMetrics />}
				{activeTab === 'tools' && <ToolsPanel />}
			</div>
		</div>
	)
}

// Icons
function EventsIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM3 4v1h10V4H3zm0 3v1h10V7H3zm0 3v1h5v-1H3z" />
		</svg>
	)
}

function StateIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
			<path d="M5 3h6v1H5V3zm0 3h6v1H5V6zm0 3h4v1H5V9z" />
		</svg>
	)
}

function MetricsIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4 11H2v3h2v-3zm5-4H7v7h2V7zm5-5h-2v12h2V2z" />
		</svg>
	)
}

function ToolsIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M5 0v1h1v5.2L2 14v1h12v-1l-4-7.8V1h1V0H5zm2 1h2v5.4l3.5 6.6h-9L7 6.4V1z" />
		</svg>
	)
}

function NetworkIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-3.5a6.959 6.959 0 0 0-.656-2.5H12.18c.174.782.282 1.623.312 2.5h2.49zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}
