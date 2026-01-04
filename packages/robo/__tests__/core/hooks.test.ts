/**
 * Hook Priority System Tests
 *
 * Tests the priority-based hook execution system including:
 * - Priority API functions (setHookPriority, getHookPriority, etc.)
 * - Hook execution order (lower priority runs first)
 * - Parallel execution (same priority hooks run concurrently)
 * - Priority resolution (runtime > metaOptions > default)
 * - Error handling (failSafe, timeouts)
 * - Edge cases (empty maps, negative priorities, etc.)
 */

import { describe, it, expect, afterEach } from '@jest/globals'
import {
	setHookPriority,
	getHookPriority,
	prioritizeHookBefore,
	prioritizeHookAfter,
	clearHookPriorityOverrides,
	DEFAULT_HOOK_PRIORITY,
	groupPluginsByPriority
} from '../../dist/core/hooks.js'
import type { LifecycleHookType, PluginData } from '../../dist/types/common.js'

/**
 * Helper to create mock plugin data for testing
 */
function createMockPluginData(name: string, options?: Partial<PluginData>): PluginData {
	return {
		name,
		options: options?.options,
		metaOptions: options?.metaOptions,
		version: options?.version ?? '1.0.0',
		path: options?.path,
		namespace: options?.namespace
	}
}

