interface Props {
	width?: number
	height?: number
	fill?: string
}

export default function GifIcon(props: Props) {
	const { width = 100, height = 100, fill = '#26e07f' } = props

	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			x="0px"
			y="0px"
			width={width}
			height={height}
			viewBox="0 0 172 172"
			fill={fill}
		>
			<g
				fill="none"
				fillRule="nonzero"
				stroke="none"
				strokeWidth="1"
				strokeLinecap="butt"
				strokeLinejoin="miter"
				strokeMiterlimit="10"
				strokeDasharray=""
				strokeDashoffset="0"
				fontFamily="none"
				fontWeight="none"
				fontSize="none"
				textAnchor="none"
				style={{ mixBlendMode: 'normal' }}
			>
				<path d="M0,172v-172h172v172z" fill="none"></path>
				<g fill="#1fb141">
					<path d="M21.5,21.5v129h64.5v-32.25v-64.5v-32.25zM86,53.75c0,17.7805 14.4695,32.25 32.25,32.25c17.7805,0 32.25,-14.4695 32.25,-32.25c0,-17.7805 -14.4695,-32.25 -32.25,-32.25c-17.7805,0 -32.25,14.4695 -32.25,32.25zM118.25,86c-17.7805,0 -32.25,14.4695 -32.25,32.25c0,17.7805 14.4695,32.25 32.25,32.25c17.7805,0 32.25,-14.4695 32.25,-32.25c0,-17.7805 -14.4695,-32.25 -32.25,-32.25z"></path>
				</g>
			</g>
		</svg>
	)
}
