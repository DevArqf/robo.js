/**
 * TLS/SSL Utilities for Mock Server
 *
 * Generates self-signed certificates for testing purposes.
 * Used by the voice gateway to support wss:// connections.
 */

// @ts-ignore - selfsigned types are incomplete
import selfsigned from 'selfsigned'

// Cache generated certificate to avoid regenerating for each voice gateway start
let cachedCert: { key: string; cert: string } | null = null

/**
 * Generate a self-signed certificate for testing
 * Returns PEM-encoded key and certificate
 */
export function generateSelfSignedCert(): { key: string; cert: string } {
	// Return cached cert if available
	if (cachedCert) {
		return cachedCert
	}

	// Generate new self-signed certificate
	const attrs = [{ name: 'commonName', value: 'localhost' }]
	const pems = selfsigned.generate(attrs, {
		keySize: 2048,
		days: 365,
		algorithm: 'sha256'
	}) as { private: string; cert: string }

	cachedCert = {
		key: pems.private,
		cert: pems.cert
	}

	return cachedCert
}

/**
 * Clear cached certificate (useful for testing)
 */
export function clearCertCache(): void {
	cachedCert = null
}
