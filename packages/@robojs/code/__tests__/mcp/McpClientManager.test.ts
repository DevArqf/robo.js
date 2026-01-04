/**
 * Tests for McpClientManager
 *
 * Verifies:
 * - MCP configuration handling
 * - Disabled/empty configuration edge cases
 * - Discovery URL validation
 * - Error handling for missing dependencies
 *
 * Note: Integration tests requiring actual MCP connections should be
 * in a separate integration test file with real or mock MCP servers.
 */

import { jest } from '@jest/globals'
import { McpClientManager, createMcpClientManager } from '../../src/mcp/McpClientManager.js'
import type { McpConfig } from '../../src/mcp/types.js'
import type { ExecutionProvider, LocalServiceDiscovery } from '../../src/types/execution.js'

describe('McpClientManager', () => {
	let mockProvider: ExecutionProvider
	let mockServiceDiscovery: LocalServiceDiscovery

	beforeEach(() => {
		jest.clearAllMocks()

		mockProvider = {
			readFile: jest.fn(),
			writeFile: jest.fn(),
			deletePath: jest.fn(),
			exists: jest.fn(),
			readdir: jest.fn(),
			mkdir: jest.fn(),
			search: jest.fn(),
			snapshot: jest.fn(),
			stat: jest.fn(),
			run: jest.fn(),
			runStream: jest.fn(),
			startSession: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'session-123' }),
			stopSession: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
			streamSession: jest.fn()
		} as unknown as ExecutionProvider

		mockServiceDiscovery = {
			start: jest.fn<() => Promise<{ serviceId: string }>>().mockResolvedValue({ serviceId: 'service-123' }),
			waitForUrl: jest.fn<() => Promise<{ url: string }>>().mockResolvedValue({ url: 'http://localhost:3000' }),
			stop: jest.fn<() => Promise<void>>().mockResolvedValue(undefined)
		} as unknown as LocalServiceDiscovery
	})

	describe('constructor', () => {
		it('should create manager with config', () => {
			const config: McpConfig = {
				enabled: true,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			expect(manager).toBeInstanceOf(McpClientManager)
		})

		it('should create manager with disabled config', () => {
			const config: McpConfig = {
				enabled: false,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			expect(manager).toBeInstanceOf(McpClientManager)
			expect(manager.isConnected()).toBe(false)
		})
	})

	describe('connect - edge cases', () => {
		it('should skip connection when MCP is disabled', async () => {
			const config: McpConfig = {
				enabled: false,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			await manager.connect()

			expect(manager.isConnected()).toBe(false)
			expect(manager.getTools()).toHaveLength(0)
		})

		it('should skip connection when no servers configured', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			await manager.connect()

			expect(manager.isConnected()).toBe(false)
		})

		it('should handle missing service discovery for discovered URLs', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {
					localServer: {
						transport: 'streamable_http',
						url: '__DISCOVERED__',
						startCommand: { command: 'node', args: ['mcp.js'] }
					}
				}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
				// No serviceDiscovery provided
			})

			await manager.connect()

			const info = manager.getServerInfo('localServer')
			expect(info?.status).toBe('error')
			expect(info?.error).toContain('LocalServiceDiscovery')
		})

		it('should fail if startCommand is missing for discovered URL', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {
					localMcp: {
						transport: 'streamable_http',
						url: '__DISCOVERED__'
						// No startCommand
					}
				}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider,
				serviceDiscovery: mockServiceDiscovery
			})

			await manager.connect()

			const info = manager.getServerInfo('localMcp')
			expect(info?.status).toBe('error')
			expect(info?.error).toContain('startCommand')
		})
	})

	describe('getTools - before connect', () => {
		it('should return empty array before connect', () => {
			const config: McpConfig = {
				enabled: true,
				servers: {
					server1: {
						transport: 'streamable_http',
						url: 'https://api.example.com/mcp'
					}
				}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			expect(manager.getTools()).toHaveLength(0)
		})
	})

	describe('getTool - before connect', () => {
		it('should return undefined before connect', () => {
			const config: McpConfig = {
				enabled: true,
				servers: {
					server1: {
						transport: 'streamable_http',
						url: 'https://api.example.com/mcp'
					}
				}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			const tool = manager.getTool('server1__tool1')
			expect(tool).toBeUndefined()
		})
	})

	describe('disconnect', () => {
		it('should handle disconnect when not connected', async () => {
			const config: McpConfig = {
				enabled: false,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			// Should not throw
			await expect(manager.disconnect()).resolves.not.toThrow()
		})

		it('should handle disconnect after failed connect', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {
					localServer: {
						transport: 'streamable_http',
						url: '__DISCOVERED__'
						// Missing startCommand will cause connect to fail
					}
				}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider,
				serviceDiscovery: mockServiceDiscovery
			})

			await manager.connect()
			// Connect should have failed, now disconnect
			await expect(manager.disconnect()).resolves.not.toThrow()
		})
	})

	describe('getServerInfo', () => {
		it('should return undefined for unknown server', () => {
			const config: McpConfig = {
				enabled: true,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			const info = manager.getServerInfo('unknown')
			expect(info).toBeUndefined()
		})
	})

	describe('getServerInfos', () => {
		it('should return empty array when no servers configured', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			await manager.connect()

			const infos = manager.getServerInfos()
			expect(infos).toHaveLength(0)
		})
	})

	describe('isConnected', () => {
		it('should return false when disabled', async () => {
			const config: McpConfig = {
				enabled: false,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			await manager.connect()
			expect(manager.isConnected()).toBe(false)
		})

		it('should return false when no servers', async () => {
			const config: McpConfig = {
				enabled: true,
				servers: {}
			}

			const manager = createMcpClientManager({
				config,
				provider: mockProvider
			})

			await manager.connect()
			expect(manager.isConnected()).toBe(false)
		})
	})
})
