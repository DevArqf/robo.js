/**
 * Unit tests for terminal buffer utilities
 */

import {
	TerminalBuffer,
	TerminalBufferManager,
	createTerminalBuffer,
	DEFAULT_MAX_BUFFER_BYTES,
	type TruncationEvent
} from '../../../src/providers/utils/buffer.js'

describe('TerminalBuffer', () => {
	describe('basic operations', () => {
		it('should create a buffer with default max bytes', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: DEFAULT_MAX_BUFFER_BYTES })
			expect(buffer.getCurrentBytes()).toBe(0)
			expect(buffer.getContent()).toBe('')
		})

		it('should append data correctly', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 1000 })
			buffer.append('hello')
			expect(buffer.getContent()).toBe('hello')
			expect(buffer.getCurrentBytes()).toBe(5)
		})

		it('should accumulate multiple appends', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 1000 })
			buffer.append('hello')
			buffer.append(' ')
			buffer.append('world')
			expect(buffer.getContent()).toBe('hello world')
		})

		it('should track total processed bytes', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 1000 })
			buffer.append('hello')
			buffer.append('world')
			expect(buffer.getTotalProcessed()).toBe(10)
		})

		it('should handle empty appends', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 1000 })
			buffer.append('')
			expect(buffer.getContent()).toBe('')
			expect(buffer.getCurrentBytes()).toBe(0)
		})
	})

	describe('truncation behavior', () => {
		it('should truncate oldest content when buffer exceeds max', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 10 })
			buffer.append('hello') // 5 bytes
			buffer.append('world') // 5 bytes - now at 10
			buffer.append('!') // 1 byte - should trigger truncation

			expect(buffer.getCurrentBytes()).toBeLessThanOrEqual(10)
			expect(buffer.wasTruncated()).toBe(true)
		})

		it('should drop oldest chunks first', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 10 })
			buffer.append('aaa') // 3 bytes
			buffer.append('bbb') // 3 bytes
			buffer.append('ccc') // 3 bytes - now at 9
			buffer.append('ddd') // 3 bytes - should drop 'aaa'

			const content = buffer.getContent()
			expect(content).not.toContain('aaa')
			expect(content).toContain('ddd')
		})

		it('should track dropped bytes correctly', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 10 })
			buffer.append('12345') // 5 bytes
			buffer.append('67890') // 5 bytes - at 10
			const dropped = buffer.append('ABCDE') // 5 bytes - should drop first chunk

			expect(dropped).toBeGreaterThan(0)
			expect(buffer.getTotalDropped()).toBe(dropped)
		})

		it('should handle single chunk exceeding max', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 5 })
			buffer.append('hello world') // 11 bytes

			expect(buffer.getCurrentBytes()).toBeLessThanOrEqual(5)
			expect(buffer.wasTruncated()).toBe(true)
		})

		it('should emit truncation events', () => {
			const events: TruncationEvent[] = []
			const buffer = new TerminalBuffer({
				sessionId: 'test-session',
				maxBytes: 10,
				onTruncate: (event) => events.push(event)
			})

			buffer.append('hello') // 5 bytes
			buffer.append('world!') // 6 bytes - triggers truncation

			expect(events.length).toBeGreaterThan(0)
			expect(events[0].sessionId).toBe('test-session')
			expect(events[0].droppedBytes).toBeGreaterThan(0)
			expect(events[0].type).toBe('terminal_truncated')
		})

		it('should track cumulative dropped bytes in events', () => {
			const events: TruncationEvent[] = []
			const buffer = new TerminalBuffer({
				sessionId: 'test',
				maxBytes: 10,
				onTruncate: (event) => events.push(event)
			})

			buffer.append('12345') // 5
			buffer.append('67890') // 5 - at 10
			buffer.append('ABCDE') // triggers first truncation
			buffer.append('FGHIJ') // triggers second truncation

			expect(events.length).toBe(2)
			expect(events[1].totalDropped).toBeGreaterThan(events[0].totalDropped)
		})
	})

	describe('stats and state', () => {
		it('should report accurate stats', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 100 })
			buffer.append('hello world')

			const stats = buffer.getStats()
			expect(stats.currentBytes).toBe(11)
			expect(stats.maxBytes).toBe(100)
			expect(stats.totalProcessed).toBe(11)
			expect(stats.totalDropped).toBe(0)
			expect(stats.wasTruncated).toBe(false)
			expect(stats.chunkCount).toBe(1)
			expect(stats.utilizationPercent).toBe(11)
		})

		it('should update stats after truncation', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 10 })
			buffer.append('12345')
			buffer.append('67890')
			buffer.append('ABCDE')

			const stats = buffer.getStats()
			expect(stats.wasTruncated).toBe(true)
			expect(stats.totalDropped).toBeGreaterThan(0)
			expect(stats.totalProcessed).toBe(15)
		})

		it('should clear buffer content but keep lifetime stats', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 10 })
			buffer.append('12345')
			buffer.append('67890')
			buffer.append('ABCDE')

			const droppedBefore = buffer.getTotalDropped()
			buffer.clear()

			expect(buffer.getContent()).toBe('')
			expect(buffer.getCurrentBytes()).toBe(0)
			expect(buffer.getTotalDropped()).toBe(droppedBefore) // preserved
		})
	})

	describe('unicode handling', () => {
		it('should handle multi-byte UTF-8 characters', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 100 })
			buffer.append('日本語') // 9 bytes in UTF-8

			expect(buffer.getCurrentBytes()).toBe(9)
			expect(buffer.getContent()).toBe('日本語')
		})

		it('should truncate at byte boundaries', () => {
			const buffer = new TerminalBuffer({ sessionId: 'test', maxBytes: 15 })
			buffer.append('Hello') // 5 bytes
			buffer.append('日本語') // 9 bytes
			buffer.append('World') // 5 bytes - will trigger truncation

			expect(buffer.getCurrentBytes()).toBeLessThanOrEqual(15)
		})
	})
})

