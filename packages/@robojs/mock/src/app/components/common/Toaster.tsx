import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import styles from './Toaster.module.css'

export type ToastType = 'info' | 'success' | 'warning' | 'error'

interface Toast {
	id: string
	message: string
	type: ToastType
	duration: number
}

interface ToasterContextValue {
	showToast: (message: string, type?: ToastType, duration?: number) => void
}

const ToasterContext = createContext<ToasterContextValue | null>(null)

export function useToaster(): ToasterContextValue {
	const context = useContext(ToasterContext)
	if (!context) {
		throw new Error('useToaster must be used within a ToasterProvider')
	}
	return context
}

interface ToasterProviderProps {
	children: ReactNode
}

export function ToasterProvider({ children }: ToasterProviderProps) {
	const [toasts, setToasts] = useState<Toast[]>([])

	const showToast = useCallback((message: string, type: ToastType = 'info', duration = 5000) => {
		const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
		const toast: Toast = { id, message, type, duration }

		setToasts((prev) => [...prev, toast])

		// Auto-remove after duration
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id))
		}, duration)
	}, [])

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id))
	}, [])

	return (
		<ToasterContext.Provider value={{ showToast }}>
			{children}
			<div className={styles.container} role="region" aria-label="Notifications">
				{toasts.map((toast) => (
					<ToastItem key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
				))}
			</div>
		</ToasterContext.Provider>
	)
}

interface ToastItemProps {
	toast: Toast
	onDismiss: () => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
	return (
		<div
			className={`${styles.toast} ${styles[toast.type]}`}
			role="alert"
			aria-live="polite"
		>
			<div className={styles.icon}>
				<ToastIcon type={toast.type} />
			</div>
			<div className={styles.message}>{toast.message}</div>
			<button
				className={styles.dismiss}
				onClick={onDismiss}
				aria-label="Dismiss notification"
			>
				<CloseIcon />
			</button>
		</div>
	)
}

function ToastIcon({ type }: { type: ToastType }) {
	switch (type) {
		case 'success':
			return (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
				</svg>
			)
		case 'warning':
			return (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
				</svg>
			)
		case 'error':
			return (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
				</svg>
			)
		case 'info':
		default:
			return (
				<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
				</svg>
			)
	}
}

function CloseIcon() {
	return (
		<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
		</svg>
	)
}
