/**
 * Watcher Tests
 *
 * Verifies Robo's custom fs.watch-based watcher across common filesystem operations:
 * - no false positives on startup
 * - file add/change/remove/rename
 * - directory add/remove (including subtree)
 * - exclude handling (basename + path prefix)
 * - debouncing/coalescing
 * - stop() cleanup
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import fs from 'node:fs/promises'
import fssync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Watcher, { type Change } from '../../src/cli/utils/watcher.js'

jest.setTimeout(20_000)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitFor<T>(
	fn: () => T | undefined,
	{ timeoutMs = 3000, intervalMs = 25, label = 'condition' }: { timeoutMs?: number; intervalMs?: number; label?: string } = {}
): Promise<T> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		const value = fn()
		if (value !== undefined) return value
		await wait(intervalMs)
	}
	throw new Error(`Timed out waiting for ${label}`)
}

function sortChanges(changes: Change[]): Change[] {
	return [...changes].sort((a, b) => a.filePath.localeCompare(b.filePath))
}

function hasChange(changes: Change[], changeType: Change['changeType'], filePath: string): boolean {
	return changes.some((c) => c.changeType === changeType && c.filePath === filePath)
}

describe('Watcher', () => {
	let tempDir: string
	let originalCwd: string
	let watcher: Watcher | null = null
	let calls: Change[][] = []

	const startWatcher = async (paths: string[], options: Record<string, unknown> = {}) => {
		calls = []
		watcher = new Watcher(paths, options as any)
		await watcher.start(async (changes) => {
			calls.push(sortChanges(changes))
		})
	}

	beforeEach(async () => {
		originalCwd = process.cwd()
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'robo-watcher-test-'))
		process.chdir(tempDir)
	})

	afterEach(async () => {
		watcher?.stop()
		watcher = null
		process.chdir(originalCwd)
		await fs.rm(tempDir, { recursive: true, force: true })
	})

	it('does not emit false positives on startup', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'hello')

		await startWatcher(['src'], { debounceMs: 50, recursive: false, exclude: ['node_modules', '.git'] })

		// Give the OS a moment; there should be no callback without real diffs.
		await wait(250)
		expect(calls.length).toBe(0)
	})

	it('emits "changed" when an existing file content changes', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'hello')

		await startWatcher(['src'], { debounceMs: 50, recursive: false })

		await wait(25)
		await fs.writeFile(path.join('src', 'a.txt'), 'hello world')

		const changes = await waitFor(
			() => calls.find((c) => hasChange(c, 'changed', path.join('src', 'a.txt'))),
			{ label: 'changed event' }
		)
		expect(hasChange(changes, 'changed', path.join('src', 'a.txt'))).toBe(true)
	})

	it('emits "added" when a new file is created', async () => {
		await fs.mkdir('src', { recursive: true })
		await startWatcher(['src'], { debounceMs: 50, recursive: false })

		await fs.writeFile(path.join('src', 'new.txt'), 'x')

		const changes = await waitFor(
			() => calls.find((c) => hasChange(c, 'added', path.join('src', 'new.txt'))),
			{ label: 'added event' }
		)
		expect(hasChange(changes, 'added', path.join('src', 'new.txt'))).toBe(true)
	})

	it('emits "removed" when a file is deleted', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'gone.txt'), 'x')
		await startWatcher(['src'], { debounceMs: 50, recursive: false })

		await fs.rm(path.join('src', 'gone.txt'))

		const changes = await waitFor(
			() => calls.find((c) => hasChange(c, 'removed', path.join('src', 'gone.txt'))),
			{ label: 'removed event' }
		)
		expect(hasChange(changes, 'removed', path.join('src', 'gone.txt'))).toBe(true)
	})

	it('emits "removed" + "added" when a file is renamed', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'old.txt'), 'x')
		await startWatcher(['src'], { debounceMs: 75, recursive: false })

		await fs.rename(path.join('src', 'old.txt'), path.join('src', 'new.txt'))

		const changes = await waitFor(
			() =>
				calls.find(
					(c) => hasChange(c, 'removed', path.join('src', 'old.txt')) && hasChange(c, 'added', path.join('src', 'new.txt'))
				),
			{ label: 'rename events' }
		)

		expect(hasChange(changes, 'removed', path.join('src', 'old.txt'))).toBe(true)
		expect(hasChange(changes, 'added', path.join('src', 'new.txt'))).toBe(true)
	})

	it('debounces multiple rapid changes into a single callback', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'a')
		await fs.writeFile(path.join('src', 'b.txt'), 'b')

		await startWatcher(['src'], { debounceMs: 100, recursive: false })

		await wait(25)
		await fs.writeFile(path.join('src', 'a.txt'), 'a1')
		await fs.writeFile(path.join('src', 'b.txt'), 'b1')

		const changes = await waitFor(
			() => calls.find((c) => hasChange(c, 'changed', path.join('src', 'a.txt')) && hasChange(c, 'changed', path.join('src', 'b.txt'))),
			{ label: 'batched changes' }
		)

		// Should be a single batch for both files.
		expect(hasChange(changes, 'changed', path.join('src', 'a.txt'))).toBe(true)
		expect(hasChange(changes, 'changed', path.join('src', 'b.txt'))).toBe(true)
	})

	it('coalesces repeated changes to the same file within the debounce window', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'a')
		await startWatcher(['src'], { debounceMs: 150, recursive: false })

		await wait(25)
		await fs.writeFile(path.join('src', 'a.txt'), 'a1')
		await wait(10)
		await fs.writeFile(path.join('src', 'a.txt'), 'a2')

		const changes = await waitFor(() => calls.find((c) => hasChange(c, 'changed', path.join('src', 'a.txt'))), {
			label: 'coalesced changed event'
		})

		expect(changes.filter((c) => c.filePath === path.join('src', 'a.txt')).length).toBe(1)
	})

	it('respects basename excludes for directories', async () => {
		await fs.mkdir('src', { recursive: true })
		await startWatcher(['src'], { debounceMs: 75, recursive: false, exclude: ['ignored'] })

		await fs.mkdir(path.join('src', 'ignored'), { recursive: true })
		await fs.writeFile(path.join('src', 'ignored', 'x.txt'), 'x')
		await wait(250)
		expect(calls.length).toBe(0)

		await fs.writeFile(path.join('src', 'ok.txt'), 'ok')
		const changes = await waitFor(() => calls.find((c) => hasChange(c, 'added', path.join('src', 'ok.txt'))), {
			label: 'added event outside excluded dir'
		})
		expect(hasChange(changes, 'added', path.join('src', 'ok.txt'))).toBe(true)
	})

	it('respects prefix excludes for subtrees', async () => {
		await fs.mkdir(path.join('src', 'generated'), { recursive: true })
		await startWatcher(['src'], { debounceMs: 75, recursive: false, exclude: [path.join('src', 'generated')] })

		await fs.writeFile(path.join('src', 'generated', 'x.txt'), 'x')
		await wait(250)
		expect(calls.length).toBe(0)

		await fs.writeFile(path.join('src', 'real.txt'), 'x')
		const changes = await waitFor(() => calls.find((c) => hasChange(c, 'added', path.join('src', 'real.txt'))), {
			label: 'added event outside excluded prefix'
		})
		expect(hasChange(changes, 'added', path.join('src', 'real.txt'))).toBe(true)
	})

	it('emits subtree removals for directory deletion', async () => {
		await fs.mkdir(path.join('src', 'dir'), { recursive: true })
		await fs.writeFile(path.join('src', 'dir', 'a.txt'), 'a')
		await fs.writeFile(path.join('src', 'dir', 'b.txt'), 'b')

		await startWatcher(['src'], { debounceMs: 75, recursive: false })

		await fs.rm(path.join('src', 'dir'), { recursive: true, force: true })

		const changes = await waitFor(
			() =>
				calls.find(
					(c) =>
						hasChange(c, 'removed', path.join('src', 'dir')) &&
						hasChange(c, 'removed', path.join('src', 'dir', 'a.txt')) &&
						hasChange(c, 'removed', path.join('src', 'dir', 'b.txt'))
				),
			{ label: 'subtree removed events' }
		)

		expect(hasChange(changes, 'removed', path.join('src', 'dir'))).toBe(true)
		expect(hasChange(changes, 'removed', path.join('src', 'dir', 'a.txt'))).toBe(true)
		expect(hasChange(changes, 'removed', path.join('src', 'dir', 'b.txt'))).toBe(true)
	})

	it('stop() prevents further callbacks', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'a')

		await startWatcher(['src'], { debounceMs: 50, recursive: false })
		watcher?.stop()

		await fs.writeFile(path.join('src', 'a.txt'), 'b')
		await wait(250)
		expect(calls.length).toBe(0)
	})

	it('works in recursive mode (and still ignores excluded directories)', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'a')
		await startWatcher(['.'], { debounceMs: 75, recursive: true, exclude: ['node_modules', '.git'] })

		// Changes in src should be detected
		await wait(25)
		await fs.writeFile(path.join('src', 'a.txt'), 'b')
		const srcChange = await waitFor(() => calls.find((c) => hasChange(c, 'changed', path.join('src', 'a.txt'))), {
			label: 'recursive changed event'
		})
		expect(hasChange(srcChange, 'changed', path.join('src', 'a.txt'))).toBe(true)

		// Changes in excluded node_modules should be ignored
		calls = []
		await fs.mkdir(path.join('node_modules', 'pkg'), { recursive: true })
		await fs.writeFile(path.join('node_modules', 'pkg', 'x.txt'), 'x')

		await wait(250)
		expect(calls.length).toBe(0)
	})

	it('supports absolute watch roots and reports absolute file paths', async () => {
		await fs.mkdir('src', { recursive: true })
		await fs.writeFile(path.join('src', 'a.txt'), 'a')

		// Chdir stays in tempDir, but watch using absolute root and validate emitted file paths.
		const absRoot = path.join(tempDir, 'src')
		await startWatcher([absRoot], { debounceMs: 75, recursive: false })

		await wait(25)
		await fs.writeFile(path.join('src', 'a.txt'), 'b')

		const expectedAbs = path.join(absRoot, 'a.txt')
		const changes = await waitFor(() => calls.find((c) => hasChange(c, 'changed', expectedAbs)), { label: 'absolute changed event' })
		expect(hasChange(changes, 'changed', expectedAbs)).toBe(true)
	})

	it('follows symlinks during scans (when supported)', async () => {
		if (process.platform === 'win32') {
			// Symlink creation is restricted on many Windows setups; skip.
			return
		}

		await fs.mkdir('real', { recursive: true })
		await fs.writeFile(path.join('real', 'a.txt'), 'a')
		fssync.symlinkSync(path.join(tempDir, 'real'), path.join(tempDir, 'link'), 'dir')

		await startWatcher(['link'], { debounceMs: 75, recursive: false, followSymlinks: true })

		await wait(25)
		await fs.writeFile(path.join('real', 'a.txt'), 'b')

		// Watching the symlink path should surface changes under it.
		const changes = await waitFor(() => calls.find((c) => c.some((x) => x.filePath.endsWith(path.join('link', 'a.txt')))), {
			label: 'symlink change'
		})
		expect(changes.some((x) => x.changeType === 'changed' && x.filePath.endsWith(path.join('link', 'a.txt')))).toBe(true)
	})
})

