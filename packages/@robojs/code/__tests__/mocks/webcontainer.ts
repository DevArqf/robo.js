/**
 * WebContainer mocks for unit testing
 *
 * Provides mock implementations of WebContainer API for Jest-based testing
 * without requiring a real browser environment.
 */

import { jest } from '@jest/globals'

/**
 * Mock directory entry
 */
export interface MockDirEntry {
	name: string
	_isDirectory: boolean
	_isFile: boolean
	isDirectory(): boolean
	isFile(): boolean
}

/**
 * Create a mock directory entry
 */
export function createMockDirEntry(name: string, isDir: boolean): MockDirEntry {
	return {
		name,
		_isDirectory: isDir,
		_isFile: !isDir,
		isDirectory() {
			return this._isDirectory
		},
		isFile() {
			return this._isFile
		}
	}
}

/**
 * Mock WebContainer filesystem
 */
export interface MockFS {
	files: Map<string, string | Uint8Array>
	directories: Set<string>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readFile: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	writeFile: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	rm: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	readdir: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mkdir: jest.Mock<any>
}

/**
 * Create a mock filesystem with working implementations
 */
export function createMockFS(): MockFS {
	const files = new Map<string, string | Uint8Array>()
	const directories = new Set<string>(['/'])

	const mockFS: MockFS = {
		files,
		directories,

		readFile: jest.fn(async (path: string, encoding?: 'utf-8') => {
			const content = files.get(path)
			if (content === undefined) {
				throw new Error(`ENOENT: no such file or directory, open '${path}'`)
			}
			if (encoding === 'utf-8') {
				return typeof content === 'string' ? content : new TextDecoder().decode(content)
			}
			return typeof content === 'string' ? new TextEncoder().encode(content) : content
		}),

		writeFile: jest.fn(async (path: string, data: string | Uint8Array) => {
			files.set(path, data)
		}),

		rm: jest.fn(async (path: string, options?: { recursive?: boolean; force?: boolean }) => {
			const isDir = directories.has(path)
			if (isDir) {
				// Check if directory has children
				const hasChildren = Array.from(files.keys()).some((f) => f.startsWith(path + '/'))
				const hasDirChildren = Array.from(directories).some((d) => d !== path && d.startsWith(path + '/'))

				if ((hasChildren || hasDirChildren) && !options?.recursive) {
					throw new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`)
				}

				// Remove all files and subdirectories
				for (const filePath of files.keys()) {
					if (filePath.startsWith(path + '/')) {
						files.delete(filePath)
					}
				}
				for (const dirPath of directories) {
					if (dirPath.startsWith(path + '/') || dirPath === path) {
						directories.delete(dirPath)
					}
				}
				directories.delete(path)
			} else if (files.has(path)) {
				files.delete(path)
			} else if (!options?.force) {
				throw new Error(`ENOENT: no such file or directory, unlink '${path}'`)
			}
		}),

		readdir: jest.fn(async (path: string, options?: { withFileTypes?: boolean }) => {
			if (!directories.has(path)) {
				throw new Error(`ENOENT: no such file or directory, scandir '${path}'`)
			}

			const entries: (string | MockDirEntry)[] = []
			const prefix = path === '/' ? '/' : path + '/'

			// Collect immediate children (files)
			for (const filePath of files.keys()) {
				if (filePath.startsWith(prefix)) {
					const remaining = filePath.slice(prefix.length)
					if (!remaining.includes('/')) {
						if (options?.withFileTypes) {
							entries.push(createMockDirEntry(remaining, false))
						} else {
							entries.push(remaining)
						}
					}
				}
			}

			// Collect immediate children (directories)
			for (const dirPath of directories) {
				if (dirPath !== path && dirPath.startsWith(prefix)) {
					const remaining = dirPath.slice(prefix.length)
					const firstSegment = remaining.split('/')[0]
					// Only include immediate children
					if (!remaining.includes('/') || remaining === firstSegment) {
						const exists = entries.some((e) => (typeof e === 'string' ? e : e.name) === firstSegment)
						if (!exists) {
							if (options?.withFileTypes) {
								entries.push(createMockDirEntry(firstSegment, true))
							} else {
								entries.push(firstSegment)
							}
						}
					}
				}
			}

			return entries
		}),

		mkdir: jest.fn(async (path: string, options?: { recursive?: boolean }) => {
			if (directories.has(path)) {
				return // Already exists
			}

			if (options?.recursive) {
				const parts = path.split('/').filter(Boolean)
				let current = ''
				for (const part of parts) {
					current += '/' + part
					directories.add(current)
				}
			} else {
				// Check parent exists
				const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
				if (!directories.has(parentPath)) {
					throw new Error(`ENOENT: no such file or directory, mkdir '${path}'`)
				}
				directories.add(path)
			}
		})
	}

	return mockFS
}

/**
 * Mock WebContainer process
 */
export interface MockProcess {
	output: ReadableStream<string>
	exit: Promise<number>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	kill: jest.Mock<any>
	_controller?: ReadableStreamDefaultController<string>
	_resolve?: (code: number) => void
}

/**
 * Create a mock process with controllable output
 */
export function createMockProcess(exitCode: number = 0, outputChunks: string[] = []): MockProcess {
	let controller: ReadableStreamDefaultController<string>
	let resolveExit: (code: number) => void

	const output = new ReadableStream<string>({
		start(ctrl) {
			controller = ctrl
			// Enqueue initial chunks
			for (const chunk of outputChunks) {
				controller.enqueue(chunk)
			}
		}
	})

	const exit = new Promise<number>((resolve) => {
		resolveExit = resolve
	})

	const process: MockProcess = {
		output,
		exit,
		kill: jest.fn(() => {
			try {
				controller?.close()
			} catch {
				// Already closed
			}
			resolveExit!(exitCode)
		}),
		_controller: undefined,
		_resolve: undefined
	}

	// Store references for external control
	process._controller = controller!
	process._resolve = resolveExit!

	return process
}

/**
 * Create a mock process that auto-completes
 */
export function createAutoCompletingProcess(exitCode: number = 0, output: string = ''): MockProcess {
	const chunks = output ? [output] : []
	const process = createMockProcess(exitCode, chunks)

	// Auto-complete after a tick
	setTimeout(() => {
		try {
			process._controller?.close()
		} catch {
			// Already closed
		}
		process._resolve!(exitCode)
	}, 0)

	return process
}

/**
 * Mock WebContainer instance
 */
export interface MockContainer {
	fs: MockFS
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	spawn: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	on: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	mount: jest.Mock<any>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	teardown: jest.Mock<any>
	_listeners: Map<string, Set<(...args: unknown[]) => void>>
	emit: (event: string, ...args: unknown[]) => void
}

/**
 * Create a mock WebContainer instance
 */
export function createMockContainer(fs?: MockFS): MockContainer {
	const mockFS = fs || createMockFS()
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>()

	const container: MockContainer = {
		fs: mockFS,

		spawn: jest.fn(async (_command: string, _args?: string[], _options?: unknown) => {
			return createAutoCompletingProcess(0, '')
		}),

		on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
			if (!listeners.has(event)) {
				listeners.set(event, new Set())
			}
			listeners.get(event)!.add(callback)
		}),

		mount: jest.fn(async (_tree: Record<string, unknown>) => {
			// Could populate fs from tree if needed
		}),

		teardown: jest.fn(() => {
			// Cleanup
		}),

		_listeners: listeners,

		emit: (event: string, ...args: unknown[]) => {
			const callbacks = listeners.get(event)
			if (callbacks) {
				for (const cb of callbacks) {
					cb(...args)
				}
			}
		}
	}

	return container
}

/**
 * Helper to set up a mock container with predefined files
 */
export function createMockContainerWithFiles(files: Record<string, string>): MockContainer {
	const container = createMockContainer()

	for (const [path, content] of Object.entries(files)) {
		container.fs.files.set(path, content)

		// Ensure parent directories exist
		const parts = path.split('/').filter(Boolean)
		let current = ''
		for (let i = 0; i < parts.length - 1; i++) {
			current += '/' + parts[i]
			container.fs.directories.add(current)
		}
	}

	return container
}

/**
 * Helper to simulate server-ready event
 */
export function simulateServerReady(container: MockContainer, port: number, url: string): void {
	container.emit('server-ready', port, url)
}

/**
 * Helper to simulate port event
 */
export function simulatePortEvent(container: MockContainer, port: number, type: 'open' | 'close', url: string): void {
	container.emit('port', port, type, url)
}
