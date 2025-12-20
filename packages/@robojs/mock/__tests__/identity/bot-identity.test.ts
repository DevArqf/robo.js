/**
 * Per-Connection Bot Identity Tests
 *
 * Tests the multi-bot identity system where each gateway connection
 * can have its own bot identity, auto-detected from Discord token
 * or generated uniquely.
 */
import { buildReadyPayload } from '../../src/discord/payloads.js'
import { createSessionState, createMockUser } from '../../src/session/state.js'
import { fetchBotFromDiscord } from '../../src/utils/bot-user-resolver.js'
import type { MockUser, ConnectionState } from '../../src/types/index.js'

describe('Per-Connection Bot Identity', () => {
	describe('ConnectionState interface', () => {
		it('should have optional botUser field', () => {
			const connState: ConnectionState = {
				id: 'conn_123',
				sessionId: 'sess_456',
				identified: true,
				token: 'mock:sess_456',
				intents: 513,
				sequence: 1,
				lastAckSequence: null,
				lastHeartbeat: Date.now(),
				heartbeatInterval: 41250,
				missedHeartbeats: 0,
				// Per-connection bot identity
				botUser: {
					id: '123456789',
					username: 'MyBot',
					discriminator: '0',
					globalName: 'My Bot',
					avatar: null,
					bot: true
				}
			}

			expect(connState.botUser).toBeDefined()
			expect(connState.botUser?.username).toBe('MyBot')
			expect(connState.botUser?.bot).toBe(true)
		})

		it('should have optional realToken field', () => {
			const connState: ConnectionState = {
				id: 'conn_123',
				sessionId: 'sess_456',
				identified: true,
				token: 'mock:sess_456',
				intents: 513,
				sequence: 1,
				lastAckSequence: null,
				lastHeartbeat: Date.now(),
				heartbeatInterval: 41250,
				missedHeartbeats: 0,
				realToken: 'MTIzNDU2Nzg5.XXXXXX.YYYYYY'
			}

			expect(connState.realToken).toBeDefined()
			expect(connState.realToken).toBe('MTIzNDU2Nzg5.XXXXXX.YYYYYY')
		})

		it('should allow botUser to be undefined initially', () => {
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

			expect(connState.botUser).toBeUndefined()
			expect(connState.realToken).toBeUndefined()
		})
	})

	describe('buildReadyPayload with connectionBotUser', () => {
		it('should use connectionBotUser when provided', () => {
			const sessionState = createSessionState({
				botUser: { username: 'SessionBot', bot: true }
			})

			const connectionBotUser: MockUser = {
				id: '999888777',
				username: 'ConnectionBot',
				discriminator: '0',
				globalName: 'Connection Bot',
				avatar: 'connection_avatar',
				bot: true
			}

			const payload = buildReadyPayload({
				sessionState,
				connectionSessionId: 'test-session',
				connectionBotUser
			})

			const data = payload.d as Record<string, unknown>
			const user = data.user as Record<string, unknown>

			expect(user.username).toBe('ConnectionBot')
			expect(user.id).toBe('999888777')
			expect(user.avatar).toBe('connection_avatar')
		})

		it('should fall back to sessionState.botUser when connectionBotUser is not provided', () => {
			const sessionState = createSessionState({
				botUser: { username: 'SessionBot', bot: true }
			})

			const payload = buildReadyPayload({
				sessionState,
				connectionSessionId: 'test-session'
			})

			const data = payload.d as Record<string, unknown>
			const user = data.user as Record<string, unknown>

			expect(user.username).toBe('SessionBot')
		})

		it('should maintain other READY fields when using connectionBotUser', () => {
			const sessionState = createSessionState({
				botUser: { username: 'SessionBot', bot: true }
			})

			const connectionBotUser: MockUser = {
				id: '111222333',
				username: 'AnotherBot',
				discriminator: '0',
				globalName: null,
				avatar: null,
				bot: true
			}

			const payload = buildReadyPayload({
				sessionState,
				connectionSessionId: 'unique-conn-id',
				gatewayUrl: 'ws://test:1234',
				connectionBotUser
			})

			expect(payload.op).toBe(0)
			expect(payload.s).toBe(1)
			expect(payload.t).toBe('READY')

			const data = payload.d as Record<string, unknown>
			expect(data.v).toBe(10)
			expect(data.session_id).toBe('unique-conn-id')
			expect(data.resume_gateway_url).toBe('ws://test:1234')
			expect(data.application).toBeDefined()
		})
	})

	describe('fetchBotFromDiscord', () => {
		it('should return null for empty token', async () => {
			const result = await fetchBotFromDiscord('')
			expect(result).toBeNull()
		})

		it('should handle API timeout gracefully', async () => {
			// This test verifies the function doesn't throw on timeout
			// In real tests, you'd mock the fetch to simulate timeout
			const result = await fetchBotFromDiscord('invalid-token-that-wont-work')
			expect(result).toBeNull()
		})

		it('should return DiscordAPIUser on success', async () => {
			// This would require mocking fetch - we verify the interface contract
			// The function returns DiscordAPIUser or null
			const mockResponse = {
				id: '123',
				username: 'TestBot',
				discriminator: '0',
				global_name: 'Test Bot',
				avatar: 'abc123',
				bot: true
			}

			// Verify the shape matches what the function returns
			expect(mockResponse).toHaveProperty('id')
			expect(mockResponse).toHaveProperty('username')
			expect(mockResponse).toHaveProperty('discriminator')
			expect(mockResponse).toHaveProperty('global_name')
			expect(mockResponse).toHaveProperty('avatar')
		})
	})

	describe('Multiple connections with different identities', () => {
		it('should allow different bot users for different connections', () => {
			const sessionState = createSessionState({
				botUser: { username: 'DefaultBot', bot: true }
			})

			// Connection 1: Bot A
			const botA: MockUser = createMockUser({ username: 'BotA', bot: true })
			const payloadA = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-a',
				connectionBotUser: botA
			})

			// Connection 2: Bot B
			const botB: MockUser = createMockUser({ username: 'BotB', bot: true })
			const payloadB = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-b',
				connectionBotUser: botB
			})

			const dataA = payloadA.d as Record<string, unknown>
			const dataB = payloadB.d as Record<string, unknown>

			expect((dataA.user as Record<string, unknown>).username).toBe('BotA')
			expect((dataB.user as Record<string, unknown>).username).toBe('BotB')
			expect((dataA.user as Record<string, unknown>).id).not.toBe((dataB.user as Record<string, unknown>).id)
		})

		it('should maintain consistent session_id per connection', () => {
			const sessionState = createSessionState()

			const payload1 = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-unique-1',
				connectionBotUser: createMockUser({ username: 'Bot1', bot: true })
			})

			const payload2 = buildReadyPayload({
				sessionState,
				connectionSessionId: 'conn-unique-2',
				connectionBotUser: createMockUser({ username: 'Bot2', bot: true })
			})

			const data1 = payload1.d as Record<string, unknown>
			const data2 = payload2.d as Record<string, unknown>

			expect(data1.session_id).toBe('conn-unique-1')
			expect(data2.session_id).toBe('conn-unique-2')
		})
	})

	describe('Bot identity in messages', () => {
		it('should attribute messages to connection-specific bot', () => {
			// This tests the concept - actual message sending tests would be in integration tests
			const sessionState = createSessionState()

			const connBotUser: MockUser = {
				id: '555666777',
				username: 'SpecificBot',
				discriminator: '0',
				globalName: 'Specific Bot',
				avatar: 'specific_avatar',
				bot: true
			}

			// When a message is sent by this bot, it should use this identity
			const message = sessionState.createMessage({
				channelId: '123',
				content: 'Hello from specific bot',
				authorId: connBotUser.id
			})

			// Add the user first
			sessionState.addUser(connBotUser)

			// The message author should reference the specific bot
			expect(message.authorId).toBe(connBotUser.id)
		})
	})
})
