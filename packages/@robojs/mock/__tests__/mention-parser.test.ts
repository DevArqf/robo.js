/**
 * MentionParser Unit Tests
 *
 * Tests the MentionParser utility class which parses Discord mention syntax
 * from message content and provides formatting/utility methods.
 */
import { MentionParser } from '../src/utils/mention-parser.js'

describe('MentionParser', () => {
	describe('parse()', () => {
		describe('user mentions', () => {
			it('should parse single user mention <@123456789012345678>', () => {
				const result = MentionParser.parse('Hello <@123456789012345678>!')
				expect(result.users).toEqual(['123456789012345678'])
				expect(result.roles).toEqual([])
				expect(result.channels).toEqual([])
				expect(result.everyone).toBe(false)
				expect(result.here).toBe(false)
			})

			it('should parse nickname mention <@!123456789012345678>', () => {
				const result = MentionParser.parse('Hey <@!987654321098765432>')
				expect(result.users).toEqual(['987654321098765432'])
			})

			it('should parse multiple user mentions', () => {
				const result = MentionParser.parse('<@111111111111111111> and <@222222222222222222>')
				expect(result.users).toEqual(['111111111111111111', '222222222222222222'])
			})

			it('should deduplicate repeated user mentions', () => {
				const result = MentionParser.parse('<@123456789012345678> said <@123456789012345678>')
				expect(result.users).toEqual(['123456789012345678'])
				expect(result.users.length).toBe(1)
			})

			it('should handle mixed user and nickname mentions of same user', () => {
				const result = MentionParser.parse('<@123456789012345678> <@!123456789012345678>')
				expect(result.users).toEqual(['123456789012345678'])
				expect(result.users.length).toBe(1)
			})
		})

		describe('role mentions', () => {
			it('should parse role mention <@&123456789012345678>', () => {
				const result = MentionParser.parse('Pinging <@&555555555555555555>')
				expect(result.roles).toEqual(['555555555555555555'])
				expect(result.users).toEqual([])
			})

			it('should parse multiple role mentions', () => {
				const result = MentionParser.parse('<@&111111111111111111> <@&222222222222222222>')
				expect(result.roles).toEqual(['111111111111111111', '222222222222222222'])
			})

			it('should deduplicate repeated role mentions', () => {
				const result = MentionParser.parse('<@&123456789012345678> <@&123456789012345678>')
				expect(result.roles).toEqual(['123456789012345678'])
				expect(result.roles.length).toBe(1)
			})
		})

		describe('channel mentions', () => {
			it('should parse channel mention <#123456789012345678>', () => {
				const result = MentionParser.parse('Check out <#999999999999999999>')
				expect(result.channels).toEqual(['999999999999999999'])
			})

			it('should parse multiple channel mentions', () => {
				const result = MentionParser.parse('<#111111111111111111> and <#222222222222222222>')
				expect(result.channels).toEqual(['111111111111111111', '222222222222222222'])
			})
		})

		describe('special mentions', () => {
			it('should detect @everyone', () => {
				const result = MentionParser.parse('Hey @everyone!')
				expect(result.everyone).toBe(true)
				expect(result.here).toBe(false)
			})

			it('should detect @here', () => {
				const result = MentionParser.parse('Hey @here!')
				expect(result.everyone).toBe(false)
				expect(result.here).toBe(true)
			})

			it('should detect both @everyone and @here', () => {
				const result = MentionParser.parse('@everyone and @here')
				expect(result.everyone).toBe(true)
				expect(result.here).toBe(true)
			})
		})

		describe('mixed content', () => {
			it('should parse all mention types in one string', () => {
				const content =
					'Hey <@111111111111111111> and <@&222222222222222222>, check <#333333333333333333> @everyone'
				const result = MentionParser.parse(content)

				expect(result.users).toEqual(['111111111111111111'])
				expect(result.roles).toEqual(['222222222222222222'])
				expect(result.channels).toEqual(['333333333333333333'])
				expect(result.everyone).toBe(true)
				expect(result.here).toBe(false)
			})

			it('should handle text between mentions', () => {
				const result = MentionParser.parse('Hello <@123456789012345678> world <@987654321098765432>')
				expect(result.users).toEqual(['123456789012345678', '987654321098765432'])
			})
		})

		describe('edge cases', () => {
			it('should return empty results for empty string', () => {
				const result = MentionParser.parse('')
				expect(result.users).toEqual([])
				expect(result.roles).toEqual([])
				expect(result.channels).toEqual([])
				expect(result.everyone).toBe(false)
				expect(result.here).toBe(false)
			})

			it('should return empty results for string with no mentions', () => {
				const result = MentionParser.parse('Just a regular message with no mentions')
				expect(result.users).toEqual([])
				expect(result.roles).toEqual([])
				expect(result.channels).toEqual([])
				expect(result.everyone).toBe(false)
				expect(result.here).toBe(false)
			})

			it('should not match invalid mention formats', () => {
				// Too short ID (less than 17 digits)
				const result1 = MentionParser.parse('<@123>')
				expect(result1.users).toEqual([])

				// Missing brackets
				const result2 = MentionParser.parse('@123456789012345678')
				expect(result2.users).toEqual([])

				// Extra characters
				const result3 = MentionParser.parse('<@abc123456789012345678>')
				expect(result3.users).toEqual([])
			})
		})
	})

	describe('format methods', () => {
		it('formatUserMention() should return <@id>', () => {
			expect(MentionParser.formatUserMention('123456789012345678')).toBe('<@123456789012345678>')
		})

		it('formatNicknameMention() should return <@!id>', () => {
			expect(MentionParser.formatNicknameMention('123456789012345678')).toBe('<@!123456789012345678>')
		})

		it('formatRoleMention() should return <@&id>', () => {
			expect(MentionParser.formatRoleMention('123456789012345678')).toBe('<@&123456789012345678>')
		})

		it('formatChannelMention() should return <#id>', () => {
			expect(MentionParser.formatChannelMention('123456789012345678')).toBe('<#123456789012345678>')
		})
	})

	describe('hasMentions()', () => {
		it('should return true for content with user mention', () => {
			expect(MentionParser.hasMentions('Hello <@123456789012345678>')).toBe(true)
		})

		it('should return true for content with role mention', () => {
			expect(MentionParser.hasMentions('Hello <@&123456789012345678>')).toBe(true)
		})

		it('should return true for content with channel mention', () => {
			expect(MentionParser.hasMentions('Check <#123456789012345678>')).toBe(true)
		})

		it('should return true for content with @everyone', () => {
			expect(MentionParser.hasMentions('@everyone')).toBe(true)
		})

		it('should return true for content with @here', () => {
			expect(MentionParser.hasMentions('@here')).toBe(true)
		})

		it('should return false for content without mentions', () => {
			expect(MentionParser.hasMentions('Just a regular message')).toBe(false)
		})

		it('should return false for empty string', () => {
			expect(MentionParser.hasMentions('')).toBe(false)
		})
	})

	describe('stripMentions()', () => {
		it('should remove all mention syntax', () => {
			const content = 'Hey <@111111111111111111> <@&222222222222222222> <#333333333333333333> @everyone'
			const result = MentionParser.stripMentions(content)
			expect(result).toBe('Hey')
		})

		it('should clean up extra whitespace', () => {
			const result = MentionParser.stripMentions('Hello   <@123456789012345678>   world')
			expect(result).toBe('Hello world')
		})

		it('should preserve non-mention text', () => {
			const result = MentionParser.stripMentions('Hello <@123456789012345678> how are you?')
			expect(result).toBe('Hello how are you?')
		})

		it('should handle empty string', () => {
			expect(MentionParser.stripMentions('')).toBe('')
		})

		it('should handle string with only mentions', () => {
			const result = MentionParser.stripMentions('<@123456789012345678> @everyone')
			expect(result).toBe('')
		})

		it('should remove @here mentions', () => {
			const result = MentionParser.stripMentions('Attention @here please')
			expect(result).toBe('Attention please')
		})
	})
})
