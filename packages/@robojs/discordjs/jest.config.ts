import type { Config } from 'jest'

const config: Config = {
	testEnvironment: 'node',
	extensionsToTreatAsEsm: ['.ts'],
	testMatch: ['**/__tests__/**/*.test.ts'],
	testPathIgnorePatterns: ['/node_modules/', '/dist/', '/.robo/'],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				useESM: true,
				tsconfig: {
					module: 'ESNext',
					moduleResolution: 'bundler',
					esModuleInterop: true,
					allowSyntheticDefaultImports: true
				}
			}
		]
	},
	moduleNameMapper: {
		// Map robo.js imports to our mock
		'^robo\\.js$': '<rootDir>/__mocks__/robo.js.ts',
		'^robo\\.js/(.*)$': '<rootDir>/__mocks__/robo.js.ts',
		// Strip .js extensions for TypeScript imports
		'^(\\.{1,2}/.*)\\.js$': '$1'
	},
	// Clear mocks between tests
	clearMocks: true,
	// Collect coverage from src
	collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
	coverageDirectory: 'coverage'
}

export default config
