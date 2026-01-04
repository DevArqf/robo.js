/**
 * Unit tests for path utilities
 */

import {
	normalizePath,
	hasTraversalAttempt,
	validatePath,
	matchesDenyPath,
	validatePathWithPolicy,
	isWithinBase,
	joinPath,
	dirname,
	basename
} from '../../../src/providers/utils/path.js'
import { CodeAgentError } from '../../../src/errors/index.js'

describe('normalizePath', () => {
	it('should handle empty paths', () => {
		expect(normalizePath('')).toBe('/')
		expect(normalizePath('  ')).toBe('/')
	})

	it('should ensure path starts with /', () => {
		expect(normalizePath('foo')).toBe('/foo')
		expect(normalizePath('foo/bar')).toBe('/foo/bar')
	})

	it('should normalize already-prefixed paths', () => {
		expect(normalizePath('/foo')).toBe('/foo')
		expect(normalizePath('/foo/bar')).toBe('/foo/bar')
	})

	it('should collapse multiple slashes', () => {
		expect(normalizePath('//foo')).toBe('/foo')
		expect(normalizePath('/foo//bar')).toBe('/foo/bar')
		expect(normalizePath('foo///bar///baz')).toBe('/foo/bar/baz')
	})

	it('should convert Windows backslashes', () => {
		expect(normalizePath('\\foo\\bar')).toBe('/foo/bar')
		expect(normalizePath('foo\\bar\\baz')).toBe('/foo/bar/baz')
		expect(normalizePath('/foo\\bar')).toBe('/foo/bar')
	})

	it('should resolve . (current directory)', () => {
		expect(normalizePath('./foo')).toBe('/foo')
		expect(normalizePath('/foo/./bar')).toBe('/foo/bar')
		expect(normalizePath('/foo/./bar/./baz')).toBe('/foo/bar/baz')
	})

	it('should resolve .. (parent directory) safely', () => {
		expect(normalizePath('/foo/bar/..')).toBe('/foo')
		expect(normalizePath('/foo/bar/../baz')).toBe('/foo/baz')
		expect(normalizePath('/foo/bar/baz/../../qux')).toBe('/foo/qux')
	})

	it('should not go above root with ..', () => {
		expect(normalizePath('/..')).toBe('/')
		expect(normalizePath('/../foo')).toBe('/foo')
		expect(normalizePath('/foo/../../bar')).toBe('/bar')
	})

	it('should remove null bytes', () => {
		expect(normalizePath('/foo\0bar')).toBe('/foobar')
	})

	it('should decode URL-encoded traversal patterns', () => {
		expect(normalizePath('/foo%2fbar')).toBe('/foo/bar')
		expect(normalizePath('/foo%5cbar')).toBe('/foo/bar')
	})
})

describe('hasTraversalAttempt', () => {
	it('should return false for safe paths', () => {
		expect(hasTraversalAttempt('/foo')).toBe(false)
		expect(hasTraversalAttempt('/foo/bar')).toBe(false)
		expect(hasTraversalAttempt('foo/bar')).toBe(false)
		expect(hasTraversalAttempt('')).toBe(false)
	})

	it('should detect null bytes', () => {
		expect(hasTraversalAttempt('/foo\0bar')).toBe(true)
		expect(hasTraversalAttempt('\0')).toBe(true)
	})

	it('should detect URL-encoded traversal patterns', () => {
		expect(hasTraversalAttempt('%2e%2e')).toBe(true)
		expect(hasTraversalAttempt('%2e.')).toBe(true)
		expect(hasTraversalAttempt('.%2e')).toBe(true)
		expect(hasTraversalAttempt('%252e')).toBe(true) // double-encoded
	})

	it('should detect overlong UTF-8 encoding', () => {
		expect(hasTraversalAttempt('%c0%ae')).toBe(true)
		expect(hasTraversalAttempt('%c1%9c')).toBe(true)
	})

	it('should detect .. that escapes root', () => {
		expect(hasTraversalAttempt('/../')).toBe(true)
		expect(hasTraversalAttempt('../')).toBe(true)
		expect(hasTraversalAttempt('foo/../../bar')).toBe(true)
	})

	it('should allow safe .. usage within path', () => {
		expect(hasTraversalAttempt('/foo/bar/..')).toBe(false)
		expect(hasTraversalAttempt('/foo/bar/../baz')).toBe(false)
	})

	it('should detect Windows-style traversal', () => {
		expect(hasTraversalAttempt('..\\..\\windows')).toBe(true)
		expect(hasTraversalAttempt('foo\\..\\..\\escape')).toBe(true)
	})
})

describe('validatePath', () => {
	it('should return normalized path for valid paths', () => {
		expect(validatePath('/foo/bar')).toBe('/foo/bar')
		expect(validatePath('foo')).toBe('/foo')
		expect(validatePath('/foo//bar')).toBe('/foo/bar')
	})

	it('should throw for traversal attempts', () => {
		expect(() => validatePath('../foo')).toThrow(CodeAgentError)
		expect(() => validatePath('/foo\0bar')).toThrow(CodeAgentError)
		expect(() => validatePath('%2e%2e')).toThrow(CodeAgentError)
	})

	it('should include path in error details', () => {
		try {
			validatePath('../attack')
			fail('Should have thrown')
		} catch (e) {
			expect(CodeAgentError.isCodeAgentError(e)).toBe(true)
			expect((e as CodeAgentError).code).toBe('PATH_TRAVERSAL')
		}
	})
})

