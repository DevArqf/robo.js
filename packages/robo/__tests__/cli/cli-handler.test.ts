// @ts-nocheck
/**
 * Tests for CLI Handler - Command Class
 *
 * Tests the Command class used for CLI parsing and execution.
 * This is the foundation for both robo.js core CLI and @robojs/cli plugin.
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals'
import { Command } from '../../dist/cli/utils/cli-handler.js'

// Mock process.argv for parsing tests
const originalArgv = process.argv

afterEach(() => {
	process.argv = originalArgv
})

describe('Command Class', () => {
	describe('Construction and Basic Properties', () => {
		it('should create a command with the given name', () => {
			const cmd = new Command('test-cli')
			expect(cmd.getName()).toBe('test-cli')
		})

		it('should have empty description by default', () => {
			const cmd = new Command('test')
			expect(cmd.getDescription()).toBeUndefined()
		})

		it('should have empty options by default', () => {
			const cmd = new Command('test')
			expect(cmd.getOptions()).toEqual([])
		})

		it('should have no child commands by default', () => {
			const cmd = new Command('test')
			expect(cmd.getChildCommands()).toEqual([])
		})

		it('should have no parent by default', () => {
			const cmd = new Command('test')
			expect(cmd.getParentCommand()).toBeUndefined()
		})
	})

	describe('Fluent API - Method Chaining', () => {
		it('should return this for description()', () => {
			const cmd = new Command('test')
			const result = cmd.description('A test command')
			expect(result).toBe(cmd)
		})

		it('should return this for option() with 3 params', () => {
			const cmd = new Command('test')
			const result = cmd.option('-t', '--test', 'Test option')
			expect(result).toBe(cmd)
		})

		it('should return this for option() with object', () => {
			const cmd = new Command('test')
			const result = cmd.option({ alias: '-t', name: '--test', description: 'Test option' })
			expect(result).toBe(cmd)
		})

		it('should return this for handler()', () => {
			const cmd = new Command('test')
			const result = cmd.handler(() => {})
			expect(result).toBe(cmd)
		})

		it('should return this for version()', () => {
			const cmd = new Command('test')
			const result = cmd.version('1.0.0')
			expect(result).toBe(cmd)
		})

		it('should return this for addCommand()', () => {
			const parent = new Command('parent')
			const child = new Command('child')
			const result = parent.addCommand(child)
			expect(result).toBe(parent)
		})

		it('should return this for positionalArgs()', () => {
			const cmd = new Command('test')
			const result = cmd.positionalArgs(true)
			expect(result).toBe(cmd)
		})

		it('should return this for allowSpacesInOptions()', () => {
			const cmd = new Command('test')
			const result = cmd.allowSpacesInOptions(true)
			expect(result).toBe(cmd)
		})

		it('should return this for onUnknownCommand()', () => {
			const cmd = new Command('test')
			const result = cmd.onUnknownCommand(() => false)
			expect(result).toBe(cmd)
		})

		it('should support full method chaining', () => {
			const handler = jest.fn()
			const cmd = new Command('test')
				.description('Test command')
				.version('1.0.0')
				.option('-v', '--verbose', 'Verbose output')
				.option({ alias: '-d', name: '--debug', description: 'Debug mode', type: 'boolean' })
				.positionalArgs(true)
				.handler(handler)

			expect(cmd.getName()).toBe('test')
			expect(cmd.getDescription()).toBe('Test command')
			expect(cmd.getOptions()).toHaveLength(3) // -v, -d, and --version from version()
		})
	})

	describe('Description', () => {
		it('should set and get description', () => {
			const cmd = new Command('test')
			cmd.description('This is a test command')
			expect(cmd.getDescription()).toBe('This is a test command')
		})

		it('should allow updating description', () => {
			const cmd = new Command('test')
			cmd.description('First description')
			cmd.description('Second description')
			expect(cmd.getDescription()).toBe('Second description')
		})
	})

	describe('Options - 3 Parameter Form', () => {
		it('should add option with alias, name, and description', () => {
			const cmd = new Command('test')
			cmd.option('-v', '--verbose', 'Enable verbose output')

			const options = cmd.getOptions()
			expect(options).toHaveLength(1)
			expect(options[0]).toEqual({
				alias: '-v',
				name: '--verbose',
				description: 'Enable verbose output'
			})
		})

		it('should add multiple options', () => {
			const cmd = new Command('test')
			cmd.option('-v', '--verbose', 'Verbose')
			cmd.option('-d', '--debug', 'Debug')
			cmd.option('-q', '--quiet', 'Quiet')

			expect(cmd.getOptions()).toHaveLength(3)
		})
	})

	describe('Options - Object Form', () => {
		it('should add option with full CliOptionConfig object', () => {
			const cmd = new Command('test')
			cmd.option({
				alias: '-p',
				name: '--port',
				description: 'Server port',
				type: 'number',
				default: 3000
			})

			const options = cmd.getOptions()
			expect(options).toHaveLength(1)
			expect(options[0]).toEqual({
				alias: '-p',
				name: '--port',
				description: 'Server port',
				type: 'number',
				default: 3000
			})
		})

		it('should preserve type property', () => {
			const cmd = new Command('test')
			cmd.option({ alias: '-n', name: '--count', description: 'Count', type: 'number' })

			const options = cmd.getOptions()
			expect(options[0].type).toBe('number')
		})

		it('should preserve default property', () => {
			const cmd = new Command('test')
			cmd.option({ alias: '-h', name: '--host', description: 'Host', type: 'string', default: 'localhost' })

			const options = cmd.getOptions()
			expect(options[0].default).toBe('localhost')
		})

		it('should preserve required property', () => {
			const cmd = new Command('test')
			cmd.option({ alias: '-i', name: '--input', description: 'Input file', required: true })

			const options = cmd.getOptions()
			expect(options[0].required).toBe(true)
		})
	})

	describe('Version', () => {
		it('should add version option automatically', () => {
			const cmd = new Command('test')
			cmd.version('2.0.0')

			const options = cmd.getOptions()
			expect(options).toHaveLength(1)
			expect(options[0].alias).toBe('-v')
			expect(options[0].name).toBe('--version')
		})
	})

	describe('Subcommands', () => {
		it('should add subcommand', () => {
			const parent = new Command('parent')
			const child = new Command('child')
			parent.addCommand(child)

			expect(parent.getChildCommands()).toHaveLength(1)
			expect(parent.getChildCommands()[0]).toBe(child)
		})

		it('should set parent reference on subcommand', () => {
			const parent = new Command('parent')
			const child = new Command('child')
			parent.addCommand(child)

			expect(child.getParentCommand()).toBe(parent)
		})

		it('should support multiple subcommands', () => {
			const parent = new Command('parent')
			const child1 = new Command('child1')
			const child2 = new Command('child2')
			const child3 = new Command('child3')

			parent.addCommand(child1)
			parent.addCommand(child2)
			parent.addCommand(child3)

			expect(parent.getChildCommands()).toHaveLength(3)
		})

		it('should support nested subcommands', () => {
			const root = new Command('root')
			const level1 = new Command('level1')
			const level2 = new Command('level2')

			root.addCommand(level1)
			level1.addCommand(level2)

			expect(root.getChildCommands()).toContain(level1)
			expect(level1.getChildCommands()).toContain(level2)
			expect(level2.getParentCommand()).toBe(level1)
			expect(level1.getParentCommand()).toBe(root)
		})
	})

	describe('Handler Execution', () => {
		it('should call handler with context when command is parsed', async () => {
			const handler = jest.fn()
			const cmd = new Command('test')
			cmd.handler(handler)

			process.argv = ['node', 'test']
			cmd.parse()

			// Handler is called asynchronously
			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).toHaveBeenCalled()
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					args: expect.any(Array),
					options: expect.any(Object),
					logger: expect.any(Object),
					cwd: expect.any(String),
					argv: expect.any(Array)
				})
			)
		})

		it('should pass parsed options to handler', async () => {
			const handler = jest.fn()
			const cmd = new Command('test')
			cmd.option('-n', '--name', 'Name')
			cmd.handler(handler)

			process.argv = ['node', 'test', '--name', 'John']
			cmd.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						name: 'John'
					})
				})
			)
		})

		it('should pass positional args to handler when enabled', async () => {
			const handler = jest.fn()
			const cmd = new Command('test')
			cmd.positionalArgs(true)
			cmd.handler(handler)

			process.argv = ['node', 'test', 'arg1', 'arg2', 'arg3']
			cmd.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					args: ['arg1', 'arg2', 'arg3']
				})
			)
		})

		it('should call subcommand handler', async () => {
			const parentHandler = jest.fn()
			const childHandler = jest.fn()

			const parent = new Command('parent')
			parent.handler(parentHandler)

			const child = new Command('child')
			child.handler(childHandler)

			parent.addCommand(child)

			process.argv = ['node', 'parent', 'child']
			parent.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(childHandler).toHaveBeenCalled()
			expect(parentHandler).not.toHaveBeenCalled()
		})
	})

	describe('Unknown Command Handler', () => {
		it('should call onUnknownCommand when command not found', async () => {
			const unknownHandler = jest.fn().mockReturnValue(true)
			const cmd = new Command('test')
			cmd.onUnknownCommand(unknownHandler)

			process.argv = ['node', 'test', 'unknown']
			cmd.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(unknownHandler).toHaveBeenCalledWith(['unknown'], [])
		})

		it('should not call onUnknownCommand when command is found', async () => {
			const unknownHandler = jest.fn()
			const childHandler = jest.fn()

			const parent = new Command('parent')
			parent.onUnknownCommand(unknownHandler)

			const child = new Command('known')
			child.handler(childHandler)
			parent.addCommand(child)

			process.argv = ['node', 'parent', 'known']
			parent.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(unknownHandler).not.toHaveBeenCalled()
			expect(childHandler).toHaveBeenCalled()
		})
	})

	describe('Complex Scenarios', () => {
		it('should handle deeply nested commands with options', async () => {
			const deepHandler = jest.fn()

			const root = new Command('cli')
			const service = new Command('service')
			const db = new Command('db')
			const connect = new Command('connect')

			connect.option('-h', '--host', 'Database host')
			connect.option('-p', '--port', 'Database port')
			connect.handler(deepHandler)

			db.addCommand(connect)
			service.addCommand(db)
			root.addCommand(service)

			process.argv = ['node', 'cli', 'service', 'db', 'connect', '--host', 'localhost', '--port', '5432']
			root.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(deepHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					options: expect.objectContaining({
						host: 'localhost',
						port: '5432'
					})
				})
			)
		})

		it('should handle mixed positional args and options', async () => {
			const handler = jest.fn()
			const cmd = new Command('test')
			cmd.positionalArgs(true)
			cmd.option('-v', '--verbose', 'Verbose')
			cmd.handler(handler)

			process.argv = ['node', 'test', 'file1.txt', 'file2.txt', '--verbose']
			cmd.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					args: ['file1.txt', 'file2.txt'],
					options: expect.objectContaining({
						verbose: true
					})
				})
			)
		})

		it('should handle subcommand with its own positional args', async () => {
			const handler = jest.fn()

			const root = new Command('cli')
			const echo = new Command('echo')
			echo.positionalArgs(true)
			echo.handler(handler)
			root.addCommand(echo)

			process.argv = ['node', 'cli', 'echo', 'hello', 'world']
			root.parse()

			await new Promise((resolve) => setTimeout(resolve, 10))

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					args: ['hello', 'world']
				})
			)
		})
	})
})
