import type { CharacterId } from './character'

export type TeamId = CharacterId // Teams are 1:1 with characters

export interface TeamData {
	id: TeamId
	name: string
	color: string
	score: number
	members: string[] // odIds of players on this team
}

export interface TeamsState {
	teams: Record<TeamId, TeamData>
}

export interface SlowEffect {
	odId: string
	endTime: number
}

export interface GameState {
	teams: Record<TeamId, TeamData>
	slowEffects: Record<string, SlowEffect> // Players currently slowed
}
