/**
 * HMR Import Parser Tests
 *
 * Tests for the regex-based import parser used by the HMR dependency graph.
 */

import { describe, it, expect } from '@jest/globals'
import { parseImports, isRelativeSpecifier, getRelativeImports } from '../../src/cli/utils/hmr-import-parser.js'

describe('HMR Import Parser', () => {
	describe('isRelativeSpecifier', () => {
		it('returns true for ./ imports', () => {
			expect(isRelativeSpecifier('./utils/format.js')).toBe(true)
			expect(isRelativeSpecifier('./index.js')).toBe(true)
			expect(isRelativeSpecifier('./')).toBe(true)
		})

		it('returns true for ../ imports', () => {
			expect(isRelativeSpecifier('../utils/format.js')).toBe(true)
			expect(isRelativeSpecifier('../../lib/helpers.js')).toBe(true)
			expect(isRelativeSpecifier('../')).toBe(true)
		})

		it('returns false for node: built-ins', () => {
			expect(isRelativeSpecifier('node:fs')).toBe(false)
			expect(isRelativeSpecifier('node:path')).toBe(false)
			expect(isRelativeSpecifier('node:crypto')).toBe(false)
		})

		it('returns false for http:// imports', () => {
			expect(isRelativeSpecifier('http://example.com/module.js')).toBe(false)
		})

		it('returns false for https:// imports', () => {
			expect(isRelativeSpecifier('https://esm.sh/discord.js')).toBe(false)
			expect(isRelativeSpecifier('https://cdn.example.com/lib.js')).toBe(false)
		})

		it('returns false for @/ path aliases', () => {
			expect(isRelativeSpecifier('@/utils/format')).toBe(false)
			expect(isRelativeSpecifier('@/components/Button')).toBe(false)
		})

		it('returns false for ~/ path aliases', () => {
			expect(isRelativeSpecifier('~/utils/format')).toBe(false)
			expect(isRelativeSpecifier('~/lib/helpers')).toBe(false)
		})

		it('returns false for bare package specifiers', () => {
			expect(isRelativeSpecifier('discord.js')).toBe(false)
			expect(isRelativeSpecifier('robo.js')).toBe(false)
			expect(isRelativeSpecifier('lodash')).toBe(false)
			expect(isRelativeSpecifier('@robojs/server')).toBe(false)
		})

		it('returns false for absolute paths', () => {
			expect(isRelativeSpecifier('/absolute/path.js')).toBe(false)
		})
	})

	describe('parseImports - static imports', () => {
		it('extracts default imports', () => {
			const content = `import foo from './foo.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0]).toEqual({
				specifier: './foo.js',
				type: 'static',
				isRelative: true
			})
		})

		it('extracts named imports', () => {
			const content = `import { bar, baz } from './utils.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./utils.js')
		})

		it('extracts namespace imports', () => {
			const content = `import * as utils from '../lib/utils.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('../lib/utils.js')
		})

		it('extracts side-effect imports', () => {
			const content = `import './side-effect.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./side-effect.js')
		})

		it('extracts combined imports', () => {
			const content = `import foo, { bar } from './combined.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./combined.js')
		})

		it('handles double quotes', () => {
			const content = `import foo from "./foo.js"`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./foo.js')
		})

		it('extracts multiple imports', () => {
			const content = `
				import foo from './foo.js'
				import { bar } from './bar.js'
				import baz from '../baz.js'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(3)
			expect(result.imports.map((i) => i.specifier)).toEqual(['./foo.js', './bar.js', '../baz.js'])
		})

		it('deduplicates same specifier', () => {
			const content = `
				import foo from './utils.js'
				import { bar } from './utils.js'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./utils.js')
		})
	})

	describe('parseImports - re-exports', () => {
		it('extracts named re-exports', () => {
			const content = `export { foo, bar } from './source.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0]).toEqual({
				specifier: './source.js',
				type: 'static',
				isRelative: true
			})
		})

		it('extracts namespace re-exports', () => {
			const content = `export * from './all.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./all.js')
		})

		it('extracts renamed re-exports', () => {
			const content = `export { foo as bar } from './source.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./source.js')
		})
	})

	describe('parseImports - dynamic imports', () => {
		it('extracts dynamic imports with single quotes', () => {
			const content = `const mod = await import('./dynamic.js')`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0]).toEqual({
				specifier: './dynamic.js',
				type: 'dynamic',
				isRelative: true
			})
		})

		it('extracts dynamic imports with double quotes', () => {
			const content = `const mod = await import("./dynamic.js")`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./dynamic.js')
		})

		it('extracts dynamic imports without await', () => {
			const content = `import('./lazy.js').then(mod => console.log(mod))`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./lazy.js')
		})

		it('detects unresolved dynamic imports with variables', () => {
			const content = `const mod = await import(modulePath)`
			const result = parseImports(content)

			expect(result.hasUnresolvedDynamic).toBe(true)
			// Should not extract the variable as a specifier
			expect(result.imports.filter((i) => i.type === 'dynamic')).toHaveLength(0)
		})

		it('detects unresolved dynamic imports with expressions', () => {
			const content = `const mod = await import(\`./\${name}.js\`)`
			const result = parseImports(content)

			expect(result.hasUnresolvedDynamic).toBe(true)
		})

		it('handles mixed literal and variable dynamic imports', () => {
			const content = `
				const a = await import('./literal.js')
				const b = await import(variable)
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./literal.js')
			expect(result.hasUnresolvedDynamic).toBe(true)
		})
	})

	describe('parseImports - non-relative imports', () => {
		it('marks npm packages as non-relative', () => {
			const content = `
				import Discord from 'discord.js'
				import { Client } from '@robojs/server'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
			expect(result.imports.every((i) => i.isRelative === false)).toBe(true)
		})

		it('marks node: imports as non-relative', () => {
			const content = `
				import fs from 'node:fs'
				import path from 'node:path'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
			expect(result.imports.every((i) => i.isRelative === false)).toBe(true)
		})

		it('marks https:// imports as non-relative', () => {
			const content = `import { foo } from 'https://esm.sh/some-package'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].isRelative).toBe(false)
		})

		it('marks path aliases as non-relative', () => {
			const content = `
				import foo from '@/utils/format'
				import bar from '~/lib/helpers'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
			expect(result.imports.every((i) => i.isRelative === false)).toBe(true)
		})
	})

	describe('parseImports - edge cases', () => {
		it('handles empty content', () => {
			const result = parseImports('')

			expect(result.imports).toHaveLength(0)
			expect(result.hasUnresolvedDynamic).toBe(false)
		})

		it('handles content with no imports', () => {
			const content = `
				const foo = 'bar'
				console.log(foo)
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(0)
		})

		it('ignores import-like strings in comments', () => {
			// Note: Simple regex can't fully handle this, but it shouldn't cause errors
			const content = `
				// import foo from './commented.js'
				import bar from './real.js'
			`
			const result = parseImports(content)

			// May include the commented import - this is a known limitation
			// The important thing is we get the real import
			expect(result.imports.some((i) => i.specifier === './real.js')).toBe(true)
		})

		it('handles multiline imports', () => {
			const content = `
				import {
					foo,
					bar,
					baz
				} from './multiline.js'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0].specifier).toBe('./multiline.js')
		})

		it('handles imports with type annotations (TypeScript)', () => {
			const content = `import type { Foo } from './types.js'`
			const result = parseImports(content)

			// Type imports may or may not be captured depending on TS compilation
			// In build output, type-only imports are typically erased
			// Just ensure no errors
			expect(result).toBeDefined()
		})

		it('handles semicolon-separated imports on same line', () => {
			const content = `import a from './a.js'; import b from './b.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
		})

		it('handles imports immediately after multi-line comment closing', () => {
			// Build tools may place imports on the same line as comment end
			const content = `/**
 * Module description
 */ import { foo } from "./local.js";
export function bar() { return foo() }
`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(1)
			expect(result.imports[0]).toEqual({
				specifier: './local.js',
				type: 'static',
				isRelative: true
			})
		})

		it('handles multiple imports after comment closings', () => {
			// Real build output often has comments followed by imports on same line
			const content = `/* Comment 1 */ import a from './a.js'
/* Comment 2 */ import b from './b.js'`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
			expect(result.imports.map((i) => i.specifier)).toEqual(['./a.js', './b.js'])
		})
	})

	describe('getRelativeImports', () => {
		it('filters to only relative imports', () => {
			// Use parseImports to get a properly typed result, then modify it
			const result = parseImports(`
				import a from './local.js'
				import b from 'discord.js'
			`)
			// Add more imports manually for the test
			result.imports.push(
				{ specifier: '../parent.js', type: 'dynamic', isRelative: true },
				{ specifier: 'node:fs', type: 'static', isRelative: false }
			)

			const relative = getRelativeImports(result)

			expect(relative).toHaveLength(2)
			expect(relative.map((i) => i.specifier)).toContain('./local.js')
			expect(relative.map((i) => i.specifier)).toContain('../parent.js')
		})

		it('returns empty array when no relative imports', () => {
			const result = parseImports(`
				import foo from 'discord.js'
				import fs from 'node:fs'
			`)

			const relative = getRelativeImports(result)

			expect(relative).toHaveLength(0)
		})
	})

	describe('real-world patterns', () => {
		it('parses typical handler file', () => {
			const content = `
				import { logger } from 'robo.js'
				import { formatMessage } from './utils/format.js'
				import { db } from '../lib/database.js'

				export default async (interaction) => {
					const message = formatMessage(interaction.content)
					await db.save(message)
					logger.info('Saved message')
				}
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(3)

			const relative = getRelativeImports(result)
			expect(relative).toHaveLength(2)
			expect(relative.map((i) => i.specifier)).toEqual(['./utils/format.js', '../lib/database.js'])
		})

		it('parses utility file with re-exports', () => {
			const content = `
				export { formatDate, formatNumber } from './formatters.js'
				export * from './helpers.js'
				export { default as config } from '../config.js'
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(3)
			expect(result.imports.every((i) => i.isRelative)).toBe(true)
		})

		it('parses file with lazy loading', () => {
			const content = `
				import { logger } from 'robo.js'

				export default async (interaction) => {
					if (interaction.options.get('advanced')) {
						const { processAdvanced } = await import('./advanced-handler.js')
						return processAdvanced(interaction)
					}
					return 'Simple response'
				}
			`
			const result = parseImports(content)

			expect(result.imports).toHaveLength(2)
			expect(result.hasUnresolvedDynamic).toBe(false)

			const dynamicImports = result.imports.filter((i) => i.type === 'dynamic')
			expect(dynamicImports).toHaveLength(1)
			expect(dynamicImports[0].specifier).toBe('./advanced-handler.js')
		})
	})
})
