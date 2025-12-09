import type { StageGuild } from '../../types/stage'
import styles from './ServerList.module.css'

interface ServerListProps {
	guilds: StageGuild[]
	selectedId: string | null
	onSelect: (id: string | null) => void
}

export function ServerList({ guilds, selectedId, onSelect }: ServerListProps) {
	return (
		<nav className={styles.container}>
			{/* Home/DM button */}
			<div className={styles.serverWrapper}>
				<div className={styles.pill} />
				<button className={styles.homeButton} title="Direct Messages">
					<DiscordLogo />
				</button>
			</div>

			<div className={styles.separator} />

			{/* Guild icons */}
			{guilds.map((guild) => (
				<div key={guild.id} className={`${styles.serverWrapper} ${selectedId === guild.id ? styles.selected : ''}`}>
					<div className={styles.pill} />
					<button className={styles.serverIcon} onClick={() => onSelect(guild.id)} title={guild.name}>
						{guild.icon ? (
							<img src={getGuildIconUrl(guild)} alt={guild.name} className={styles.iconImage} />
						) : (
							<span className={styles.serverAcronym}>{getGuildAcronym(guild.name)}</span>
						)}
					</button>
				</div>
			))}

			{/* Add server button */}
			<div className={styles.serverWrapper}>
				<div className={styles.pill} />
				<button className={`${styles.serverIcon} ${styles.addButton}`} title="Add a Server">
					<span className={styles.plus}>+</span>
				</button>
			</div>
		</nav>
	)
}

function DiscordLogo() {
	return (
		<svg width="28" height="20" viewBox="0 0 28 20" fill="currentColor">
			<path d="M23.0212 1.67671C21.3107 0.879656 19.5079 0.318797 17.6584 0C17.4062 0.461742 17.1749 0.934541 16.9708 1.4184C15.003 1.12145 12.9974 1.12145 11.0283 1.4184C10.8235 0.934541 10.5921 0.461742 10.3405 0C8.48663 0.321144 6.68094 0.882055 4.97028 1.67671C1.76356 6.0856 0.890861 10.3839 1.32645 14.6222C3.30085 16.0974 5.55094 17.2269 7.97572 17.9586C8.51377 17.2297 8.99325 16.4621 9.41021 15.6603C8.62773 15.3663 7.87269 15.0083 7.15294 14.5902C7.33988 14.4516 7.52289 14.3115 7.70096 14.1699C11.3908 15.9068 15.643 15.9068 19.2997 14.1699C19.4763 14.3115 19.6593 14.4516 19.8462 14.5902C19.1265 15.0083 18.3715 15.3663 17.589 15.6603C18.006 16.4621 18.4854 17.2297 19.0235 17.9586C21.4498 17.2269 23.6998 16.0974 25.6727 14.6222C26.1779 9.68439 24.7717 5.43147 23.0212 1.67671ZM9.68041 11.9983C8.38956 11.9983 7.32987 10.8157 7.32987 9.36775C7.32987 7.91979 8.35832 6.73579 9.68041 6.73579C11.0025 6.73579 12.0622 7.91979 12.0309 9.36775C12.0309 10.8157 10.9994 11.9983 9.68041 11.9983ZM18.3195 11.9983C17.0286 11.9983 15.9689 10.8157 15.9689 9.36775C15.9689 7.91979 16.9974 6.73579 18.3195 6.73579C19.6416 6.73579 20.7012 7.91979 20.6699 9.36775C20.6699 10.8157 19.6385 11.9983 18.3195 11.9983Z" />
		</svg>
	)
}

function getGuildAcronym(name: string): string {
	return name
		.split(/\s+/)
		.map((word) => word[0])
		.join('')
		.slice(0, 3)
		.toUpperCase()
}

function getGuildIconUrl(guild: StageGuild): string {
	// For mock server, icons might be URLs or base64
	if (guild.icon?.startsWith('http') || guild.icon?.startsWith('data:')) {
		return guild.icon
	}
	// Default Discord CDN format
	return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
}
