import { useState, useEffect, useRef } from 'react'
import type { CharacterConfig } from '../types/character'
import './CharacterCard.css'

interface CharacterCardProps {
	character: CharacterConfig
	isSelected: boolean
	onSelect: () => void
}

export function CharacterCard({ character, isSelected, onSelect }: CharacterCardProps) {
	const [isHovered, setIsHovered] = useState(false)
	const [frameIndex, setFrameIndex] = useState(0)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const imageRef = useRef<HTMLImageElement | null>(null)

	// Get walk spritesheet config for preview
	const walkSheet = character.spritesheets.walk

	// Load spritesheet image
	useEffect(() => {
		const img = new Image()
		img.src = character.preview + '?v=' + Date.now()
		img.onload = () => {
			imageRef.current = img
		}
	}, [character.preview])

	// Animate sprite when hovered or selected
	useEffect(() => {
		if (!isHovered && !isSelected) {
			setFrameIndex(0)
			return
		}

		const interval = setInterval(() => {
			setFrameIndex((prev) => (prev + 1) % walkSheet.totalFrames)
		}, 50) // ~20fps for preview

		return () => clearInterval(interval)
	}, [isHovered, isSelected, walkSheet.totalFrames])

	// Draw current frame to canvas
	useEffect(() => {
		const canvas = canvasRef.current
		const img = imageRef.current
		if (!canvas || !img) return

		const ctx = canvas.getContext('2d')
		if (!ctx) return

		const frameWidth = img.width / walkSheet.columns
		const frameHeight = img.height / walkSheet.rows

		const col = frameIndex % walkSheet.columns
		const row = Math.floor(frameIndex / walkSheet.columns)

		ctx.imageSmoothingEnabled = false
		ctx.clearRect(0, 0, canvas.width, canvas.height)
		ctx.drawImage(img, col * frameWidth, row * frameHeight, frameWidth, frameHeight, 0, 0, canvas.width, canvas.height)
	}, [frameIndex, walkSheet.columns, walkSheet.rows])

	return (
		<div
			className={`character-card ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''} ${!character.unlocked ? 'locked' : ''}`}
			onClick={character.unlocked ? onSelect : undefined}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className="character-card-inner">
				<div className="character-sprite-container">
					<canvas ref={canvasRef} width={72} height={72} className="character-sprite" />
					{!character.unlocked && <div className="lock-overlay">🔒</div>}
				</div>

				<div className="character-info">
					<h3 className="character-name">{character.name}</h3>
					<p className="character-description">{character.description}</p>
				</div>

				{isSelected && <div className="selected-indicator">▶</div>}
			</div>

			<div className="card-border" />
			<div className="card-glow" />
		</div>
	)
}
