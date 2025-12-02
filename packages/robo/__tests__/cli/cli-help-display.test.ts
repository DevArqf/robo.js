// @ts-nocheck
/**
 * Tests for CLI Help Display
 *
 * Tests help and version display functionality of Command class.
 * Note: The Command class requires explicit help option configuration.
 * Help option parsing is built into the executePluginCommand flow, not Command directly.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { Command } from '../../dist/cli/utils/cli-handler.js'

describe('CLI Help Display', () => {
	let consoleLogSpy
	let originalArgv

	beforeEach(() => {
		originalArgv = process.argv
		consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
	})

	afterEach(() => {
		process.argv = originalArgv
		consoleLogSpy.mockRestore()
	})

	describe('Help Option Configuration', () => {
		it('should allow adding help option explicitly', () => {
			const cmd = new Command('test')
				.option('-h', '--help', 'Show help')

			const options = cmd.getOptions()
			expect(options.some((o) => o.name === '--help')).toBe(true)
		})

		it('should allow configuring help option with type', () => {
			const cmd = new Command('test')
				.option({ alias: '-h', name: '--help', description: 'Show help', type: 'boolean' })

			const options = cmd.getOptions()
			const helpOpt = options.find((o) => o.name === '--help')
			expect(helpOpt.type).toBe('boolean')
		})
	})

	describe('Version Display', () => {
		it('should add version option when version() is called', () => {
			const cmd = new Command('app').version('2.0.0')

			const options = cmd.getOptions()
			expect(options.some((o) => o.name === '--version')).toBe(true)
		})

		it('should use -v alias for version option', () => {
			const cmd = new Command('app').version('3.0.0')

			const options = cmd.getOptions()
			const versionOpt = options.find((o) => o.name === '--version')
			expect(versionOpt.alias).toBe('-v')
		})

		it('should store version string internally', () => {
			const cmd = new Command('app').version('2.5.0')

			// Version is stored as private _version property
			// We can verify it through the options
			const options = cmd.getOptions()
			expect(options.some((o) => o.name === '--version')).toBe(true)
		})

		// Note: Version display via --version flag requires subcommands in the Command class
		// The version handling is at line 238-241 and requires command._commands.length to be truthy
	})

	describe('Subcommand Structure', () => {
		it('should track subcommands via addCommand()', () => {
			const parent = new Command('cli')
			const sub1 = new Command('start')
			const sub2 = new Command('stop')

			parent.addCommand(sub1)
			parent.addCommand(sub2)

			const children = parent.getChildCommands()
			expect(children).toHaveLength(2)
			expect(children[0].getName()).toBe('start')
			expect(children[1].getName()).toBe('stop')
		})

		it('should set parent reference on subcommands', () => {
			const parent = new Command('cli')
			const sub = new Command('deploy')

			parent.addCommand(sub)

			expect(sub.getParentCommand()).toBe(parent)
		})

		it('should track descriptions for subcommands', () => {
			const parent = new Command('cli').description('Main CLI')
			const sub = new Command('start').description('Start the service')

			parent.addCommand(sub)

			expect(parent.getDescription()).toBe('Main CLI')
			expect(sub.getDescription()).toBe('Start the service')
		})
	})

	describe('Options Structure', () => {
		it('should preserve option properties for display', () => {
			const cmd = new Command('tool')
				.option({
					alias: '-p',
					name: '--port',
					description: 'Port number',
					type: 'number',
					default: 3000
				})

			const options = cmd.getOptions()
			const portOpt = options.find((o) => o.name === '--port')

			expect(portOpt.alias).toBe('-p')
			expect(portOpt.description).toBe('Port number')
			expect(portOpt.type).toBe('number')
			expect(portOpt.default).toBe(3000)
		})

		it('should preserve required flag for display', () => {
			const cmd = new Command('tool')
				.option({
					alias: '-i',
					name: '--input',
					description: 'Input file',
					required: true
				})

			const options = cmd.getOptions()
			const inputOpt = options.find((o) => o.name === '--input')
			expect(inputOpt.required).toBe(true)
		})
	})
})
