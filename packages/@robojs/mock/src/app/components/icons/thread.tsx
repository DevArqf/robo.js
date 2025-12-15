interface Props {
	width?: number
	height?: number
	fill?: string
}

export default function ThreadIcon(props: Props) {
	const { width = 24, height = 24, fill = 'currentColor' } = props

	return (
		<svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5.43309 21C5.35842 21 5.30189 20.9325 5.31494 20.859L5.99999 17H3.10938C2.49362 17 1.99999 16.5064 1.99999 15.8906V4.10938C1.99999 3.49362 2.49362 3 3.10938 3H20.8906C21.5064 3 22 3.49362 22 4.10938V15.8906C22 16.5064 21.5064 17 20.8906 17H11L5.60845 20.9039C5.55814 20.9406 5.49621 20.96 5.43309 21Z"
				fill={fill}
			/>
			<path
				d="M12.5 6.5C12.5 6.22386 12.2761 6 12 6C11.7239 6 11.5 6.22386 11.5 6.5V8.5H9.5C9.22386 8.5 9 8.72386 9 9C9 9.27614 9.22386 9.5 9.5 9.5H11.5V13.5C11.5 14.0523 11.9477 14.5 12.5 14.5H14.5C14.7761 14.5 15 14.2761 15 14C15 13.7239 14.7761 13.5 14.5 13.5H12.5V9.5H14.5C14.7761 9.5 15 9.27614 15 9C15 8.72386 14.7761 8.5 14.5 8.5H12.5V6.5Z"
				fill={fill === 'currentColor' ? '#36393f' : '#1a1b1e'}
			/>
		</svg>
	)
}
