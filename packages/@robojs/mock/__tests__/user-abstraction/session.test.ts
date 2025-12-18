/**
 * Unit Tests: Session - User APIs
 *
 * Tests the user management methods on the Session class including:
 * - getCurrentUser, setCurrentUser
 * - createUser, updateUser
 * - getUsers, getUser
 * - asUser, sendMessageAs, invokeCommandAs, clickButtonAs
 */

import { Session } from '../../src/session/session'

describe('Session - User APIs', () => {
	let session: Session

	beforeEach(() => {
		session = new Session({
			config: {
				guilds: [{ name: 'Test Server', channels: [{ name: 'general', type: 0 }] }]
			}
		})
	})

	afterEach(async () => {
		await session.end()
	})

	describe('getCurrentUser', () => {
		it('should return the current user', () => {
			const user = session.getCurrentUser()
			expect(user).toBeDefined()
			expect(user.bot).toBe(false)
		})
	})

	describe('createUser', () => {
		it('should create a new user', () => {
			const user = session.createUser({ username: 'NewUser' })
			expect(user.username).toBe('NewUser')
			expect(session.getUser(user.id)).toBeDefined()
		})

		it('should add user to all guilds as member', () => {
			const user = session.createUser({ username: 'NewUser' })
			const guild = Array.from(session.state.guilds.values())[0]

			expect(guild.members).toContain(user.id)
		})

		it('should set as current user when setAsCurrent=true', () => {
			const user = session.createUser({ username: 'NewUser' }, true)
			expect(session.getCurrentUser().id).toBe(user.id)
		})

		it('should not set as current user when setAsCurrent=false', () => {
			const originalId = session.getCurrentUser().id
			session.createUser({ username: 'NewUser' }, false)
			expect(session.getCurrentUser().id).toBe(originalId)
		})

		it('should create user with custom status', () => {
			const user = session.createUser({ username: 'NewUser', status: 'dnd' })
			expect(user.status).toBe('dnd')
		})
	})

	describe('setCurrentUser', () => {
		it('should switch to an existing user', () => {
			const user = session.createUser({ username: 'Alice' })
			const result = session.setCurrentUser(user.id)

			expect(result).toBe(user)
			expect(session.getCurrentUser().id).toBe(user.id)
		})

		it('should return undefined for non-existent user', () => {
			const result = session.setCurrentUser('non-existent')
			expect(result).toBeUndefined()
		})
	})

	describe('updateUser', () => {
		it('should update user properties', () => {
			const user = session.createUser({ username: 'Alice' })
			const updated = session.updateUser(user.id, { username: 'AliceUpdated' })

			expect(updated?.username).toBe('AliceUpdated')
			expect(session.getUser(user.id)?.username).toBe('AliceUpdated')
		})

		it('should return undefined for non-existent user', () => {
			const result = session.updateUser('non-existent', { username: 'Test' })
			expect(result).toBeUndefined()
		})

		it('should update current user reference when updating current user', () => {
			const currentId = session.getCurrentUser().id
			session.updateUser(currentId, { username: 'Updated' })
			expect(session.getCurrentUser().username).toBe('Updated')
		})
	})

	describe('getUsers', () => {
		it('should return all users', () => {
			session.createUser({ username: 'Alice' })
			session.createUser({ username: 'Bob' })

			const users = session.getUsers()
			const usernames = users.map((u) => u.username)

			expect(usernames).toContain('Alice')
			expect(usernames).toContain('Bob')
		})

		it('should include the bot user', () => {
			const users = session.getUsers()
			const bots = users.filter((u) => u.bot)
			expect(bots.length).toBeGreaterThan(0)
		})
	})

	describe('getUser', () => {
		it('should return user by ID', () => {
			const user = session.createUser({ username: 'Alice' })
			const found = session.getUser(user.id)
			expect(found?.username).toBe('Alice')
		})

		it('should return undefined for non-existent user', () => {
			const result = session.getUser('non-existent')
			expect(result).toBeUndefined()
		})
	})

	describe('asUser', () => {
		it('should execute action as specified user', async () => {
			const alice = session.createUser({ username: 'Alice' })
			let executedAsUserId: string | undefined

			await session.asUser(alice.id, () => {
				executedAsUserId = session.getCurrentUser().id
			})

			expect(executedAsUserId).toBe(alice.id)
		})

		it('should restore original user after action', async () => {
			const originalId = session.getCurrentUser().id
			const alice = session.createUser({ username: 'Alice' })

			await session.asUser(alice.id, () => {
				// Action
			})

			expect(session.getCurrentUser().id).toBe(originalId)
		})

		it('should restore original user even if action throws', async () => {
			const originalId = session.getCurrentUser().id
			const alice = session.createUser({ username: 'Alice' })

			await expect(
				session.asUser(alice.id, () => {
					throw new Error('Test error')
				})
			).rejects.toThrow('Test error')

			expect(session.getCurrentUser().id).toBe(originalId)
		})

		it('should throw if user not found', async () => {
			await expect(session.asUser('non-existent', () => {})).rejects.toThrow('User non-existent not found')
		})

		it('should handle async actions', async () => {
			const alice = session.createUser({ username: 'Alice' })
			let userDuringAction: string | undefined

			await session.asUser(alice.id, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10))
				userDuringAction = session.getCurrentUser().id
			})

			expect(userDuringAction).toBe(alice.id)
		})
	})

	describe('sendMessageAs', () => {
		it('should send message with specified user as author', async () => {
			const alice = session.createUser({ username: 'Alice' })
			const channel = Array.from(session.state.channels.values())[0]

			const message = await session.sendMessageAs(alice.id, channel.id, 'Hello!')

			expect(message.authorId).toBe(alice.id)
		})

		it('should throw if user not found', async () => {
			const channel = Array.from(session.state.channels.values())[0]

			await expect(session.sendMessageAs('non-existent', channel.id, 'Hello!')).rejects.toThrow(
				'User non-existent not found'
			)
		})
	})

	describe('clickButtonAs', () => {
		it('should throw if user not found', async () => {
			await expect(session.clickButtonAs('non-existent', 'message123', 'button_id')).rejects.toThrow(
				'User non-existent not found'
			)
		})
	})

	describe('invokeCommandAs', () => {
		it('should throw if user not found', async () => {
			await expect(session.invokeCommandAs('non-existent', 'ping')).rejects.toThrow('User non-existent not found')
		})
	})
})
