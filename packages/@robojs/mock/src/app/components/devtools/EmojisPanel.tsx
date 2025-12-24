import { useCallback, useState, useEffect, useRef } from 'react'
import { useStageData } from '../../hooks/useStageData'
import { useToaster } from '../common/Toaster'
import styles from './EmojisPanel.module.css'

interface EmojiItem {
	id: string
	name: string
	animated: boolean
	guild_id: string
	available: boolean
}

interface GuildEmojis {
	guild_id: string
	guild_name: string
	emojis: EmojiItem[]
}

export function EmojisPanel() {
	const { sessionId, guilds } = useStageData()
	const { showToast } = useToaster()

	const [guildEmojis, setGuildEmojis] = useState<GuildEmojis[]>([])
	const [selectedGuildId, setSelectedGuildId] = useState<string | null>(null)
	const [isLoading, setIsLoading] = useState(false)

	// Create emoji form state
	const [newEmojiName, setNewEmojiName] = useState('')
	const [newEmojiImage, setNewEmojiImage] = useState<string | null>(null)
	const [isCreating, setIsCreating] = useState(false)
	const fileInputRef = useRef<HTMLInputElement>(null)

	// Detect API prefix from current URL
	const getApiPrefix = useCallback(() => {
		const pathname = window.location.pathname
		const stageIndex = pathname.indexOf('/stage')
		return stageIndex !== -1 ? pathname.slice(0, stageIndex) : ''
	}, [])

	// Fetch emojis for all guilds
	const fetchEmojis = useCallback(async () => {
		if (!sessionId) return

		setIsLoading(true)
		const apiPrefix = getApiPrefix()

		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/emojis`)
			if (response.ok) {
				const data = await response.json()
				setGuildEmojis(data.guilds || [])

				// Auto-select first guild if none selected
				if (!selectedGuildId && data.guilds?.length > 0) {
					setSelectedGuildId(data.guilds[0].guild_id)
				}
			}
		} catch {
			// Ignore errors
		} finally {
			setIsLoading(false)
		}
	}, [sessionId, getApiPrefix, selectedGuildId])

	// Fetch on mount
	useEffect(() => {
		fetchEmojis()
	}, [fetchEmojis])

	// Handle file selection
	const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Validate file type
		if (!file.type.startsWith('image/')) {
			showToast('Please select an image file', 'error')
			return
		}

		// Validate file size (256KB max for Discord emojis)
		if (file.size > 256 * 1024) {
			showToast('Image must be under 256KB', 'error')
			return
		}

		// Read as base64
		const reader = new FileReader()
		reader.onload = () => {
			setNewEmojiImage(reader.result as string)
		}
		reader.readAsDataURL(file)
	}, [showToast])

	// Create emoji
	const handleCreateEmoji = useCallback(async () => {
		if (!sessionId || !selectedGuildId || !newEmojiName || !newEmojiImage) return

		// Validate name
		if (!/^[a-zA-Z0-9_]+$/.test(newEmojiName)) {
			showToast('Name must be alphanumeric with underscores only', 'error')
			return
		}

		if (newEmojiName.length < 2 || newEmojiName.length > 32) {
			showToast('Name must be 2-32 characters', 'error')
			return
		}

		setIsCreating(true)
		const apiPrefix = getApiPrefix()

		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/emojis`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					guild_id: selectedGuildId,
					name: newEmojiName,
					image: newEmojiImage
				})
			})

			if (response.ok) {
				showToast(`Emoji :${newEmojiName}: created!`, 'success')
				setNewEmojiName('')
				setNewEmojiImage(null)
				if (fileInputRef.current) fileInputRef.current.value = ''
				fetchEmojis()
			} else {
				const error = await response.json().catch(() => ({}))
				showToast(error.message || 'Failed to create emoji', 'error')
			}
		} catch {
			showToast('Failed to create emoji', 'error')
		} finally {
			setIsCreating(false)
		}
	}, [sessionId, selectedGuildId, newEmojiName, newEmojiImage, getApiPrefix, showToast, fetchEmojis])

	// Delete emoji
	const handleDeleteEmoji = useCallback(async (emojiId: string, emojiName: string) => {
		if (!sessionId) return

		const apiPrefix = getApiPrefix()

		try {
			const response = await fetch(`${apiPrefix}/api/control/sessions/${sessionId}/emojis/${emojiId}`, {
				method: 'DELETE'
			})

			if (response.ok) {
				showToast(`Emoji :${emojiName}: deleted`, 'success')
				fetchEmojis()
			} else {
				showToast('Failed to delete emoji', 'error')
			}
		} catch {
			showToast('Failed to delete emoji', 'error')
		}
	}, [sessionId, getApiPrefix, showToast, fetchEmojis])

	// Get current guild's emojis
	const currentGuildEmojis = guildEmojis.find((g) => g.guild_id === selectedGuildId)

	return (
		<div className={styles.container}>
			{/* Guild Selector Section */}
			<div className={styles.section}>
				<h3 className={styles.sectionTitle}>
					<EmojiIcon />
					Guild Emojis
				</h3>
				<p className={styles.description}>
					Manage custom emojis for your guilds.
				</p>

				{guilds.length === 0 ? (
					<p className={styles.emptyState}>No guilds available</p>
				) : (
					<>
						<select
							className={styles.guildSelect}
							value={selectedGuildId || ''}
							onChange={(e) => setSelectedGuildId(e.target.value || null)}
						>
							<option value="">Select a guild...</option>
							{guilds.map((guild) => (
								<option key={guild.id} value={guild.id}>
									{guild.name}
								</option>
							))}
						</select>

						{isLoading && <p className={styles.loadingText}>Loading emojis...</p>}
					</>
				)}
			</div>

			{/* Emoji Grid Section */}
			{selectedGuildId && (
				<div className={styles.section}>
					<h3 className={styles.sectionTitle}>
						<GridIcon />
						Emojis
						{currentGuildEmojis && currentGuildEmojis.emojis.length > 0 && (
							<span className={styles.badge}>{currentGuildEmojis.emojis.length}</span>
						)}
					</h3>

					{!currentGuildEmojis || currentGuildEmojis.emojis.length === 0 ? (
						<p className={styles.emptyState}>No emojis in this guild</p>
					) : (
						<div className={styles.emojiGrid}>
							{currentGuildEmojis.emojis.map((emoji) => (
								<div key={emoji.id} className={styles.emojiItem}>
									<span className={styles.emojiPreview}>
										:{emoji.name}:
									</span>
									<span className={styles.emojiName}>{emoji.name}</span>
									<button
										className={styles.deleteButton}
										onClick={() => handleDeleteEmoji(emoji.id, emoji.name)}
										title="Delete emoji"
									>
										<CloseIcon />
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Create Emoji Section */}
			{selectedGuildId && (
				<div className={styles.section}>
					<h3 className={styles.sectionTitle}>
						<PlusIcon />
						Create Emoji
					</h3>
					<p className={styles.description}>
						Upload an image to create a new emoji.
					</p>

					<div className={styles.createForm}>
						<div className={styles.formGroup}>
							<label className={styles.label}>Name</label>
							<input
								type="text"
								className={styles.input}
								placeholder="emoji_name"
								value={newEmojiName}
								onChange={(e) => setNewEmojiName(e.target.value)}
								maxLength={32}
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.label}>Image</label>
							<div className={styles.imageUpload}>
								{newEmojiImage ? (
									<div className={styles.imagePreview}>
										<img src={newEmojiImage} alt="Preview" />
										<button
											className={styles.clearImage}
											onClick={() => {
												setNewEmojiImage(null)
												if (fileInputRef.current) fileInputRef.current.value = ''
											}}
										>
											<CloseIcon />
										</button>
									</div>
								) : (
									<button
										className={styles.uploadButton}
										onClick={() => fileInputRef.current?.click()}
									>
										<UploadIcon />
										Choose Image
									</button>
								)}
								<input
									ref={fileInputRef}
									type="file"
									accept="image/png,image/gif,image/jpeg"
									onChange={handleFileSelect}
									style={{ display: 'none' }}
								/>
							</div>
							<span className={styles.hint}>PNG, GIF, or JPEG. Max 256KB.</span>
						</div>

						<button
							className={styles.createButton}
							onClick={handleCreateEmoji}
							disabled={isCreating || !newEmojiName || !newEmojiImage}
						>
							{isCreating ? 'Creating...' : 'Create Emoji'}
						</button>
					</div>
				</div>
			)}
		</div>
	)
}

// Icons
function EmojiIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM7 6.5C7 7.328 6.552 8 6 8s-1-.672-1-1.5S5.448 5 6 5s1 .672 1 1.5zM4.285 9.567a.5.5 0 0 1 .683.183A3.498 3.498 0 0 0 8 11.5a3.498 3.498 0 0 0 3.032-1.75.5.5 0 1 1 .866.5A4.498 4.498 0 0 1 8 12.5a4.498 4.498 0 0 1-3.898-2.25.5.5 0 0 1 .183-.683zM10 8c-.552 0-1-.672-1-1.5S9.448 5 10 5s1 .672 1 1.5S10.552 8 10 8z" />
		</svg>
	)
}

function GridIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" />
		</svg>
	)
}

function PlusIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
		</svg>
	)
}

function UploadIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
			<path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
			<path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
		</svg>
	)
}

function CloseIcon() {
	return (
		<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
			<path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
		</svg>
	)
}
