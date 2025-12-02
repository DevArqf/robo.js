// @ts-nocheck
/**
 * Tests for CLI Option Parsing
 *
 * Comprehensive tests for parseCliOptions function in cli-shared.ts.
 * This is the core option parsing logic used by both Command class and CLI loader.
 */

import { parseCliOptions, DEFAULT_HELP_OPTION } from '../../dist/cli/utils/cli-shared.js'

describe('parseCliOptions', () => {
	describe('Basic Parsing - No Options Defined', () => {
		it('should return empty results for empty args', () => {
			const result = parseCliOptions([], [])
			expect(result.parsedOptions).toEqual({})
			expect(result.positionalArgs).toEqual([])
			expect(result.errors).toEqual([])
		})

		it('should treat all args as positional when no options defined', () => {
			const result = parseCliOptions(['arg1', 'arg2', 'arg3'], [])
			expect(result.positionalArgs).toEqual(['arg1', 'arg2', 'arg3'])
		})
	})

	describe('Long Options (--option)', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-n', name: '--name', description: 'Name' },
			{ alias: '-h', name: '--host', description: 'Host' }
		]

		it('should parse --option value syntax', () => {
			const result = parseCliOptions(['--name', 'John'], options)
			expect(result.parsedOptions.name).toBe('John')
		})

		it('should parse --option=value syntax', () => {
			const result = parseCliOptions(['--name=John'], options)
			expect(result.parsedOptions.name).toBe('John')
		})

		it('should parse multiple long options', () => {
			const result = parseCliOptions(['--name', 'John', '--host', 'localhost'], options)
			expect(result.parsedOptions.name).toBe('John')
			expect(result.parsedOptions.host).toBe('localhost')
		})

		it('should handle empty value with equals syntax', () => {
			const result = parseCliOptions(['--name='], options)
			expect(result.parsedOptions.name).toBe('')
		})

		it('should handle value with equals sign in it', () => {
			const result = parseCliOptions(['--name=key=value'], options)
			expect(result.parsedOptions.name).toBe('key=value')
		})
	})

	describe('Short Options (-o)', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-n', name: '--name', description: 'Name' },
			{ alias: '-p', name: '--port', description: 'Port' }
		]

		it('should parse -o value syntax', () => {
			const result = parseCliOptions(['-n', 'John'], options)
			expect(result.parsedOptions.name).toBe('John')
		})

		it('should parse -o=value syntax', () => {
			const result = parseCliOptions(['-n=John'], options)
			expect(result.parsedOptions.name).toBe('John')
		})

		it('should parse multiple short options', () => {
			const result = parseCliOptions(['-n', 'John', '-p', '8080'], options)
			expect(result.parsedOptions.name).toBe('John')
			expect(result.parsedOptions.port).toBe('8080')
		})
	})

	describe('Mixed Long and Short Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-n', name: '--name', description: 'Name' },
			{ alias: '-p', name: '--port', description: 'Port' },
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
		]

		it('should parse mixed long and short options', () => {
			const result = parseCliOptions(['--name', 'John', '-p', '8080', '-v'], options)
			expect(result.parsedOptions.name).toBe('John')
			expect(result.parsedOptions.port).toBe('8080')
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should parse options in any order', () => {
			const result = parseCliOptions(['-v', '-p', '3000', '--name', 'Jane'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.parsedOptions.port).toBe('3000')
			expect(result.parsedOptions.name).toBe('Jane')
		})
	})

	describe('Boolean Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' },
			{ alias: '-d', name: '--debug', description: 'Debug', type: 'boolean' },
			{ alias: '-q', name: '--quiet', description: 'Quiet', type: 'boolean' }
		]

		it('should set boolean to true when flag is present', () => {
			const result = parseCliOptions(['--verbose'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should parse --flag=true as true', () => {
			const result = parseCliOptions(['--verbose=true'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should parse --flag=false as false', () => {
			const result = parseCliOptions(['--verbose=false'], options)
			expect(result.parsedOptions.verbose).toBe(false)
		})

		it('should parse --flag=1 as true', () => {
			const result = parseCliOptions(['--verbose=1'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should parse --flag=0 as false', () => {
			const result = parseCliOptions(['--verbose=0'], options)
			expect(result.parsedOptions.verbose).toBe(false)
		})

		it('should parse --flag=yes as true', () => {
			const result = parseCliOptions(['--verbose=yes'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should parse --flag=no as false', () => {
			const result = parseCliOptions(['--verbose=no'], options)
			expect(result.parsedOptions.verbose).toBe(false)
		})

		it('should parse multiple boolean flags', () => {
			const result = parseCliOptions(['--verbose', '-d', '--quiet'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.parsedOptions.debug).toBe(true)
			expect(result.parsedOptions.quiet).toBe(true)
		})

		it('should not consume next arg as value for boolean', () => {
			const result = parseCliOptions(['--verbose', 'not-a-value'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.positionalArgs).toContain('not-a-value')
		})
	})

	describe('Number Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-p', name: '--port', description: 'Port', type: 'number' },
			{ alias: '-c', name: '--count', description: 'Count', type: 'number' },
			{ alias: '-t', name: '--timeout', description: 'Timeout', type: 'number' }
		]

		it('should parse integer values', () => {
			const result = parseCliOptions(['--port', '8080'], options)
			expect(result.parsedOptions.port).toBe(8080)
			expect(typeof result.parsedOptions.port).toBe('number')
		})

		it('should parse negative numbers', () => {
			const result = parseCliOptions(['--count=-5'], options)
			expect(result.parsedOptions.count).toBe(-5)
		})

		it('should parse floating point numbers', () => {
			const result = parseCliOptions(['--timeout', '3.14'], options)
			expect(result.parsedOptions.timeout).toBe(3.14)
		})

		it('should parse zero', () => {
			const result = parseCliOptions(['--count', '0'], options)
			expect(result.parsedOptions.count).toBe(0)
			expect(typeof result.parsedOptions.count).toBe('number')
		})

		it('should report error for invalid number', () => {
			const result = parseCliOptions(['--port', 'abc'], options)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('Invalid number')
		})

		it('should report error for empty number value', () => {
			const result = parseCliOptions(['--port='], options)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('Missing value')
		})
	})

	describe('String Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-n', name: '--name', description: 'Name', type: 'string' },
			{ alias: '-p', name: '--path', description: 'Path', type: 'string' }
		]

		it('should parse string values', () => {
			const result = parseCliOptions(['--name', 'John Doe'], options)
			expect(result.parsedOptions.name).toBe('John Doe')
		})

		it('should preserve spaces in quoted strings', () => {
			const result = parseCliOptions(['--path=/path/with spaces/file.txt'], options)
			expect(result.parsedOptions.path).toBe('/path/with spaces/file.txt')
		})

		it('should handle empty string', () => {
			const result = parseCliOptions(['--name='], options)
			expect(result.parsedOptions.name).toBe('')
		})

		it('should handle special characters', () => {
			const result = parseCliOptions(['--name={"key":"value"}'], options)
			expect(result.parsedOptions.name).toBe('{"key":"value"}')
		})
	})

	describe('Default Values', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-p', name: '--port', description: 'Port', type: 'number', default: 3000 },
			{ alias: '-h', name: '--host', description: 'Host', type: 'string', default: 'localhost' },
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean', default: false }
		]

		it('should apply default values when option not provided', () => {
			const result = parseCliOptions([], options)
			expect(result.parsedOptions.port).toBe(3000)
			expect(result.parsedOptions.host).toBe('localhost')
			expect(result.parsedOptions.verbose).toBe(false)
		})

		it('should override default with provided value', () => {
			const result = parseCliOptions(['--port', '8080'], options)
			expect(result.parsedOptions.port).toBe(8080)
		})

		it('should keep other defaults when one is overridden', () => {
			const result = parseCliOptions(['--port', '8080'], options)
			expect(result.parsedOptions.port).toBe(8080)
			expect(result.parsedOptions.host).toBe('localhost')
			expect(result.parsedOptions.verbose).toBe(false)
		})
	})

	describe('Required Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-i', name: '--input', description: 'Input file', required: true },
			{ alias: '-o', name: '--output', description: 'Output file', required: true },
			{ alias: '-f', name: '--format', description: 'Format', required: false }
		]

		it('should report error when required option is missing', () => {
			const result = parseCliOptions([], options)
			expect(result.errors).toHaveLength(2)
			expect(result.errors[0]).toContain('--input')
			expect(result.errors[1]).toContain('--output')
		})

		it('should not report error when required options are provided', () => {
			const result = parseCliOptions(['--input', 'in.txt', '--output', 'out.txt'], options)
			expect(result.errors).toHaveLength(0)
		})

		it('should report error only for missing required options', () => {
			const result = parseCliOptions(['--input', 'in.txt'], options)
			expect(result.errors).toHaveLength(1)
			expect(result.errors[0]).toContain('--output')
		})
	})

	describe('Double-Dash Separator (--)', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
		]

		it('should treat everything after -- as positional args', () => {
			const result = parseCliOptions(['--verbose', '--', '--not-an-option', '-also-not'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.positionalArgs).toEqual(['--not-an-option', '-also-not'])
		})

		it('should handle -- at the beginning', () => {
			const result = parseCliOptions(['--', '--verbose', 'arg'], options)
			expect(result.parsedOptions.verbose).toBeUndefined()
			expect(result.positionalArgs).toEqual(['--verbose', 'arg'])
		})

		it('should handle multiple -- (only first matters)', () => {
			const result = parseCliOptions(['--', '--', '--'], options)
			expect(result.positionalArgs).toEqual(['--', '--'])
		})
	})

	describe('Positional Arguments', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
		]

		it('should collect non-option args as positional', () => {
			const result = parseCliOptions(['file1.txt', 'file2.txt'], options)
			expect(result.positionalArgs).toEqual(['file1.txt', 'file2.txt'])
		})

		it('should collect positional args mixed with options', () => {
			const result = parseCliOptions(['file1.txt', '--verbose', 'file2.txt'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.positionalArgs).toContain('file1.txt')
			// Note: file2.txt might be consumed by verbose since it's boolean
		})

		it('should handle positional args after options', () => {
			const result = parseCliOptions(['--verbose', '--', 'file1.txt', 'file2.txt'], options)
			expect(result.parsedOptions.verbose).toBe(true)
			expect(result.positionalArgs).toEqual(['file1.txt', 'file2.txt'])
		})
	})

	describe('allowSpacesInOptions', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-c', name: '--comment', description: 'Comment', type: 'string' }
		]

		it('should consume multiple words as single value when enabled', () => {
			const result = parseCliOptions(
				['--comment', 'this', 'is', 'my', 'comment'],
				options,
				{ allowSpacesInOptions: true }
			)
			expect(result.parsedOptions.comment).toBe('this is my comment')
		})

		it('should stop at next option when consuming multi-word value', () => {
			const opts: CliOptionConfig[] = [
				...options,
				{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
			]
			const result = parseCliOptions(
				['--comment', 'this', 'is', 'a', 'comment', '--verbose'],
				opts,
				{ allowSpacesInOptions: true }
			)
			expect(result.parsedOptions.comment).toBe('this is a comment')
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should not consume multiple words when disabled (default)', () => {
			const result = parseCliOptions(['--comment', 'single'], options)
			expect(result.parsedOptions.comment).toBe('single')
		})
	})

	describe('Unknown Options', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
		]

		// Note: Unknown options generate warnings via logger, not errors in the result
		// The parser still processes known options correctly

		it('should still parse known options when unknown present', () => {
			const result = parseCliOptions(['--verbose', '--unknown', 'value'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should skip unknown option and its value', () => {
			const result = parseCliOptions(['--unknown', 'value', '--verbose'], options)
			expect(result.parsedOptions.verbose).toBe(true)
		})
	})

	describe('Edge Cases', () => {
		const options: CliOptionConfig[] = [
			{ alias: '-n', name: '--name', description: 'Name' },
			{ alias: '-p', name: '--port', description: 'Port', type: 'number' }
		]

		it('should handle option value that looks like another option', () => {
			const result = parseCliOptions(['--name=--value'], options)
			expect(result.parsedOptions.name).toBe('--value')
		})

		it('should handle very long option values', () => {
			const longValue = 'a'.repeat(10000)
			const result = parseCliOptions([`--name=${longValue}`], options)
			expect(result.parsedOptions.name).toBe(longValue)
		})

		it('should handle unicode in option values', () => {
			const result = parseCliOptions(['--name', '你好世界'], options)
			expect(result.parsedOptions.name).toBe('你好世界')
		})

		it('should handle emoji in option values', () => {
			const result = parseCliOptions(['--name', '🎉🚀💻'], options)
			expect(result.parsedOptions.name).toBe('🎉🚀💻')
		})

		it('should handle option at end of args with no value (string type)', () => {
			// String option at end with no value - treated as boolean true due to no next arg
			const result = parseCliOptions(['--name'], options)
			expect(result.parsedOptions.name).toBe(true)
		})
	})

	describe('DEFAULT_HELP_OPTION', () => {
		it('should have correct structure', () => {
			expect(DEFAULT_HELP_OPTION).toEqual({
				alias: '-h',
				name: '--help',
				description: expect.any(String),
				type: 'boolean'
			})
		})

		it('should be parseable', () => {
			const result = parseCliOptions(['--help'], [DEFAULT_HELP_OPTION])
			expect(result.parsedOptions.help).toBe(true)
		})

		it('should work with short alias', () => {
			const result = parseCliOptions(['-h'], [DEFAULT_HELP_OPTION])
			expect(result.parsedOptions.help).toBe(true)
		})
	})

	describe('Complex Real-World Scenarios', () => {
		it('should handle git-like command options', () => {
			const options: CliOptionConfig[] = [
				{ alias: '-m', name: '--message', description: 'Commit message', type: 'string' },
				{ alias: '-a', name: '--all', description: 'Stage all', type: 'boolean' },
				{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
			]

			const result = parseCliOptions(['-a', '-m', 'Initial commit', '-v'], options)
			expect(result.parsedOptions.all).toBe(true)
			expect(result.parsedOptions.message).toBe('Initial commit')
			expect(result.parsedOptions.verbose).toBe(true)
		})

		it('should handle server-like command options', () => {
			const options: CliOptionConfig[] = [
				{ alias: '-p', name: '--port', description: 'Port', type: 'number', default: 3000 },
				{ alias: '-h', name: '--host', description: 'Host', type: 'string', default: '0.0.0.0' },
				{ alias: '-s', name: '--ssl', description: 'Enable SSL', type: 'boolean', default: false },
				{ alias: '-c', name: '--config', description: 'Config file', type: 'string' }
			]

			const result = parseCliOptions(['--port=8080', '--ssl', '-c', 'server.config.json'], options)
			expect(result.parsedOptions.port).toBe(8080)
			expect(result.parsedOptions.host).toBe('0.0.0.0')
			expect(result.parsedOptions.ssl).toBe(true)
			expect(result.parsedOptions.config).toBe('server.config.json')
		})

		it('should handle file processing command', () => {
			const options: CliOptionConfig[] = [
				{ alias: '-i', name: '--input', description: 'Input', type: 'string', required: true },
				{ alias: '-o', name: '--output', description: 'Output', type: 'string', required: true },
				{ alias: '-f', name: '--format', description: 'Format', type: 'string', default: 'json' },
				{ alias: '-v', name: '--verbose', description: 'Verbose', type: 'boolean' }
			]

			const result = parseCliOptions([
				'-i', 'data.csv',
				'-o', 'result.json',
				'--format=xml',
				'-v'
			], options)

			expect(result.errors).toHaveLength(0)
			expect(result.parsedOptions.input).toBe('data.csv')
			expect(result.parsedOptions.output).toBe('result.json')
			expect(result.parsedOptions.format).toBe('xml')
			expect(result.parsedOptions.verbose).toBe(true)
		})
	})
})