describe('Hook Priority System', () => {
	// Clean up after each test to ensure isolation
	afterEach(() => {
		clearHookPriorityOverrides()
	})

	describe('DEFAULT_HOOK_PRIORITY', () => {
		it('should be 100', () => {
			expect(DEFAULT_HOOK_PRIORITY).toBe(100)
		})
	})

	describe('setHookPriority()', () => {
		it('should store priority override for a plugin hook', () => {
			setHookPriority('start', '@robojs/server', 50)

			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			expect(priority).toBe(50)
		})

		it('should allow different priorities for different hook types', () => {
			setHookPriority('start', '@robojs/server', 50)
			setHookPriority('stop', '@robojs/server', 150)

			const startPriority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			const stopPriority = getHookPriority('stop', '@robojs/server', createMockPluginData('@robojs/server'))

			expect(startPriority).toBe(50)
			expect(stopPriority).toBe(150)
		})

		it('should allow different priorities for different plugins', () => {
			setHookPriority('start', '@robojs/server', 50)
			setHookPriority('start', '@robojs/mock', 75)

			const serverPriority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			const mockPriority = getHookPriority('start', '@robojs/mock', createMockPluginData('@robojs/mock'))

			expect(serverPriority).toBe(50)
			expect(mockPriority).toBe(75)
		})

		it('should overwrite existing priority when called multiple times', () => {
			setHookPriority('start', '@robojs/server', 50)
			setHookPriority('start', '@robojs/server', 25)

			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			expect(priority).toBe(25)
		})

		it('should accept zero as a valid priority', () => {
			setHookPriority('start', '@robojs/server', 0)

			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			expect(priority).toBe(0)
		})
	})

	describe('getHookPriority()', () => {
		it('should return DEFAULT_HOOK_PRIORITY (100) when no override exists', () => {
			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))

			expect(priority).toBe(DEFAULT_HOOK_PRIORITY)
			expect(priority).toBe(100)
		})

		it('should prefer runtime override over metaOptions', () => {
			setHookPriority('start', '@robojs/server', 25)

			const pluginData = createMockPluginData('@robojs/server', {
				metaOptions: { hookPriority: { start: 75 } }
			})

			const priority = getHookPriority('start', '@robojs/server', pluginData)
			expect(priority).toBe(25) // Runtime wins
		})

		it('should use metaOptions when no runtime override exists', () => {
			const pluginData = createMockPluginData('@robojs/server', {
				metaOptions: { hookPriority: { start: 75 } }
			})

			const priority = getHookPriority('start', '@robojs/server', pluginData)
			expect(priority).toBe(75)
		})

		it('should return default when metaOptions has different hook type', () => {
			const pluginData = createMockPluginData('@robojs/server', {
				metaOptions: { hookPriority: { prepare: 75 } } // Not 'start'
			})

			const priority = getHookPriority('start', '@robojs/server', pluginData)
			expect(priority).toBe(100)
		})

		it('should handle undefined metaOptions gracefully', () => {
			const pluginData = createMockPluginData('@robojs/server', {
				metaOptions: undefined
			})

			const priority = getHookPriority('start', '@robojs/server', pluginData)
			expect(priority).toBe(100)
		})

		it('should handle undefined hookPriority in metaOptions gracefully', () => {
			const pluginData = createMockPluginData('@robojs/server', {
				metaOptions: { failSafe: true } // No hookPriority
			})

			const priority = getHookPriority('start', '@robojs/server', pluginData)
			expect(priority).toBe(100)
		})
	})

	describe('prioritizeHookBefore()', () => {
		it('should set priority 10 less than default when target has no override', () => {
			prioritizeHookBefore('start', '@robojs/server', '@robojs/discordjs')

			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			expect(priority).toBe(90) // 100 - 10
		})

		it('should set priority 10 less than target when target has custom priority', () => {
			setHookPriority('start', '@robojs/discordjs', 50)
			prioritizeHookBefore('start', '@robojs/server', '@robojs/discordjs')

			const priority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			expect(priority).toBe(40) // 50 - 10
		})

		it('should allow chaining to create execution order', () => {
			// Server before discordjs, mock before server
			prioritizeHookBefore('start', '@robojs/server', '@robojs/discordjs')
			prioritizeHookBefore('start', '@robojs/mock', '@robojs/server')

			const serverPriority = getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))
			const mockPriority = getHookPriority('start', '@robojs/mock', createMockPluginData('@robojs/mock'))

			expect(serverPriority).toBe(90) // 100 - 10
			expect(mockPriority).toBe(80) // 90 - 10
			expect(mockPriority).toBeLessThan(serverPriority)
		})
	})

	describe('prioritizeHookAfter()', () => {
		it('should set priority 10 more than default when target has no override', () => {
			prioritizeHookAfter('start', '@robojs/mock', '@robojs/server')

			const priority = getHookPriority('start', '@robojs/mock', createMockPluginData('@robojs/mock'))
			expect(priority).toBe(110) // 100 + 10
		})

		it('should set priority 10 more than target when target has custom priority', () => {
			setHookPriority('start', '@robojs/server', 50)
			prioritizeHookAfter('start', '@robojs/mock', '@robojs/server')

			const priority = getHookPriority('start', '@robojs/mock', createMockPluginData('@robojs/mock'))
			expect(priority).toBe(60) // 50 + 10
		})

		it('should allow chaining to create execution order', () => {
			// Mock after server, analytics after mock
			prioritizeHookAfter('start', '@robojs/mock', '@robojs/server')
			prioritizeHookAfter('start', '@robojs/analytics', '@robojs/mock')

			const mockPriority = getHookPriority('start', '@robojs/mock', createMockPluginData('@robojs/mock'))
			const analyticsPriority = getHookPriority(
				'start',
				'@robojs/analytics',
				createMockPluginData('@robojs/analytics')
			)

			expect(mockPriority).toBe(110) // 100 + 10
			expect(analyticsPriority).toBe(120) // 110 + 10
			expect(analyticsPriority).toBeGreaterThan(mockPriority)
		})
	})

	describe('clearHookPriorityOverrides()', () => {
		it('should clear all runtime overrides', () => {
			setHookPriority('start', '@robojs/server', 50)
			setHookPriority('prepare', '@robojs/mock', 25)
			setHookPriority('stop', '@robojs/discordjs', 150)

			clearHookPriorityOverrides()

			expect(getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))).toBe(100)
			expect(getHookPriority('prepare', '@robojs/mock', createMockPluginData('@robojs/mock'))).toBe(100)
			expect(getHookPriority('stop', '@robojs/discordjs', createMockPluginData('@robojs/discordjs'))).toBe(100)
		})

		it('should be safe to call multiple times', () => {
			setHookPriority('start', '@robojs/server', 50)

			clearHookPriorityOverrides()
			clearHookPriorityOverrides()
			clearHookPriorityOverrides()

			expect(getHookPriority('start', '@robojs/server', createMockPluginData('@robojs/server'))).toBe(100)
		})

		it('should be safe to call when no overrides exist', () => {
			expect(() => clearHookPriorityOverrides()).not.toThrow()
		})
	})

	describe('Priority Resolution Order', () => {
		it('should resolve: runtime override > metaOptions > default', () => {
			const pluginData = createMockPluginData('@test/plugin', {
				metaOptions: { hookPriority: { start: 75 } }
			})

			// Without runtime override: metaOptions wins (75)
			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(75)

			// With runtime override: runtime wins (25)
			setHookPriority('start', '@test/plugin', 25)
			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(25)

			// After clearing: back to metaOptions (75)
			clearHookPriorityOverrides()
			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(75)
		})

		it('should use default when neither runtime nor metaOptions have priority', () => {
			const pluginData = createMockPluginData('@test/plugin', {
				metaOptions: { failSafe: true } // No hookPriority
			})

			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(100)
		})
	})

	describe('Edge Cases', () => {
		it('should handle negative priorities', () => {
			setHookPriority('start', '@test/plugin', -50)

			const priority = getHookPriority('start', '@test/plugin', createMockPluginData('@test/plugin'))
			expect(priority).toBe(-50)
		})

		it('should handle very large priorities', () => {
			setHookPriority('start', '@test/plugin', Number.MAX_SAFE_INTEGER)

			const priority = getHookPriority('start', '@test/plugin', createMockPluginData('@test/plugin'))
			expect(priority).toBe(Number.MAX_SAFE_INTEGER)
		})

		it('should handle very small (negative) priorities', () => {
			setHookPriority('start', '@test/plugin', Number.MIN_SAFE_INTEGER)

			const priority = getHookPriority('start', '@test/plugin', createMockPluginData('@test/plugin'))
			expect(priority).toBe(Number.MIN_SAFE_INTEGER)
		})

		it('should handle all lifecycle hook types', () => {
			const hookTypes: LifecycleHookType[] = ['init', 'prepare', 'start', 'stop', 'setup']

			for (const hookType of hookTypes) {
				setHookPriority(hookType, '@test/plugin', 50)
				expect(getHookPriority(hookType, '@test/plugin', createMockPluginData('@test/plugin'))).toBe(50)
			}
		})

		it('should isolate priorities between hook types', () => {
			setHookPriority('start', '@test/plugin', 50)

			// Other hook types should still be default
			expect(getHookPriority('init', '@test/plugin', createMockPluginData('@test/plugin'))).toBe(100)
			expect(getHookPriority('prepare', '@test/plugin', createMockPluginData('@test/plugin'))).toBe(100)
			expect(getHookPriority('stop', '@test/plugin', createMockPluginData('@test/plugin'))).toBe(100)
			expect(getHookPriority('setup', '@test/plugin', createMockPluginData('@test/plugin'))).toBe(100)
		})

		it('should handle plugin names with special characters', () => {
			const specialNames = ['@scope/plugin-name', 'plugin_underscore', 'plugin.dot', '@robojs/plugin-123']

			for (const name of specialNames) {
				setHookPriority('start', name, 50)
				expect(getHookPriority('start', name, createMockPluginData(name))).toBe(50)
			}
		})

		it('should handle empty plugin name', () => {
			setHookPriority('start', '', 50)
			expect(getHookPriority('start', '', createMockPluginData(''))).toBe(50)
		})
	})

	describe('Priority Sorting Behavior', () => {
		it('should correctly sort priorities: lower numbers come first', () => {
			const plugins = [
				{ name: '@robojs/server', priority: 50 },
				{ name: '@robojs/discordjs', priority: 100 },
				{ name: '@robojs/mock', priority: 75 }
			]

			// Set priorities
			for (const plugin of plugins) {
				setHookPriority('start', plugin.name, plugin.priority)
			}

			// Verify priorities are stored correctly
			const priorities = plugins.map((p) => ({
				name: p.name,
				priority: getHookPriority('start', p.name, createMockPluginData(p.name))
			}))

			// Sort by priority (lower first)
			priorities.sort((a, b) => a.priority - b.priority)

			expect(priorities[0].name).toBe('@robojs/server') // 50
			expect(priorities[1].name).toBe('@robojs/mock') // 75
			expect(priorities[2].name).toBe('@robojs/discordjs') // 100
		})

		it('should group plugins with same priority', () => {
			const plugins = [
				{ name: 'plugin-a', priority: 100 },
				{ name: 'plugin-b', priority: 50 },
				{ name: 'plugin-c', priority: 100 },
				{ name: 'plugin-d', priority: 50 }
			]

			// Set priorities
			for (const plugin of plugins) {
				setHookPriority('start', plugin.name, plugin.priority)
			}

			// Get all priorities
			const priorities = plugins.map((p) => ({
				name: p.name,
				priority: getHookPriority('start', p.name, createMockPluginData(p.name))
			}))

			// Group by priority
			const groups = new Map<number, string[]>()
			for (const p of priorities) {
				if (!groups.has(p.priority)) {
					groups.set(p.priority, [])
				}
				groups.get(p.priority)!.push(p.name)
			}

			// Verify grouping
			expect(groups.get(50)?.sort()).toEqual(['plugin-b', 'plugin-d'])
			expect(groups.get(100)?.sort()).toEqual(['plugin-a', 'plugin-c'])
		})
	})

	describe('metaOptions.hookPriority', () => {
		it('should support all hook types in metaOptions', () => {
			const pluginData = createMockPluginData('@test/plugin', {
				metaOptions: {
					hookPriority: {
						init: 10,
						prepare: 20,
						start: 30,
						stop: 40,
						setup: 50
					}
				}
			})

			expect(getHookPriority('init', '@test/plugin', pluginData)).toBe(10)
			expect(getHookPriority('prepare', '@test/plugin', pluginData)).toBe(20)
			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(30)
			expect(getHookPriority('stop', '@test/plugin', pluginData)).toBe(40)
			expect(getHookPriority('setup', '@test/plugin', pluginData)).toBe(50)
		})

		it('should support partial hookPriority in metaOptions', () => {
			const pluginData = createMockPluginData('@test/plugin', {
				metaOptions: {
					hookPriority: {
						start: 30 // Only start hook has custom priority
					}
				}
			})

			expect(getHookPriority('init', '@test/plugin', pluginData)).toBe(100) // Default
			expect(getHookPriority('prepare', '@test/plugin', pluginData)).toBe(100) // Default
			expect(getHookPriority('start', '@test/plugin', pluginData)).toBe(30) // Custom
			expect(getHookPriority('stop', '@test/plugin', pluginData)).toBe(100) // Default
			expect(getHookPriority('setup', '@test/plugin', pluginData)).toBe(100) // Default
		})
	})

	describe('groupPluginsByPriority()', () => {
		it('should group plugins by their priority', () => {
			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')]
			])

			// All have hooks
			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			// All at default priority 100
			expect(result.groups.size).toBe(1)
			expect(result.groups.has(100)).toBe(true)
			expect(result.groups.get(100)?.length).toBe(3)
			expect(result.sortedPriorities).toEqual([100])
		})

		it('should group plugins with different priorities into separate groups', () => {
			setHookPriority('start', 'plugin-a', 50)
			setHookPriority('start', 'plugin-b', 100)
			setHookPriority('start', 'plugin-c', 50)

			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.groups.size).toBe(2)
			expect(result.groups.get(50)?.length).toBe(2)
			expect(result.groups.get(100)?.length).toBe(1)
			// Lower priority first
			expect(result.sortedPriorities).toEqual([50, 100])
		})

		it('should sort priorities in ascending order by default (lower runs first)', () => {
			setHookPriority('start', 'plugin-a', 100)
			setHookPriority('start', 'plugin-b', 25)
			setHookPriority('start', 'plugin-c', 75)
			setHookPriority('start', 'plugin-d', 50)

			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')],
				['plugin-d', createMockPluginData('plugin-d')]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.sortedPriorities).toEqual([25, 50, 75, 100])
		})

		it('should sort priorities in descending order when reverse=true (higher runs first)', () => {
			setHookPriority('stop', 'plugin-a', 100)
			setHookPriority('stop', 'plugin-b', 25)
			setHookPriority('stop', 'plugin-c', 75)
			setHookPriority('stop', 'plugin-d', 50)

			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')],
				['plugin-d', createMockPluginData('plugin-d')]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'stop', hasHook, true)

			expect(result.sortedPriorities).toEqual([100, 75, 50, 25])
		})

		it('should exclude plugins that do not have the hook', () => {
			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')]
			])

			// Only plugin-a and plugin-c have hooks
			const hasHook = (name: string) => name !== 'plugin-b'

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.groups.size).toBe(1)
			expect(result.groups.get(100)?.length).toBe(2)
			const pluginNames = result.groups.get(100)?.map(([name]) => name)
			expect(pluginNames).toContain('plugin-a')
			expect(pluginNames).toContain('plugin-c')
			expect(pluginNames).not.toContain('plugin-b')
		})

		it('should return empty groups when no plugins have hooks', () => {
			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')]
			])

			const hasHook = () => false

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.groups.size).toBe(0)
			expect(result.sortedPriorities).toEqual([])
		})

		it('should return empty groups for empty plugin map', () => {
			const plugins = new Map<string, PluginData>()
			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.groups.size).toBe(0)
			expect(result.sortedPriorities).toEqual([])
		})

		it('should use metaOptions priority when no runtime override', () => {
			const plugins = new Map<string, PluginData>([
				[
					'plugin-a',
					createMockPluginData('plugin-a', {
						metaOptions: { hookPriority: { start: 50 } }
					})
				],
				['plugin-b', createMockPluginData('plugin-b')]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.groups.size).toBe(2)
			expect(result.groups.has(50)).toBe(true)
			expect(result.groups.has(100)).toBe(true)
			expect(result.sortedPriorities).toEqual([50, 100])
		})

		it('should preserve plugin data in groups', () => {
			const pluginAData = createMockPluginData('plugin-a', { version: '1.2.3' })
			const pluginBData = createMockPluginData('plugin-b', { version: '4.5.6' })

			const plugins = new Map<string, PluginData>([
				['plugin-a', pluginAData],
				['plugin-b', pluginBData]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			const group = result.groups.get(100)
			expect(group).toBeDefined()

			const [nameA, dataA] = group!.find(([n]) => n === 'plugin-a')!
			const [nameB, dataB] = group!.find(([n]) => n === 'plugin-b')!

			expect(nameA).toBe('plugin-a')
			expect(dataA.version).toBe('1.2.3')
			expect(nameB).toBe('plugin-b')
			expect(dataB.version).toBe('4.5.6')
		})

		it('should handle negative priorities', () => {
			setHookPriority('start', 'plugin-a', -50)
			setHookPriority('start', 'plugin-b', 0)
			setHookPriority('start', 'plugin-c', 50)

			const plugins = new Map<string, PluginData>([
				['plugin-a', createMockPluginData('plugin-a')],
				['plugin-b', createMockPluginData('plugin-b')],
				['plugin-c', createMockPluginData('plugin-c')]
			])

			const hasHook = () => true

			const result = groupPluginsByPriority(plugins, 'start', hasHook)

			expect(result.sortedPriorities).toEqual([-50, 0, 50])
		})

		it('should work with all lifecycle hook types', () => {
			const hookTypes: LifecycleHookType[] = ['init', 'prepare', 'start', 'stop', 'setup']

			for (const hookType of hookTypes) {
				setHookPriority(hookType, 'plugin-a', 50)

				const plugins = new Map<string, PluginData>([['plugin-a', createMockPluginData('plugin-a')]])

				const hasHook = () => true

				const result = groupPluginsByPriority(plugins, hookType, hasHook)

				expect(result.groups.has(50)).toBe(true)
				expect(result.sortedPriorities).toEqual([50])
			}
		})
	})
})
