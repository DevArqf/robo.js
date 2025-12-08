import './MainMenu.css'

interface MainMenuProps {
	onPlay: () => void
}

export function MainMenu({ onPlay }: MainMenuProps) {
	const l = ['play', 'settings', 'about']
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
									border: 'none',
									width: '200px',
									color: 'white',
									height: '50px',
									fontSize: '24px'
								}}
							>
								{item}
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
								border: 'none',
								width: '200px',
								color: 'white',
								height: '50px',
								fontSize: '24px',
								display: 'flex',
								justifyContent: 'center',
								lineHeight: '1.3'
							}}
						>
							{item}
						</button>
					)
				})}
			</div>
		</div>
	)
}
