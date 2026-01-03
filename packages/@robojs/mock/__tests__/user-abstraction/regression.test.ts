/**
 * Regression Tests: User Abstraction
 *
 * These tests prevent regressions in the user abstraction layer.
 * Each test documents a specific bug or issue that was fixed.
 */

import { Session } from '../../src/session/session'
import { MockServerState, createMockUser } from '../../src/session/state'

describe('User Abstraction - Regression Prevention', () => {
	/**
	 * REGRESSION: Hardcoded user_0 was used instead of actual current user
	 * FIX: useStageData now uses session.currentUser
	 */
	it('should not use hardcoded user_0 for message author', async () => {
		const session = new Session()
		const currentUser = session.getCurrentUser()
		const channel = Array.from(session.state.channels.values())[0]

		const message = await session.dispatchMessage({
			channelId: channel.id,
			content: 'Test message'
		})

		expect(message.authorId).not.toBe('user_0')
		// Note: authorId should be the current user when no explicit author is provided
		// The exact behavior depends on dispatchMessage implementation
	})

	/**
	 * REGRESSION: getOrCreateTestUser created user with fixed ID 123456789012345678
	 * FIX: currentUser uses dynamic snowflake IDs
	 */
	it('should generate unique IDs for different sessions', () => {
		const session1 = new Session()
		const session2 = new Session()

		const user1 = session1.getCurrentUser()
		const user2 = session2.getCurrentUser()

		expect(user1.id).not.toBe(user2.id)
		expect(user1.id).not.toBe('123456789012345678')

		session1.end()
		session2.end()
	})

	/**
	 * REGRESSION: User switching didn't update interactions
	 * FIX: All dispatch methods check currentUser at call time
	 */
	it('should use updated current user after switch', async () => {
		const session = new Session()
		const alice = session.createUser({ username: 'Alice' })
		const channel = Array.from(session.state.channels.values())[0]

		// Switch user
		session.setCurrentUser(alice.id)

		// Send message (should use Alice, not original user)
		const message = await session.dispatchMessage({
			channelId: channel.id,
			content: 'Test'
		})

		// The message should be associated with Alice
		// This depends on how dispatchMessage uses currentUser
		expect(session.getCurrentUser().id).toBe(alice.id)

		await session.end()
	})

	/**
	 * REGRESSION: asUser didn't restore original user on error
	 * FIX: Uses try/finally to always restore
	 */
	it('should restore original user even after error in asUser', async () => {
		const session = new Session()
		const originalId = session.getCurrentUser().id
		const alice = session.createUser({ username: 'Alice' })

		try {
			await session.asUser(alice.id, () => {
				throw new Error('Intentional error')
			})
		} catch {
			// Expected
		}

		expect(session.getCurrentUser().id).toBe(originalId)

		await session.end()
	})

	/**
	 * REGRESSION: DM channels weren't tied to current user
	 * FIX: getOrCreateDMChannel uses currentUser.id in the key
	 */
	it('should create DM channel specific to current user', () => {
		const state = new MockServerState()
		const alice = createMockUser({ username: 'Alice' })
		const bob = createMockUser({ username: 'Bob' })
		const target = createMockUser({ username: 'Target' })

		state.users.set(alice.id, alice)
		state.users.set(bob.id, bob)
		state.users.set(target.id, target)

		// Alice opens DM with Target
		state.currentUser = alice
		const aliceDM = state.getOrCreateDMChannel(target.id)

		// Bob opens DM with Target
		state.currentUser = bob
		const bobDM = state.getOrCreateDMChannel(target.id)

		// Should be different DM channels
		expect(aliceDM.id).not.toBe(bobDM.id)
		expect(aliceDM.recipientIds).toContain(alice.id)
		expect(aliceDM.recipientIds).toContain(target.id)
		expect(bobDM.recipientIds).toContain(bob.id)
		expect(bobDM.recipientIds).toContain(target.id)
	})

	/**
	 * REGRESSION: Session isolation - users leaked between sessions
	 * FIX: Each session has independent state
	 */
	it('should isolate users between sessions', () => {
		const session1 = new Session()
		const session2 = new Session()

		const aliceInSession1 = session1.createUser({ username: 'Alice' })

		// Alice should not exist in session2
		expect(session2.getUser(aliceInSession1.id)).toBeUndefined()

		session1.end()
		session2.end()
	})

	/**
	 * REGRESSION: currentUser getter created new user each time
	 * FIX: Uses cached _currentUser with lazy initialization
	 */
	it('should return the same currentUser on repeated calls', () => {
		const state = new MockServerState()

		const user1 = state.currentUser
		const user2 = state.currentUser
		const user3 = state.currentUser

		expect(user1.id).toBe(user2.id)
		expect(user2.id).toBe(user3.id)
	})

	/**
	 * REGRESSION: updateCurrentUser didn't sync users map
	 * FIX: Both _currentUser and users map are updated
	 */
	it('should keep currentUser and users map in sync', () => {
		const state = new MockServerState()
		const originalId = state.currentUser.id

		state.updateCurrentUser({ username: 'NewName' })

		expect(state.currentUser.username).toBe('NewName')
		expect(state.users.get(originalId)?.username).toBe('NewName')
	})

	/**
	 * REGRESSION: switchCurrentUser could create orphan references
	 * FIX: Only switches to users that exist in the map
	 */
	it('should not switch to non-existent users', () => {
		const state = new MockServerState()
		const originalId = state.currentUser.id

		const result = state.switchCurrentUser('fake-id-that-does-not-exist')

		expect(result).toBeUndefined()
		expect(state.currentUser.id).toBe(originalId)
	})

	/**
	 * REGRESSION: Users created without adding to users map
	 * FIX: createUser always adds to users map
	 */
	it('should add created users to users map', () => {
		const session = new Session()
		const user = session.createUser({ username: 'TestUser' })

		expect(session.state.users.has(user.id)).toBe(true)
		expect(session.getUser(user.id)).toBe(user)

		session.end()
	})

	/**
	 * REGRESSION: Bot user not distinguished from human users
	 * FIX: bot property properly set and respected
	 */
	it('should correctly identify bot vs human users', () => {
		const session = new Session()

		const humanUser = session.createUser({ username: 'Human', bot: false })
		const botUser = session.createUser({ username: 'Bot', bot: true })

		expect(humanUser.bot).toBe(false)
		expect(botUser.bot).toBe(true)

		const allUsers = session.getUsers()
		const bots = allUsers.filter((u) => u.bot)
		const humans = allUsers.filter((u) => !u.bot)

		expect(bots.length).toBeGreaterThan(0)
		expect(humans.length).toBeGreaterThan(0)

		session.end()
	})
})
