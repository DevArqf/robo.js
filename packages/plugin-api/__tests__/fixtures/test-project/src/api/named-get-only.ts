/**
 * Test route: Only GET export (no default)
 * - GET should return data
 * - POST/PUT/DELETE should return 405
 * - OPTIONS should auto-respond with Allow header
 * - HEAD should use GET handler
 */
export function GET() {
	return { method: 'GET', handler: 'named' }
}
