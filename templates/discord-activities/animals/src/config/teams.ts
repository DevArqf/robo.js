import type { TeamData, TeamId } from '../types/team'

export const TEAM_CONFIG: Record<TeamId, Omit<TeamData, 'score' | 'members'>> = {
	weasel: {
		id: 'weasel',
		name: 'Team Weasel',
		color: '#8B4513' // Brown
	},
	cat: {
		id: 'cat',
		name: 'Team Cat',
		color: '#FF6B6B' // Coral/Pink
	},
	dog: {
		id: 'dog',
		name: 'Team Dog',
		color: '#4ECDC4' // Teal
	},
	redpanda: {
		id: 'redpanda',
		name: 'Team Red Panda',
		color: '#FF8C42' // Orange
	}
}

export function createInitialTeams(): Record<TeamId, TeamData> {
	return {
		weasel: { ...TEAM_CONFIG.weasel, score: 0, members: [] },
		cat: { ...TEAM_CONFIG.cat, score: 0, members: [] },
		dog: { ...TEAM_CONFIG.dog, score: 0, members: [] },
		redpanda: { ...TEAM_CONFIG.redpanda, score: 0, members: [] }
	}
}
