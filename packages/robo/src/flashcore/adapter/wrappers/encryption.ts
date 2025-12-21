/**
 * Flashcore v4.3 Encryption Wrapper
 *
 * Adds AES-256-GCM encryption to all values.
 * Encrypted values are tagged with '__enc__:' prefix for identification.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import type { FlashcoreAdapter, BatchOperation } from '../types.js'
import { AdapterWrapper } from './base.js'

/**
 * Options for the encryption wrapper.
 */
export interface EncryptionOptions {
	/**
	 * Encryption key (required).
	 * Should be at least 32 characters for AES-256.
	 */
	key: string

	/**
	 * Salt for key derivation.
	 * If not provided, a default salt is used (less secure).
	 * Default: 'flashcore-v4-salt'
	 */
	salt?: string

	/**
	 * Algorithm to use.
	 * Default: 'aes-256-gcm'
	 */
	algorithm?: 'aes-256-gcm' | 'aes-256-cbc'
}

// Tag prefix for encrypted values
const ENCRYPTED_PREFIX = '__enc__:'

// IV length for AES-GCM/CBC
const IV_LENGTH = 16
// Auth tag length for AES-GCM
const AUTH_TAG_LENGTH = 16

/**
 * Encryption wrapper for adapters.
 *
 * Uses AES-256-GCM (authenticated encryption) by default.
 * Each value gets a unique random IV for security.
 */
