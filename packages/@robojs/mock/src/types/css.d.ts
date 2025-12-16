// Type declarations for CSS imports (used by the mock app UI).
declare module '*.module.css' {
	const classes: { [key: string]: string }
	export default classes
}

declare module '*.css' {
	const content: { [key: string]: string }
	export default content
}


