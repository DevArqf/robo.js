import { useState } from 'react'
import { CharacterCard } from './CharacterCard'
import { CHARACTER_LIST, DEFAULT_CHARACTER } from '../config/characters'
import type { CharacterId } from '../types/character'
import './CharacterSelect.css'

interface CharacterSelectProps {
	onStart: (characterId: CharacterId) => void
}

export function CharacterSelect({ onStart }: CharacterSelectProps) {
	const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>(DEFAULT_CHARACTER)

	const handleStart = () => {
		onStart(selectedCharacter)
	}

	return (
		<div className="character-select">
			{/* Background */}
			<div className="character-select-bg" />

			{/* Content */}
			<div className="character-select-content">
				<div className="character-select-header">
					<h1 className="pixel-title">SELECT CHARACTER</h1>
				</div>

				<div className="character-grid">
					{CHARACTER_LIST.map((character) => (
						<CharacterCard
							key={character.id}
							character={character}
							isSelected={selectedCharacter === character.id}
							onSelect={() => setSelectedCharacter(character.id)}
						/>
					))}
				</div>

				<div className="character-select-footer">
					<button className="pixel-button start" onClick={handleStart} disabled={!selectedCharacter}>
						START
					</button>
				</div>
			</div>
		</div>
	)
}
