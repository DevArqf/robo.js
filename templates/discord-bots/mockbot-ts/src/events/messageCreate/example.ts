import { logger } from 'robo.js'
import type { Message } from 'discord.js'

let count = 0

/**
 * All files under the `messageCreate` event folder will be called whenever a message is created in a channel or DM.
 * If `message.content` is empty, you may need to enable "Message Content Intent" in the Discord Developer Portal.
 *
 * Learn more about Discord events:
 * https://robojs.dev/discord-bots/events
 */
export default (message: Message) => {
	//if (message.author.bot) {
	//	logger.info('Bot message, skipping')
	//	return
	//}
	logger.info(`${message.author} sent message: ${message.content}`)
	count++
	message.reply('Hello, world!\n > ' + message.content + '\n > Count: ' + count)
}
