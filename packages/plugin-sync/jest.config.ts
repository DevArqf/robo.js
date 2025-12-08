import type { Config } from 'jest'

const config: Config = {
	testEnvironment: 'node',
	verbose: true,
	extensionsToTreatAsEsm: ['.ts'],
	testMatch: ['**/__tests__/**/*.test.ts'],
	setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
	transform: {
		'^.+\\.ts?$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					module: 'ESNext',
					target: 'ES2022',
					skipLibCheck: true
				}
			}
		]
	},
	moduleNameMapper: {
		// Map robo.js imports to our mock
		'^robo\\.js$': '<rootDir>/__mocks__/robo.js.ts',
		'^robo\\.js/(.*)$': '<rootDir>/__mocks__/robo.js.ts',
		// Map @robojs/server to our mock
		'^@robojs/server$': '<rootDir>/__mocks__/@robojs/server.ts',
		'^@robojs/server/(.*)$': '<rootDir>/__mocks__/@robojs/server.ts',
		// Handle .js extensions in ESM imports
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	modulePaths: ['<rootDir>/.robo/build', '<rootDir>/__tests__'],
	testPathIgnorePatterns: ['<rootDir>/.robo/', '<rootDir>/__tests__/helpers/'],
	watchPathIgnorePatterns: ['<rootDir>/.robo/']
}

export default config
