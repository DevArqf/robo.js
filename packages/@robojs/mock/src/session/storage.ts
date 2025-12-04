import type { Session, SessionStorage } from '../types/index.js'

/**
 * In-memory session storage implementation
 * Can be swapped for FlashcoreStorage in future
 */
export class InMemoryStorage implements SessionStorage {
	private sessions = new Map<string, Session>()

	get(id: string): Session | undefined {
		return this.sessions.get(id)
	}

	set(id: string, session: Session): void {
		this.sessions.set(id, session)
	}

	delete(id: string): boolean {
		return this.sessions.delete(id)
	}

	values(): IterableIterator<Session> {
		return this.sessions.values()
	}

	clear(): void {
		this.sessions.clear()
	}

	get size(): number {
		return this.sessions.size
	}
}
