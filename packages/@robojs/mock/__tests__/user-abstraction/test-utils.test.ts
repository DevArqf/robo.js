/**
 * Tests for Test Utilities
 *
 * Tests the TestUsers, TestInteractions, and createTestUtils helpers.
 */

import { Session } from '../../src/session/session'
import { TestUsers, TestInteractions, createTestUtils } from '../../src/testing/user-utils'

describe('Test Utilities', () => {
	let session: Session

	beforeEach(() => {
		session = new Session({
			config: {
				guilds: [{ name: 'Test', channels: [{ name: 'general', type: 0 }] }]
			}
		})
	})

	afterEach(async () => {
		await session.end()
	})

	describe('createTestUtils', () => {
		it('should return users and interactions helpers', () => {
			const utils = createTestUtils(session)

			expect(utils.users).toBeInstanceOf(TestUsers)
			expect(utils.interactions).toBeInstanceOf(TestInteractions)
		})
	})

	describe('TestUsers', () => {
		describe('create', () => {
			it('should create a user with given name', () => {
				const utils = createTestUtils(session)
				const user = utils.users.create('Alice')

				expect(user.username).toBe('Alice')
				expect(user.bot).toBe(false)
			})

			it('should accept additional options', () => {
				const utils = createTestUtils(session)
				const user = utils.users.create('Alice', { avatar: 'avatar123' })

				expect(user.avatar).toBe('avatar123')
			})

			it('should create bot users', () => {
				const utils = createTestUtils(session)
				const bot = utils.users.create('TestBot', { bot: true })

				expect(bot.bot).toBe(true)
			})
		})

		describe('createMany', () => {
			it('should create multiple users', () => {
				const utils = createTestUtils(session)
				const users = utils.users.createMany(['Alice', 'Bob', 'Charlie'])

				expect(users).toHaveLength(3)
				expect(users.map((u) => u.username)).toEqual(['Alice', 'Bob', 'Charlie'])
			})
		})

		describe('byName', () => {
			it('should find user by username', () => {
				const utils = createTestUtils(session)
				utils.users.create('Alice')

				const found = utils.users.byName('Alice')
				expect(found?.username).toBe('Alice')
			})

			it('should return undefined for non-existent user', () => {
				const utils = createTestUtils(session)
				const found = utils.users.byName('NonExistent')
				expect(found).toBeUndefined()
			})
		})

		describe('byId', () => {
			it('should find user by ID', () => {
				const utils = createTestUtils(session)
				const created = utils.users.create('Alice')

				const found = utils.users.byId(created.id)
				expect(found?.username).toBe('Alice')
			})

			it('should return undefined for non-existent ID', () => {
				const utils = createTestUtils(session)
				const found = utils.users.byId('fake-id')
				expect(found).toBeUndefined()
			})
		})

		describe('current', () => {
			it('should return the current user', () => {
				const utils = createTestUtils(session)
				const current = utils.users.current()

				expect(current).toBeDefined()
				expect(current.id).toBe(session.getCurrentUser().id)
			})
		})

		describe('switchTo', () => {
			it('should switch to user by object', () => {
				const utils = createTestUtils(session)
				const alice = utils.users.create('Alice')

				const switched = utils.users.switchTo(alice)

				expect(switched.id).toBe(alice.id)
				expect(utils.users.current().id).toBe(alice.id)
			})

			it('should switch to user by name', () => {
				const utils = createTestUtils(session)
				utils.users.create('Alice')

				const switched = utils.users.switchTo('Alice')

				expect(switched.username).toBe('Alice')
			})

			it('should throw for non-existent user', () => {
				const utils = createTestUtils(session)

				expect(() => utils.users.switchTo('NonExistent')).toThrow('User not found')
			})
		})

		describe('as', () => {
			it('should execute action as specified user by object', async () => {
				const utils = createTestUtils(session)
				const alice = utils.users.create('Alice')
				let executedAs: string | undefined

				await utils.users.as(alice, () => {
					executedAs = session.getCurrentUser().username
				})

				expect(executedAs).toBe('Alice')
			})

			it('should execute action as specified user by name', async () => {
				const utils = createTestUtils(session)
				utils.users.create('Alice')
				let executedAs: string | undefined

				await utils.users.as('Alice', () => {
					executedAs = session.getCurrentUser().username
				})

				expect(executedAs).toBe('Alice')
			})

			it('should restore original user after action', async () => {
				const utils = createTestUtils(session)
				const originalId = utils.users.current().id
				utils.users.create('Alice')

				await utils.users.as('Alice', () => {
					// Action
				})

				expect(utils.users.current().id).toBe(originalId)
			})

			it('should throw for non-existent user', async () => {
				const utils = createTestUtils(session)

				await expect(utils.users.as('NonExistent', () => {})).rejects.toThrow('User not found')
			})
		})

		describe('allHumans', () => {
			it('should return only non-bot users', () => {
				const utils = createTestUtils(session)
				utils.users.create('Human1')
				utils.users.create('Human2')
				utils.users.create('Bot1', { bot: true })

				const humans = utils.users.allHumans()

				expect(humans.every((u) => !u.bot)).toBe(true)
				expect(humans.map((u) => u.username)).toContain('Human1')
				expect(humans.map((u) => u.username)).toContain('Human2')
			})
		})

		describe('allBots', () => {
			it('should return only bot users', () => {
				const utils = createTestUtils(session)
				utils.users.create('Human1')
				utils.users.create('Bot1', { bot: true })

				const bots = utils.users.allBots()

				expect(bots.every((u) => u.bot)).toBe(true)
			})
		})
	})

	describe('TestInteractions', () => {
		describe('conversation', () => {
			it('should create messages from multiple users', async () => {
				const utils = createTestUtils(session)
				utils.users.createMany(['Alice', 'Bob'])
				const channel = Array.from(session.state.channels.values())[0]

				await utils.interactions.conversation(channel.id, [
					{ user: 'Alice', content: 'Hello!' },
					{ user: 'Bob', content: 'Hi there!' }
				])

				const messages = session.state.getMessagesForChannel(channel.id)
				expect(messages).toHaveLength(2)
				// Check both messages exist (order may vary due to timestamp resolution)
				const contents = messages.map((m) => m.content)
				expect(contents).toContain('Hello!')
				expect(contents).toContain('Hi there!')
			})

			it('should throw if user not found', async () => {
				const utils = createTestUtils(session)
				const channel = Array.from(session.state.channels.values())[0]

				await expect(
					utils.interactions.conversation(channel.id, [{ user: 'NonExistent', content: 'Hello!' }])
				).rejects.toThrow('User not found')
			})
		})

		describe('sendMessage', () => {
			it('should send message as user object', async () => {
				const utils = createTestUtils(session)
				const alice = utils.users.create('Alice')
				const channel = Array.from(session.state.channels.values())[0]

				await utils.interactions.sendMessage(alice, channel.id, 'Hello!')

				const messages = session.state.getMessagesForChannel(channel.id)
				expect(messages).toHaveLength(1)
			})

			it('should send message as user by name', async () => {
				const utils = createTestUtils(session)
				utils.users.create('Alice')
				const channel = Array.from(session.state.channels.values())[0]

				await utils.interactions.sendMessage('Alice', channel.id, 'Hello!')

				const messages = session.state.getMessagesForChannel(channel.id)
				expect(messages).toHaveLength(1)
			})
		})
	})
})
