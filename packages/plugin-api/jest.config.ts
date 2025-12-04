import type { Config } from 'jest'

const config: Config = {
	testEnvironment: 'node',
	verbose: true,
	extensionsToTreatAsEsm: ['.ts'],
	transform: {
		'^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: { module: 'ESNext', target: 'ES2022' } }]
	},
	transformIgnorePatterns: ['/node_modules/(?!(robo\\.js)/)'],
	testPathIgnorePatterns: ['<rootDir>/__typetests__/', '<rootDir>/__tests__/fixtures/'],
	watchPathIgnorePatterns: ['<rootDir>/__typetests__/', '<rootDir>/__tests__/fixtures/'],
	moduleNameMapper: {
		'^(\\.{1,2}/.*)\\.js$': '$1'
	}
}

export default config
