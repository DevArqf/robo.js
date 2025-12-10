import type { TeamId, TeamData } from '../types/team'
import { TEAM_CONFIG } from '../config/teams'
import styles from './Scoreboard.module.css'

interface ScoreboardProps {
	teams: Record<TeamId, TeamData>
	currentTeam?: TeamId
}

export function Scoreboard({ teams, currentTeam }: ScoreboardProps) {
	// Sort teams by score (highest first)
	const sortedTeams = Object.values(teams).sort((a, b) => b.score - a.score)

	return (
		<div className={styles.scoreboard}>
			<div className={styles.title}>Scores</div>
			<div className={styles.teams}>
				{sortedTeams.map((team, index) => (
					<div
						key={team.id}
						className={`${styles.team} ${team.id === currentTeam ? styles.currentTeam : ''}`}
						style={{ '--team-color': TEAM_CONFIG[team.id].color } as React.CSSProperties}
					>
						<span className={styles.rank}>#{index + 1}</span>
						<span className={styles.name}>{team.name.replace('Team ', '')}</span>
						<span className={styles.score}>{team.score}</span>
						<span className={styles.members}>({team.members.length})</span>
					</div>
				))}
			</div>
		</div>
	)
}
