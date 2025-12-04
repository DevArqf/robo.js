import type { AuthProvider, AuthResult, Session } from '../types/index.js'

/**
 * Re-export types for convenience
 */
export type { AuthProvider, AuthResult }

/**
 * Create an authentication middleware for the control API
 * This is a stub for future hosted deployment support
 */
export function createAuthMiddleware(provider: AuthProvider) {
	return async (req: Request): Promise<AuthResult> => {
		return provider.validateRequest(req)
	}
}

/**
 * No-op auth provider that allows all requests
 * Used for local development without authentication
 */
export class NoOpAuthProvider implements AuthProvider {
	async validateRequest(_req: Request): Promise<AuthResult> {
		return { valid: true }
	}

	async onSessionCreated(_session: Session, _auth: AuthResult): Promise<void> {
		// No-op
	}

	async onSessionEnded(_session: Session, _auth: AuthResult): Promise<void> {
		// No-op
	}
}

/**
 * API key-based auth provider stub
 * To be implemented for hosted deployment
 */
export class ApiKeyAuthProvider implements AuthProvider {
	private apiKeyHeader: string

	constructor(options?: { apiKeyHeader?: string }) {
		this.apiKeyHeader = options?.apiKeyHeader ?? 'X-API-Key'
	}

	async validateRequest(req: Request): Promise<AuthResult> {
		const apiKey = req.headers.get(this.apiKeyHeader)

		if (!apiKey) {
			return { valid: false, error: 'API key required' }
		}

		// TODO: Implement actual API key validation
		// This is a stub that accepts any non-empty key
		return {
			valid: true,
			userId: 'user_stub',
			metadata: { apiKey }
		}
	}

	async onSessionCreated(_session: Session, _auth: AuthResult): Promise<void> {
		// TODO: Track usage for billing
	}

	async onSessionEnded(_session: Session, _auth: AuthResult): Promise<void> {
		// TODO: Track session duration for billing
	}
}
