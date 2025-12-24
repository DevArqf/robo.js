/**
 * Browser build smoke test for @robojs/code SDK
 *
 * This test verifies that the SDK can be bundled for browser environments
 * without requiring Node.js built-in modules.
 */

import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Browser Build', () => {
	it('should not require Node built-ins', async () => {
		const result = await build({
			entryPoints: [path.resolve(__dirname, '../../src/index.ts')],
			bundle: true,
			platform: 'browser',
			write: false,
			// NodeProvider is for Node.js environments only, exclude from browser bundle
			external: ['robo.js', 'discord.js', './providers/node/*'],
			metafile: true,
			logLevel: 'silent'
		})

		// Node built-ins that should NOT be in a browser bundle
		const nodeBuiltins = [
			'fs',
			'path',
			'child_process',
			'os',
			'crypto',
			'http',
			'https',
			'net',
			'tls',
			'stream',
			'buffer',
			'util',
			'events',
			'zlib',
			'dns',
			'cluster',
			'worker_threads'
		]

		const inputs = Object.keys(result.metafile?.inputs || {})

		for (const builtin of nodeBuiltins) {
			const hasBuiltin = inputs.some((i) => i.includes(`node:${builtin}`) || i === builtin || i.endsWith(`/${builtin}`))
			expect(hasBuiltin).toBe(false)
		}
	})

	it('should produce valid output', async () => {
		const result = await build({
			entryPoints: [path.resolve(__dirname, '../../src/index.ts')],
			bundle: true,
			platform: 'browser',
			write: false,
			external: ['robo.js', 'discord.js', './providers/node/*'],
			logLevel: 'silent'
		})

		expect(result.outputFiles).toBeDefined()
		expect(result.outputFiles?.length).toBeGreaterThan(0)

		// Check that output is non-trivial
		const mainOutput = result.outputFiles?.[0]
		expect(mainOutput?.text.length).toBeGreaterThan(100)
	})

	it('should export expected types without runtime errors', async () => {
		const result = await build({
			entryPoints: [path.resolve(__dirname, '../../src/index.ts')],
			bundle: true,
			platform: 'browser',
			write: false,
			external: ['robo.js', 'discord.js', './providers/node/*'],
			logLevel: 'silent',
			format: 'esm'
		})

		const outputText = result.outputFiles?.[0]?.text || ''

		// Check that key exports are present in the bundle
		expect(outputText).toContain('CodeAgentError')
		expect(outputText).toContain('DEFAULT_POLICY')
		expect(outputText).toContain('DEFAULT_STREAM_OPTIONS')
	})

	it('should handle minification', async () => {
		const result = await build({
			entryPoints: [path.resolve(__dirname, '../../src/index.ts')],
			bundle: true,
			platform: 'browser',
			write: false,
			external: ['robo.js', 'discord.js', './providers/node/*'],
			logLevel: 'silent',
			minify: true
		})

		expect(result.outputFiles).toBeDefined()
		expect(result.outputFiles?.length).toBeGreaterThan(0)
	})

	it('should work with target ES2020', async () => {
		const result = await build({
			entryPoints: [path.resolve(__dirname, '../../src/index.ts')],
			bundle: true,
			platform: 'browser',
			write: false,
			external: ['robo.js', 'discord.js', './providers/node/*'],
			logLevel: 'silent',
			target: 'es2020'
		})

		expect(result.outputFiles).toBeDefined()
		expect(result.errors).toHaveLength(0)
	})
})
