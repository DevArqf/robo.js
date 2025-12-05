/**
 * Test route: Explicit OPTIONS handler
 * - Should use explicit OPTIONS export instead of auto-handling
 */
export function GET() {
	return { method: 'GET' }
}

export function OPTIONS() {
	return { custom: true, allowedMethods: ['GET', 'OPTIONS'] }
}
