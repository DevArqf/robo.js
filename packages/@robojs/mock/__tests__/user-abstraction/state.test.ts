/**
 * Unit Tests: MockServerState - currentUser
 *
 * Tests the currentUser functionality in MockServerState including:
 * - Lazy initialization
 * - Setting/switching users
 * - Updating user properties
 */

import { MockServerState, createMockUser } from '../../src/session/state'

describe('MockServerState - currentUser', () => {
	let state: MockServerState

	beforeEach(() => {
		state = new MockServerState()
	})

	describe('currentUser getter', () => {
		it('should create a default current user on first access', () => {
			const user = state.currentUser
			expect(user).toBeDefined()
			expect(user.id).toBeTruthy()
			expect(user.username).toBe('You')
			expect(user.bot).toBe(false)
		})

		it('should return the same user on subsequent accesses', () => {
			const user1 = state.currentUser
			const user2 = state.currentUser
			expect(user1.id).toBe(user2.id)
		})

		it('should add the current user to the users map', () => {
			const user = state.currentUser
			expect(state.users.get(user.id)).toBe(user)
		})
	})

	describe('currentUser setter', () => {
		it('should set a new current user', () => {
			const newUser = createMockUser({ username: 'Alice' })
			state.currentUser = newUser
			expect(state.currentUser.id).toBe(newUser.id)
			expect(state.currentUser.username).toBe('Alice')
		})

		it('should add the new user to the users map', () => {
			const newUser = createMockUser({ username: 'Alice' })
			state.currentUser = newUser
			expect(state.users.get(newUser.id)).toBe(newUser)
		})
	})

	describe('updateCurrentUser', () => {
		it('should update current user properties', () => {
			const originalId = state.currentUser.id
			const updated = state.updateCurrentUser({ username: 'UpdatedName' })

			expect(updated.id).toBe(originalId) // ID unchanged
			expect(updated.username).toBe('UpdatedName')
			expect(state.currentUser.username).toBe('UpdatedName')
		})

		it('should update the users map', () => {
			const originalId = state.currentUser.id
			state.updateCurrentUser({ username: 'UpdatedName' })

			expect(state.users.get(originalId)?.username).toBe('UpdatedName')
		})

		it('should preserve unchanged properties', () => {
			state.currentUser = createMockUser({ username: 'Alice', avatar: 'avatar123' })
			state.updateCurrentUser({ username: 'Bob' })

			expect(state.currentUser.avatar).toBe('avatar123')
		})

		it('should update status property', () => {
			state.updateCurrentUser({ status: 'dnd' })
			expect(state.currentUser.status).toBe('dnd')
		})
	})

	describe('switchCurrentUser', () => {
		it('should switch to an existing user', () => {
			const alice = createMockUser({ username: 'Alice' })
			state.users.set(alice.id, alice)

			const result = state.switchCurrentUser(alice.id)

			expect(result).toBe(alice)
			expect(state.currentUser.id).toBe(alice.id)
		})

		it('should return undefined for non-existent user', () => {
			const result = state.switchCurrentUser('non-existent-id')
			expect(result).toBeUndefined()
		})

		it('should not change current user if switch fails', () => {
			const originalId = state.currentUser.id
			state.switchCurrentUser('non-existent-id')
			expect(state.currentUser.id).toBe(originalId)
		})
	})

	describe('DM channel with currentUser', () => {
		it('should create DM channel using currentUser ID', () => {
			const recipientId = 'recipient123'
			const dmChannel = state.getOrCreateDMChannel(recipientId)

			expect(dmChannel).toBeDefined()
			expect(dmChannel.type).toBe(1) // DM type
			expect(dmChannel.recipientIds).toContain(state.currentUser.id)
			expect(dmChannel.recipientIds).toContain(recipientId)
		})

		it('should return same DM channel for same user pair', () => {
			const recipientId = 'recipient123'
			const dm1 = state.getOrCreateDMChannel(recipientId)
			const dm2 = state.getOrCreateDMChannel(recipientId)

			expect(dm1.id).toBe(dm2.id)
		})

		it('should create different DM channels for different current users', () => {
			const recipientId = 'recipient123'

			// DM as user1
			const dm1 = state.getOrCreateDMChannel(recipientId)
			const user1Id = state.currentUser.id

			// Switch to a different user
			const user2 = createMockUser({ username: 'User2' })
			state.users.set(user2.id, user2)
			state.switchCurrentUser(user2.id)

			// DM as user2
			const dm2 = state.getOrCreateDMChannel(recipientId)

			expect(dm1.id).not.toBe(dm2.id)
			expect(dm1.recipientIds).toContain(user1Id)
			expect(dm2.recipientIds).toContain(user2.id)
		})
	})
})
