/**
 * Test route: Explicit HEAD handler
 * - HEAD should use explicit HEAD export, not fall back to GET
 */
export function GET() {
	return { method: 'GET', data: 'full-response' }
}

export function HEAD() {
	return { method: 'HEAD', headersOnly: true }
}