export class EncryptionAdapter<K extends string = string, V = unknown>
	extends AdapterWrapper<K, V>
{
	readonly name = 'EncryptionAdapter'

	private derivedKey: Buffer
	private algorithm: 'aes-256-gcm' | 'aes-256-cbc'

	constructor(adapter: FlashcoreAdapter<K, V>, options: EncryptionOptions) {
		super(adapter)

		if (!options.key || options.key.length < 8) {
			throw new Error('Encryption key must be at least 8 characters')
		}

		// Derive a 32-byte key using scrypt
		const salt = options.salt ?? 'flashcore-v4-salt'
		this.derivedKey = scryptSync(options.key, salt, 32)
		this.algorithm = options.algorithm ?? 'aes-256-gcm'
	}

	// ─────────────────────────────────────────────────────────────
	// Overridden Methods
	// ─────────────────────────────────────────────────────────────

	async get(key: K): Promise<V | undefined> {
		const stored = await this.next.get(key)
		return this.decrypt(stored)
	}

	async set(key: K, value: V): Promise<boolean> {
		const encrypted = this.encrypt(value)
		return this.next.set(key, encrypted as V)
	}

	// ─────────────────────────────────────────────────────────────
	// Override optional methods that need encryption handling
	// ─────────────────────────────────────────────────────────────

	get setIfNotExists(): ((key: K, value: V) => Promise<boolean> | boolean) | undefined {
		if (!this.next.setIfNotExists) return undefined

		return (key: K, value: V) => {
			const encrypted = this.encrypt(value)
			return this.next.setIfNotExists!(key, encrypted as V)
		}
	}

	get compareAndSwap(): ((key: K, expected: V, next: V) => Promise<boolean> | boolean) | undefined {
		if (!this.next.compareAndSwap) return undefined

		// Note: CAS is tricky with encryption since each encryption produces
		// different ciphertext due to random IVs. We need to:
		// 1. Get the current value
		// 2. Decrypt it
		// 3. Compare against expected
		// 4. If match, encrypt and set the new value
		return async (key: K, expected: V, next: V) => {
			const current = await this.get(key)
			const expectedJson = JSON.stringify(expected)
			const currentJson = JSON.stringify(current)

			if (currentJson !== expectedJson) {
				return false
			}

			const encrypted = this.encrypt(next)
			return this.next.set(key, encrypted as V)
		}
	}

	get atomicBatch(): ((ops: BatchOperation<K, V>[]) => Promise<void> | void) | undefined {
		if (!this.next.atomicBatch) return undefined

		return (ops: BatchOperation<K, V>[]) => {
			// Encrypt values in set operations
			const transformedOps = ops.map(op => {
				if (op.type === 'set') {
					return {
						...op,
						value: this.encrypt(op.value) as V
					}
				}
				return op
			})
			return this.next.atomicBatch!(transformedOps)
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Encryption Logic
	// ─────────────────────────────────────────────────────────────

	/**
	 * Encrypt a value.
	 */
	private encrypt(value: V): string {
		const json = JSON.stringify(value)

		if (this.algorithm === 'aes-256-gcm') {
			return this.encryptGcm(json)
		} else {
			return this.encryptCbc(json)
		}
	}

	/**
	 * Decrypt a value if it has the encryption tag.
	 */
	private decrypt(stored: V | undefined): V | undefined {
		if (stored === undefined) {
			return undefined
		}

		// Check if this is an encrypted string
		if (typeof stored === 'string' && stored.startsWith(ENCRYPTED_PREFIX)) {
			try {
				const payload = stored.slice(ENCRYPTED_PREFIX.length)

				if (this.algorithm === 'aes-256-gcm') {
					return JSON.parse(this.decryptGcm(payload)) as V
				} else {
					return JSON.parse(this.decryptCbc(payload)) as V
				}
			} catch {
				// Decryption failed
				throw new Error('Failed to decrypt value: invalid key or corrupted data')
			}
		}

		// Value is not encrypted (legacy or different format)
		return stored
	}

	/**
	 * Encrypt using AES-256-GCM (authenticated encryption).
	 */
	private encryptGcm(plaintext: string): string {
		const iv = randomBytes(IV_LENGTH)
		const cipher = createCipheriv('aes-256-gcm', this.derivedKey, iv)

		const encrypted = Buffer.concat([
			cipher.update(plaintext, 'utf8'),
			cipher.final()
		])
		const authTag = cipher.getAuthTag()

		// Format: IV (16 bytes) + AuthTag (16 bytes) + Ciphertext
		const payload = Buffer.concat([iv, authTag, encrypted])
		return ENCRYPTED_PREFIX + payload.toString('base64')
	}

	/**
	 * Decrypt using AES-256-GCM.
	 */
	private decryptGcm(payload: string): string {
		const data = Buffer.from(payload, 'base64')

		const iv = data.subarray(0, IV_LENGTH)
		const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
		const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

		const decipher = createDecipheriv('aes-256-gcm', this.derivedKey, iv)
		decipher.setAuthTag(authTag)

		const decrypted = Buffer.concat([
			decipher.update(ciphertext),
			decipher.final()
		])

		return decrypted.toString('utf8')
	}

	/**
	 * Encrypt using AES-256-CBC.
	 */
	private encryptCbc(plaintext: string): string {
		const iv = randomBytes(IV_LENGTH)
		const cipher = createCipheriv('aes-256-cbc', this.derivedKey, iv)

		const encrypted = Buffer.concat([
			cipher.update(plaintext, 'utf8'),
			cipher.final()
		])

		// Format: IV (16 bytes) + Ciphertext
		const payload = Buffer.concat([iv, encrypted])
		return ENCRYPTED_PREFIX + payload.toString('base64')
	}

	/**
	 * Decrypt using AES-256-CBC.
	 */
	private decryptCbc(payload: string): string {
		const data = Buffer.from(payload, 'base64')

		const iv = data.subarray(0, IV_LENGTH)
		const ciphertext = data.subarray(IV_LENGTH)

		const decipher = createDecipheriv('aes-256-cbc', this.derivedKey, iv)

		const decrypted = Buffer.concat([
			decipher.update(ciphertext),
			decipher.final()
		])

		return decrypted.toString('utf8')
	}

	// ─────────────────────────────────────────────────────────────
	// Utilities
	// ─────────────────────────────────────────────────────────────

	/**
	 * Check if a stored value is encrypted.
	 */
	isEncrypted(stored: unknown): boolean {
		return typeof stored === 'string' && stored.startsWith(ENCRYPTED_PREFIX)
	}

	/**
	 * Re-encrypt a value with a new key.
	 * Useful for key rotation.
	 */
	async reEncrypt(
		key: K,
		newAdapter: EncryptionAdapter<K, V>
	): Promise<boolean> {
		const value = await this.get(key)
		if (value === undefined) {
			return false
		}

		return newAdapter.set(key, value)
	}

	/**
	 * Get the current encryption configuration.
	 */
	getConfig(): { algorithm: 'aes-256-gcm' | 'aes-256-cbc' } {
		return {
			algorithm: this.algorithm
		}
	}
}

/**
 * Create a new EncryptionAdapter wrapping another adapter.
 */
export function createEncryptionAdapter<K extends string = string, V = unknown>(
	adapter: FlashcoreAdapter<K, V>,
	options: EncryptionOptions
): EncryptionAdapter<K, V> {
	return new EncryptionAdapter<K, V>(adapter, options)
}