describe('matchesDenyPath', () => {
	it('should return false for empty deny list', () => {
		expect(matchesDenyPath('/foo', [])).toBe(false)
		expect(matchesDenyPath('/foo', undefined as unknown as string[])).toBe(false)
	})

	it('should match exact segment names', () => {
		expect(matchesDenyPath('/.env', ['.env'])).toBe(true)
		expect(matchesDenyPath('/foo/.env', ['.env'])).toBe(true)
		expect(matchesDenyPath('/foo/bar/.env', ['.env'])).toBe(true)
		expect(matchesDenyPath('/foo/env', ['.env'])).toBe(false)
	})

	it('should match directory prefixes', () => {
		expect(matchesDenyPath('/.git', ['.git/'])).toBe(true)
		expect(matchesDenyPath('/.git/config', ['.git/'])).toBe(true)
		expect(matchesDenyPath('/.git/objects/pack', ['.git/'])).toBe(true)
		expect(matchesDenyPath('/foo/.git/config', ['.git/'])).toBe(true)
	})

	it('should match glob-like suffix patterns', () => {
		expect(matchesDenyPath('/foo/secret.key', ['*.key'])).toBe(true)
		expect(matchesDenyPath('/bar.key', ['*.key'])).toBe(true)
		expect(matchesDenyPath('/key', ['*.key'])).toBe(false)
	})

	it('should match glob-like prefix patterns', () => {
		expect(matchesDenyPath('/secret', ['secret*'])).toBe(true)
		expect(matchesDenyPath('/foo/secretfile', ['secret*'])).toBe(true)
		expect(matchesDenyPath('/foo/mysecret', ['secret*'])).toBe(false)
	})

	it('should match full paths', () => {
		expect(matchesDenyPath('/config/secrets.json', ['config/secrets.json'])).toBe(true)
	})

	it('should match default deny paths', () => {
		const defaultDeny = ['.env', '.env.local', '.env.production', '.git']
		expect(matchesDenyPath('/.env', defaultDeny)).toBe(true)
		expect(matchesDenyPath('/config/.env.local', defaultDeny)).toBe(true)
		expect(matchesDenyPath('/.git', defaultDeny)).toBe(true)
		expect(matchesDenyPath('/src/index.ts', defaultDeny)).toBe(false)
	})

	it('should be case-insensitive', () => {
		expect(matchesDenyPath('/FOO/.ENV', ['.env'])).toBe(true)
		expect(matchesDenyPath('/.GIT/config', ['.git/'])).toBe(true)
	})
})

describe('validatePathWithPolicy', () => {
	it('should return normalized path for allowed paths', () => {
		expect(validatePathWithPolicy('/src/index.ts', ['.env', '.git'])).toBe('/src/index.ts')
	})

	it('should throw for denied paths', () => {
		expect(() => validatePathWithPolicy('/.env', ['.env', '.git'])).toThrow(CodeAgentError)
		expect(() => validatePathWithPolicy('/.git/config', ['.git/'])).toThrow(CodeAgentError)
	})

	it('should throw for traversal attempts first', () => {
		try {
			validatePathWithPolicy('../.env', ['.env'])
		} catch (e) {
			expect((e as CodeAgentError).code).toBe('PATH_TRAVERSAL')
		}
	})

	it('should include deny paths in error details', () => {
		try {
			validatePathWithPolicy('/.env', ['.env', '.git'])
			fail('Should have thrown')
		} catch (e) {
			expect(CodeAgentError.isCodeAgentError(e)).toBe(true)
			expect((e as CodeAgentError).code).toBe('POLICY_VIOLATION')
		}
	})
})

describe('isWithinBase', () => {
	it('should return true for paths within base', () => {
		expect(isWithinBase('/foo/bar', '/foo')).toBe(true)
		expect(isWithinBase('/foo/bar/baz', '/foo')).toBe(true)
		expect(isWithinBase('/foo', '/foo')).toBe(true)
	})

	it('should return false for paths outside base', () => {
		expect(isWithinBase('/bar', '/foo')).toBe(false)
		expect(isWithinBase('/foobar', '/foo')).toBe(false)
		expect(isWithinBase('/fo', '/foo')).toBe(false)
	})

	it('should handle root base', () => {
		expect(isWithinBase('/anything', '/')).toBe(true)
		expect(isWithinBase('/foo/bar', '/')).toBe(true)
	})
})

describe('joinPath', () => {
	it('should join path segments', () => {
		expect(joinPath('foo', 'bar')).toBe('/foo/bar')
		expect(joinPath('/foo', 'bar')).toBe('/foo/bar')
		expect(joinPath('/foo', '/bar')).toBe('/foo/bar')
	})

	it('should handle empty segments', () => {
		expect(joinPath('', 'foo')).toBe('/foo')
		expect(joinPath('foo', '')).toBe('/foo')
		expect(joinPath('', '')).toBe('/')
	})

	it('should normalize the result', () => {
		expect(joinPath('/foo', 'bar', '..', 'baz')).toBe('/foo/baz')
		expect(joinPath('/foo//bar', 'baz')).toBe('/foo/bar/baz')
	})
})

describe('dirname', () => {
	it('should return directory portion', () => {
		expect(dirname('/foo/bar/baz.ts')).toBe('/foo/bar')
		expect(dirname('/foo/bar')).toBe('/foo')
		expect(dirname('/foo')).toBe('/')
	})

	it('should handle root path', () => {
		expect(dirname('/')).toBe('/')
	})
})

describe('basename', () => {
	it('should return file/directory name', () => {
		expect(basename('/foo/bar/baz.ts')).toBe('baz.ts')
		expect(basename('/foo/bar')).toBe('bar')
		expect(basename('/foo')).toBe('foo')
	})

	it('should handle trailing slashes', () => {
		expect(basename('/foo/bar/')).toBe('bar')
	})
})
