import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

/**
 * Vite plugin that writes a signal file after build completes.
 * Used by @robojs/server to know when it's safe to reload the browser.
 */
function buildSignal() {
	return {
		name: 'robo-build-signal',
		closeBundle() {
			// Write signal file after all assets are written
			const signalPath = resolve(process.cwd(), 'public/stage/.build-signal')
			writeFileSync(signalPath, JSON.stringify({ timestamp: Date.now() }))
		}
	}
}

/**
 * Vite config for building the Stage UI.
 * Outputs to public/stage/ with relative base paths for portability.
 */
export default defineConfig({
	plugins: [react(), buildSignal()],
	base: './',
	publicDir: false, // Disable copying public/ to avoid conflict
	resolve: {
		alias: {
			'@': resolve(process.cwd(), 'src/app')
		}
	},
	build: {
		outDir: 'public/stage',
		emptyOutDir: true
	}
})
