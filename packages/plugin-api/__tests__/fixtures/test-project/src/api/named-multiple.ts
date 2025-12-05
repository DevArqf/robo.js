/**
 * Test route: Multiple named exports (no default)
 * - GET, POST, DELETE should each return their method
 * - PUT/PATCH should return 405
 * - OPTIONS should auto-respond with Allow header
 */
export function GET() {
	return { method: 'GET' }
}

export function POST() {
	return { method: 'POST' }
}

export function DELETE() {
	return { method: 'DELETE' }
}
