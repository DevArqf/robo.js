import type { Config, FlashcoreAdapter } from './index.js'
import type Keyv from 'keyv'

interface Flashcore {
  _adapter: FlashcoreAdapter | Keyv<unknown, unknown> | null
}

interface RoboGlobal {
  config: Config | null
  flashcore: Flashcore
}

declare global {
  var robo: RoboGlobal
}
