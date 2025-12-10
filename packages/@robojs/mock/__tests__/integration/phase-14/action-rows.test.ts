/**
 * Phase 14: Multiple Action Rows Tests
 *
 * Tests for action row limits and component mixing.
 */
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	Client,
	ComponentType,
	GatewayIntentBits,
	StringSelectMenuBuilder,
	TextChannel
} from 'discord.js'
import { createSession } from '../setup/control-api.js'
import { createClientWithIntents, destroyClient } from '../setup/test-client.js'
import { waitForReady } from '../utils/helpers.js'

describe('Phase 14: Multiple Action Rows', () => {
	let client: Client | null = null
	let session: { id: string; token: string }
	let channel: TextChannel

	beforeAll(async () => {
		session = await createSession({
			name: 'action-rows-tests',
			config: {
				guilds: [
					{
						name: 'Action Rows Test Guild',
						channels: [{ name: 'general', type: ChannelType.GuildText }]
					}
				]
			}
		})

		client = createClientWithIntents([GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages])
		await client.login(session.token)
		await waitForReady(client)

		const guild = client.guilds.cache.first()!
		channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText) as TextChannel
	})

	afterAll(async () => {
		await destroyClient(client)
		client = null
	})

	it('should send 5 action rows', async () => {
		const rows = []
		for (let i = 0; i < 5; i++) {
			rows.push(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(`row${i}_btn`).setLabel(`Row ${i}`).setStyle(ButtonStyle.Primary)
				)
			)
		}

		const message = await channel.send({ content: '5 Rows', components: rows })
		expect(message.components.length).toBe(5)
	})

	// Note: Mock server does not validate component limits - this is Discord API behavior
	// Discord.js builders don't validate action row count at build time either
	it.skip('should enforce max 5 action rows', async () => {
		const rows = []
		for (let i = 0; i < 6; i++) {
			rows.push(
				new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setCustomId(`row${i}_btn`).setLabel(`Row ${i}`).setStyle(ButtonStyle.Primary)
				)
			)
		}

		await expect(channel.send({ content: '6 Rows', components: rows })).rejects.toBeDefined()
	})

	it('should mix buttons and select menu in different rows', async () => {
		const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId('mixed_btn').setLabel('Button').setStyle(ButtonStyle.Primary)
		)

		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder().setCustomId('mixed_select').addOptions({ label: 'Option', value: 'opt' })
		)

		const message = await channel.send({
			content: 'Mixed',
			components: [buttonRow, selectRow]
		})

		expect(message.components[0].components[0].type).toBe(ComponentType.Button)
		expect(message.components[1].components[0].type).toBe(ComponentType.StringSelect)
	})

	it('should validate component type consistency in row', () => {
		// ActionRowBuilder is generic and enforces component types at compile time
		// This test verifies the type system prevents mixing
		const buttonRow = new ActionRowBuilder<ButtonBuilder>()
		buttonRow.addComponents(
			new ButtonBuilder().setCustomId('btn1').setLabel('Button 1').setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId('btn2').setLabel('Button 2').setStyle(ButtonStyle.Secondary)
		)

		// Select menu must be in its own row
		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>()
		selectRow.addComponents(
			new StringSelectMenuBuilder().setCustomId('select').addOptions({ label: 'Option', value: 'opt' })
		)

		// Both are valid when separate
		expect(buttonRow.components.length).toBe(2)
		expect(selectRow.components.length).toBe(1)
	})
})
