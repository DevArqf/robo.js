import type { Config, FlashcoreAdapter } from '../types/index.js'
import type Keyv from 'keyv'

const instanceId = Math.random().toString(36).slice(2)

export const Globals = {
	getConfig: () => {
		if (!globalThis.robo) {
			Globals.init()
		}

		return globalThis.robo.config
	},
	getFlashcoreAdapter: () => {
		if (!globalThis.robo) {
			Globals.init()
		}

		return globalThis.robo.flashcore._adapter
	},
	init: () => {
		globalThis.robo = {
			config: null,
			flashcore: {
				_adapter: null
			}
		}
	},
	instanceId,
	registerConfig: (config: Config) => {
		if (!globalThis.robo) {
			Globals.init()
		}

		globalThis.robo.config = config
	},
	registerFlashcore: (adapter: FlashcoreAdapter | Keyv<unknown, unknown>) => {
		if (!globalThis.robo) {
			Globals.init()
		}

		globalThis.robo.flashcore._adapter = adapter
	}
}