describe('createTerminalBuffer', () => {
	it('should create a buffer with defaults', () => {
		const buffer = createTerminalBuffer('test-session')
		expect(buffer.getStats().maxBytes).toBe(DEFAULT_MAX_BUFFER_BYTES)
	})

	it('should create a buffer with custom max bytes', () => {
		const buffer = createTerminalBuffer('test-session', 1000)
		expect(buffer.getStats().maxBytes).toBe(1000)
	})

	it('should attach truncation callback', () => {
		const events: TruncationEvent[] = []
		const buffer = createTerminalBuffer('test', 10, (e) => events.push(e))

		buffer.append('12345678901234567890')
		expect(events.length).toBeGreaterThan(0)
	})
})

describe('TerminalBufferManager', () => {
	it('should create and manage multiple buffers', () => {
		const manager = new TerminalBufferManager()
		const buffer1 = manager.getOrCreate('session-1')
		const buffer2 = manager.getOrCreate('session-2')

		buffer1.append('hello')
		buffer2.append('world')

		expect(manager.get('session-1')?.getContent()).toBe('hello')
		expect(manager.get('session-2')?.getContent()).toBe('world')
	})

	it('should return existing buffer for same session', () => {
		const manager = new TerminalBufferManager()
		const buffer1 = manager.getOrCreate('session-1')
		buffer1.append('hello')

		const buffer2 = manager.getOrCreate('session-1')
		expect(buffer2.getContent()).toBe('hello')
		expect(buffer1).toBe(buffer2)
	})

	it('should remove buffers', () => {
		const manager = new TerminalBufferManager()
		manager.getOrCreate('session-1')

		expect(manager.remove('session-1')).toBe(true)
		expect(manager.get('session-1')).toBeUndefined()
		expect(manager.remove('session-1')).toBe(false)
	})

	it('should clear all buffers', () => {
		const manager = new TerminalBufferManager()
		manager.getOrCreate('session-1')
		manager.getOrCreate('session-2')

		manager.clear()

		expect(manager.getSessionIds()).toHaveLength(0)
	})

	it('should list session IDs', () => {
		const manager = new TerminalBufferManager()
		manager.getOrCreate('session-a')
		manager.getOrCreate('session-b')
		manager.getOrCreate('session-c')

		const ids = manager.getSessionIds()
		expect(ids).toContain('session-a')
		expect(ids).toContain('session-b')
		expect(ids).toContain('session-c')
	})

	it('should provide aggregate stats', () => {
		const manager = new TerminalBufferManager(100)
		const buffer1 = manager.getOrCreate('session-1')
		const buffer2 = manager.getOrCreate('session-2')

		buffer1.append('hello')
		buffer2.append('world!')

		const stats = manager.getAggregateStats()
		expect(stats.sessionCount).toBe(2)
		expect(stats.totalCurrentBytes).toBe(11)
		expect(stats.totalProcessed).toBe(11)
	})

	it('should use default max bytes', () => {
		const manager = new TerminalBufferManager(500)
		const buffer = manager.getOrCreate('test')

		expect(buffer.getStats().maxBytes).toBe(500)
	})

	it('should share truncation callback', () => {
		const events: TruncationEvent[] = []
		const manager = new TerminalBufferManager(10, (e) => events.push(e))

		const buffer = manager.getOrCreate('test')
		buffer.append('12345678901234567890')

		expect(events.length).toBeGreaterThan(0)
	})

	it('should track truncated session count in aggregate stats', () => {
		const manager = new TerminalBufferManager(10)

		const buffer1 = manager.getOrCreate('session-1')
		const buffer2 = manager.getOrCreate('session-2')
		const buffer3 = manager.getOrCreate('session-3')

		buffer1.append('small')
		buffer2.append('this is way too long for the buffer')
		buffer3.append('also too long for the buffer limit')

		const stats = manager.getAggregateStats()
		expect(stats.truncatedCount).toBe(2)
	})
})
