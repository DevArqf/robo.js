import './MainMenu.css'

interface MainMenuProps {
	onPlay: () => void
}

export function MainMenu({ onPlay }: MainMenuProps) {
	const l = ['play', 'settings', 'about']
	const buttonHeight = '75px'

	const buttonStyle = {
		border: 'none',
		width: '200px',
		color: 'white',
		height: buttonHeight,
		fontSize: '16px',
		fontFamily: "'Press Start 2P', 'Silkscreen', monospace",
		display: 'flex',
		justifyContent: 'center',
		lineHeight: '2'
	}

	return (
		<div className="main-menu">
			{/* Background */}
			<div className="menu-background" />

			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				<img
					src="/menu/menu-title.png"
					alt="Logo"
					style={{
						margin: '2em'
					}}
				/>

				{l.map((item, index) => {
					if (index === l.length - 1) {
						return (
							<button
								key={index}
								style={{
									background: 'url("/menu/menu-button.png") center / 100% 100% no-repeat',
									...buttonStyle
								}}
							>
								<div style={{ display: 'flex', height: buttonHeight, alignItems: 'center' }}>
									<span>{item}</span>
								</div>
							</button>
						)
					}

					return (
						<button
							key={index}
							onClick={() => {
								if (item === 'play') {
									onPlay()
								}
							}}
							style={{
								background: 'url("/menu/menu_item_link.png") center / 100% 100% no-repeat',
								...buttonStyle
							}}
						>
							<div style={{ display: 'flex', height: `calc(${buttonHeight} - 25px)`, alignItems: 'center' }}>
								<span>{item}</span>
							</div>
						</button>
					)
				})}
			</div>
		</div>
	)
}
