/**
 * Mock for @robojs/server used by @robojs/discordjs tests.
 */

import { jest } from '@jest/globals'

export const ready = jest.fn<() => Promise<void>>().mockResolvedValue(undefined)

export default { ready }
