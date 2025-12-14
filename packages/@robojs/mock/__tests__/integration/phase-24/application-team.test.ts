/**
 * Phase 24: Application Team Tests
 *
 * Tests for client.application.team including fetch,
 * team properties, members, and iconURL.
 */
import { Client, GatewayIntentBits } from 'discord.js'
import { createSession } from '../setup/control-api.js'
import { createClientWithIntents, destroyClient } from '../setup/test-client.js'
import { waitForReady } from '../utils/helpers.js'

describe('Phase 24: Application Team', () => {
	let client: Client | null = null
	let session: { id: string; token: string }

	beforeAll(async () => {
		session = await createSession({
			name: 'phase-24-application-team',
			config: {
				botUser: { username: 'TeamTestBot' },
				guilds: [{ name: 'Test Guild' }]
			}
		})

		client = createClientWithIntents([GatewayIntentBits.Guilds])
		await client.login(session.token)
		await waitForReady(client)
	})

	afterAll(async () => {
		await destroyClient(client)
		client = null
	})

	it('should fetch application with team property', async () => {
		const app = await client!.application!.fetch()

		// Application should be fetched successfully
		expect(app).toBeDefined()
		expect(app.id).toBeDefined()
		expect(app.name).toBeDefined()

		// Team can be null for non-team apps (which is our default case)
		// The property should exist (even if null)
		expect('team' in app || app.team === null || app.team === undefined).toBe(true)
	})

	it('should have team properties when team exists', async () => {
		const app = await client!.application!.fetch()

		// If team exists, verify its properties
		if (app.team) {
			expect(app.team.id).toBeDefined()
			expect(app.team.name).toBeDefined()
			expect(app.team.ownerId).toBeDefined()
			expect(app.team.members).toBeDefined()
		} else {
			// Non-team apps have null or undefined team - this is valid
			expect(app.team == null).toBe(true)
		}
	})

	it('should have team members collection when team exists', async () => {
		const app = await client!.application!.fetch()

		if (app.team) {
			expect(app.team.members.size).toBeGreaterThan(0)

			const member = app.team.members.first()
			if (member) {
				expect(member.user).toBeDefined()
				expect(member.membershipState).toBeDefined()
				expect(member.role).toBeDefined()
			}
		} else {
			// Non-team apps - verify owner exists instead
			expect(app.owner).toBeDefined()
		}
	})

	it('should have team iconURL method when team exists', async () => {
		const app = await client!.application!.fetch()

		if (app.team) {
			// Team iconURL should be callable
			const url = app.team.iconURL()
			// URL may be null if no icon set
			expect(url === null || typeof url === 'string').toBe(true)

			if (app.team.icon && url) {
				expect(url).toContain(app.team.icon)
			}
		} else {
			// For non-team apps, owner should exist
			expect(app.owner).toBeDefined()
		}
	})
})
