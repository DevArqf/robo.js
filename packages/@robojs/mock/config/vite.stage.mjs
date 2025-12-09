import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

/**
 * Vite config for building the Stage UI.
 * Outputs to public/stage/ with relative base paths for portability.
 */
export default defineConfig({
	plugins: [react()],
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
