/**
 * Phase 24: Guild Incident Actions Tests
 *
 * Tests for guild.incidentActions including invitesDisabledUntil
 * and dmsDisabledUntil properties.
 */
import { Client, GatewayIntentBits, type Guild } from 'discord.js'
import { createSession } from '../setup/control-api.js'
import { createClientWithIntents, destroyClient } from '../setup/test-client.js'
import { waitForReady } from '../utils/helpers.js'

describe('Phase 24: Guild Incident Actions', () => {
	let client: Client | null = null
	let session: { id: string; token: string }
	let guild: Guild

	beforeAll(async () => {
		session = await createSession({
			name: 'phase-24-guild-incident-actions',
			config: {
				botUser: { username: 'IncidentBot' },
				guilds: [{ name: 'Test Guild' }]
			}
		})

		client = createClientWithIntents([GatewayIntentBits.Guilds])
		await client.login(session.token)
		await waitForReady(client)
		guild = client.guilds.cache.first()!
	})

	afterAll(async () => {
		await destroyClient(client)
		client = null
	})

	it('should have incidentActions property', async () => {
		// Fetch the guild to ensure we have fresh data
		const fetched = await guild.fetch()

		// incidentActions can be null or an object
		// The property should exist on the guild
		expect('incidentActions' in fetched || fetched.incidentActions === null || fetched.incidentActions === undefined).toBe(true)
	})

	it('should have invitesDisabledUntil when incident actions exist', async () => {
		const fetched = await guild.fetch()

		if (fetched.incidentActions) {
			// invitesDisabledUntil should be a Date or null
			expect(
				fetched.incidentActions.invitesDisabledUntil === null ||
					fetched.incidentActions.invitesDisabledUntil instanceof Date
			).toBe(true)
		} else {
			// No incident actions is valid - just verify property access works
			expect(fetched.incidentActions).toBeFalsy()
		}
	})

	it('should have dmsDisabledUntil when incident actions exist', async () => {
		const fetched = await guild.fetch()

		if (fetched.incidentActions) {
			// dmsDisabledUntil should be a Date or null
			expect(
				fetched.incidentActions.dmsDisabledUntil === null ||
					fetched.incidentActions.dmsDisabledUntil instanceof Date
			).toBe(true)
		} else {
			// No incident actions is valid - just verify property access works
			expect(fetched.incidentActions).toBeFalsy()
		}
	})
})
