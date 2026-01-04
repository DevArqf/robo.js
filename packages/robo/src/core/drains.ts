// Node.js-specific drain utilities
// Import from 'robo.js/logger/drains'

export { createFileDrain, formatTimestamp } from './file-drain.js'
export { createMultiDrain, createLevelFilteredDrain } from './logger.js'
export type { FileDrainOptions, TimestampFormat, FileOutputConfig, DrainHandle } from '../types/config.js'
export type { LogDrain } from './logger.js'
