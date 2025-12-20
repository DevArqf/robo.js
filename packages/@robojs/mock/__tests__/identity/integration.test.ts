/**
 * Multi-Identity Integration Tests
 *
 * Tests the integration between per-connection bot identity and
 * per-browser user identity systems, verifying they work together
 * correctly in multi-bot and multi-user scenarios.
 */
import { buildReadyPayload } from '../../src/discord/payloads.js'
import { createSessionState, createMockUser, createMockGuild, createMockChannel } from '../../src/session/state.js'
import type { MockUser, ConnectionState, SessionState } from '../../src/types/index.js'

describe('Multi-Identity Integration', () => {
	describe('Multiple bots + multiple users in same session', () => {
		let sessionState: SessionState

		beforeEach(() => {
			sessionState = createSessionState({
				botUser: { username: 'DefaultBot', bot: true }
			})

			// Add a guild and channel
			const guild = createMockGuild({ name: 'Test Guild' })
			sessionState.addGuild(guild)
			const channel = createMockChannel({ name: 'general', guildId: guild.id })
			sessionState.addChannel(channel)

			// Add multiple users
			sessionState.addUser(createMockUser({ username: 'Alice', bot: false }))
			sessionState.addUser(createMockUser({ username: 'Bob', bot: false }))
			sessionState.addUser(createMockUser({ username: 'Charlie', bot: false }))
		})

		it('should support multiple bot connections with different identities', () => {
			const botA = createMockUser({ username: 'BotA', bot: true })
			const botB = createMockUser({ username: 'BotB', bot: true })

			// Simulate connection A
			const readyA = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-a',
				connectionBotUser: botA
			})

			// Simulate connection B
			const readyB = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-b',
				connectionBotUser: botB
			})

			const dataA = readyA.d as Record<string, unknown>
			const dataB = readyB.d as Record<string, unknown>

			// Verify different bot identities
			expect((dataA.user as MockUser).username).toBe('BotA')
			expect((dataB.user as MockUser).username).toBe('BotB')

			// Verify same application ID (they're all connected to same session)
			expect((dataA.application as { id: string }).id).toBe(sessionState.applicationId)
			expect((dataB.application as { id: string }).id).toBe(sessionState.applicationId)
		})

		it('should allow multiple users to exist independently', () => {
			const users = Array.from(sessionState.users.values())
			const nonBotUsers = users.filter(u => !u.bot)

			expect(nonBotUsers.length).toBeGreaterThanOrEqual(3)

			// Verify users have unique IDs
			const userIds = nonBotUsers.map(u => u.id)
			const uniqueIds = new Set(userIds)
			expect(uniqueIds.size).toBe(userIds.length)
		})

		it('should track both bot users and regular users', () => {
			const allUsers = Array.from(sessionState.users.values())
			const botUsers = allUsers.filter(u => u.bot)
			const nonBotUsers = allUsers.filter(u => !u.bot)

			// Should have at least the default bot + any added bots
			expect(botUsers.length).toBeGreaterThanOrEqual(1)
			// Should have the users we added
			expect(nonBotUsers.length).toBeGreaterThanOrEqual(3)
		})
	})

	describe('Bot messages show correct bot identity', () => {
		let sessionState: SessionState
		let botA: MockUser
		let botB: MockUser
		let channelId: string

		beforeEach(() => {
			sessionState = createSessionState()

			const guild = createMockGuild({ name: 'Test Guild' })
			sessionState.addGuild(guild)
			const channel = createMockChannel({ name: 'general', guildId: guild.id })
			sessionState.addChannel(channel)
			channelId = channel.id

			// Create two different bots
			botA = createMockUser({ username: 'BotA', bot: true })
			botB = createMockUser({ username: 'BotB', bot: true })
			sessionState.addUser(botA)
			sessionState.addUser(botB)
		})

		it('should attribute message to specific bot when authorId matches', () => {
			// Message from Bot A
			const messageA = sessionState.createMessage({
				channelId,
				content: 'Hello from Bot A',
				authorId: botA.id
			})

			// Message from Bot B
			const messageB = sessionState.createMessage({
				channelId,
				content: 'Hello from Bot B',
				authorId: botB.id
			})

			expect(messageA.authorId).toBe(botA.id)
			expect(messageB.authorId).toBe(botB.id)
			expect(messageA.authorId).not.toBe(messageB.authorId)
		})

		it('should resolve correct bot user for message author', () => {
			const message = sessionState.createMessage({
				channelId,
				content: 'Test message',
				authorId: botA.id
			})

			const author = sessionState.getUser(message.authorId)

			expect(author).toBeDefined()
			expect(author?.username).toBe('BotA')
			expect(author?.bot).toBe(true)
		})
	})

	describe('User messages from different browsers', () => {
		let sessionState: SessionState
		let channelId: string
		let alice: MockUser
		let bob: MockUser

		beforeEach(() => {
			sessionState = createSessionState()

			const guild = createMockGuild({ name: 'Test Guild' })
			sessionState.addGuild(guild)
			const channel = createMockChannel({ name: 'general', guildId: guild.id })
			sessionState.addChannel(channel)
			channelId = channel.id

			alice = createMockUser({ username: 'Alice', bot: false })
			bob = createMockUser({ username: 'Bob', bot: false })
			sessionState.addUser(alice)
			sessionState.addUser(bob)
		})

		it('should allow messages from different users', () => {
			// Browser 1: Alice sends message
			const aliceMessage = sessionState.createMessage({
				channelId,
				content: 'Hello from Alice',
				authorId: alice.id
			})

			// Browser 2: Bob sends message
			const bobMessage = sessionState.createMessage({
				channelId,
				content: 'Hello from Bob',
				authorId: bob.id
			})

			expect(aliceMessage.authorId).toBe(alice.id)
			expect(bobMessage.authorId).toBe(bob.id)
		})

		it('should correctly resolve message authors', () => {
			const message = sessionState.createMessage({
				channelId,
				content: 'Test',
				authorId: alice.id
			})

			const author = sessionState.getUser(message.authorId)
			expect(author?.username).toBe('Alice')
			expect(author?.bot).toBe(false)
		})
	})

	describe('Mixed bot and user interactions', () => {
		let sessionState: SessionState
		let channelId: string
		let bot: MockUser
		let user: MockUser

		beforeEach(() => {
			sessionState = createSessionState()

			const guild = createMockGuild({ name: 'Test Guild' })
			sessionState.addGuild(guild)
			const channel = createMockChannel({ name: 'general', guildId: guild.id })
			sessionState.addChannel(channel)
			channelId = channel.id

			bot = createMockUser({ username: 'TestBot', bot: true })
			user = createMockUser({ username: 'TestUser', bot: false })
			sessionState.addUser(bot)
			sessionState.addUser(user)
		})

		it('should handle user message followed by bot response', () => {
			// User sends message
			sessionState.createMessage({
				channelId,
				content: '!hello',
				authorId: user.id
			})

			// Bot responds
			sessionState.createMessage({
				channelId,
				content: 'Hello, TestUser!',
				authorId: bot.id
			})

			// Verify message order and authors
			const messages = sessionState.getMessagesForChannel(channelId)
			expect(messages.length).toBe(2)

			const userAuthor = sessionState.getUser(messages[0].authorId)
			const botAuthor = sessionState.getUser(messages[1].authorId)

			expect(userAuthor?.bot).toBe(false)
			expect(botAuthor?.bot).toBe(true)
		})

		it('should correctly distinguish bot and user messages', () => {
			sessionState.createMessage({ channelId, content: 'User 1', authorId: user.id })
			sessionState.createMessage({ channelId, content: 'Bot 1', authorId: bot.id })
			sessionState.createMessage({ channelId, content: 'User 2', authorId: user.id })
			sessionState.createMessage({ channelId, content: 'Bot 2', authorId: bot.id })

			const messages = sessionState.getMessagesForChannel(channelId)

			const botMessages = messages.filter(m => {
				const author = sessionState.getUser(m.authorId)
				return author?.bot === true
			})

			const userMessages = messages.filter(m => {
				const author = sessionState.getUser(m.authorId)
				return author?.bot === false
			})

			expect(botMessages.length).toBe(2)
			expect(userMessages.length).toBe(2)
		})
	})

	describe('ConnectionState with bot identity', () => {
		it('should store and retrieve bot identity from connection state', () => {
			const connState: ConnectionState = {
				id: 'conn_123',
				sessionId: 'sess_456',
				identified: true,
				token: 'mock:sess_456',
				intents: 513,
				sequence: 5,
				lastAckSequence: 4,
				lastHeartbeat: Date.now(),
				heartbeatInterval: 41250,
				missedHeartbeats: 0,
				botUser: createMockUser({ username: 'ConnectedBot', bot: true }),
				realToken: 'real_discord_token_here'
			}

			expect(connState.botUser).toBeDefined()
			expect(connState.botUser?.username).toBe('ConnectedBot')
			expect(connState.realToken).toBe('real_discord_token_here')
		})

		it('should allow updating bot identity after identification', () => {
			const connState: ConnectionState = {
				id: 'conn_123',
				sessionId: 'sess_456',
				identified: false,
				token: null,
				intents: 0,
				sequence: 0,
				lastAckSequence: null,
				lastHeartbeat: Date.now(),
				heartbeatInterval: 41250,
				missedHeartbeats: 0
			}

			// Simulate identification
			connState.identified = true
			connState.token = 'mock:sess_456'
			connState.intents = 513
			connState.botUser = createMockUser({ username: 'IdentifiedBot', bot: true })

			expect(connState.identified).toBe(true)
			expect(connState.botUser?.username).toBe('IdentifiedBot')
		})
	})

	describe('Stage UI displays correct identities', () => {
		it('should include bot identity in READY for Stage UI consumption', () => {
			const sessionState = createSessionState()
			const specificBot = createMockUser({ username: 'SpecificBot', bot: true })

			const ready = buildReadyPayload({
				sessionState,
				connectionSessionId: 'test-conn',
				connectionBotUser: specificBot
			})

			const data = ready.d as Record<string, unknown>
			const user = data.user as MockUser

			// Stage UI receives the bot identity in READY
			expect(user.username).toBe('SpecificBot')
			expect(user.id).toBe(specificBot.id)
		})

		it('should maintain session-level data while supporting per-connection bot', () => {
			const sessionState = createSessionState({
				botUser: { username: 'SessionBot', bot: true }
			})

			// Add some guilds
			const guild = createMockGuild({ name: 'Test Guild' })
			sessionState.addGuild(guild)

			// Connection-specific bot
			const connBot = createMockUser({ username: 'ConnectionBot', bot: true })

			const ready = buildReadyPayload({
				sessionState,
				connectionSessionId: 'test-conn',
				connectionBotUser: connBot
			})

			const data = ready.d as Record<string, unknown>

			// Uses connection-specific bot
			expect((data.user as MockUser).username).toBe('ConnectionBot')

			// But still has session-level guilds
			expect((data.guilds as unknown[]).length).toBe(1)

			// And session-level application ID
			expect((data.application as { id: string }).id).toBe(sessionState.applicationId)
		})
	})
})
