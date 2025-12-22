/**
 * Flashcore v1 Plugin Definition Factories (spec rev 4.3)
 *
 * Provides type-safe factory functions for defining plugins and custom indexes.
 */

import type { FlashcorePlugin, IndexProvider, Index, IndexOptions } from './types.js'

/**
 * Define a Flashcore plugin with full type safety.
 *
 * @example
 * ```typescript
 * export const myPlugin = () => definePlugin({
 *   name: 'my-plugin',
 *
 *   setup(ctx) {
 *     ctx.state.counter = 0
 *   },
 *
 *   middleware: {
 *     async create(params, next) {
 *       this.state.counter++
 *       return next()
 *     },
 *   },
 *
 *   modelExtensions: {
 *     async myMethod(this: FlashcoreModel<any>) {
 *       return this.findMany({})
 *     },
 *   },
 *
 *   clientExtensions: {
 *     getStats() {
 *       return { count: this.state.counter }
 *     },
 *   },
 * })
 * ```
 */
export function definePlugin<
	TClientExtensions = Record<string, unknown>,
	TModelExtensions = Record<string, unknown>,
	TState = Record<string, unknown>
>(
	plugin: FlashcorePlugin<TClientExtensions, TModelExtensions, TState>
): FlashcorePlugin<TClientExtensions, TModelExtensions, TState> {
	// Validate plugin name
	if (!plugin.name || typeof plugin.name !== 'string') {
		throw new Error('Plugin must have a name')
	}

	if (plugin.name.startsWith('_')) {
		throw new Error(`Plugin name cannot start with underscore: ${plugin.name}`)
	}

	// Return the plugin as-is (factory mainly provides type inference)
	return plugin
}

/**
 * Define a custom index provider.
 *
 * @example
 * ```typescript
 * export const trieIndex = defineIndex({
 *   create: (options) => new TrieIndex(options),
 *   operators: ['prefixMatch', 'autocomplete'],
 * })
 * ```
 */
export function defineIndex<T = unknown>(provider: IndexProvider<T>): IndexProvider<T> {
	// Validate provider
	if (typeof provider.create !== 'function') {
		throw new Error('Index provider must have a create function')
	}

	if (!Array.isArray(provider.operators) || provider.operators.length === 0) {
		throw new Error('Index provider must have at least one operator')
	}

	return provider
}

/**
 * Create a simple in-memory index for testing.
 *
 * This is a basic key-value index that supports equality queries.
 */
export function createSimpleIndex<T = unknown>(): Index<T> {
	const data = new Map<string, T>()

	return {
		insert(id: string, value: T): void {
			data.set(id, value)
		},

		update(id: string, _oldValue: T, newValue: T): void {
			data.set(id, newValue)
		},

		remove(id: string, _value: T): void {
			data.delete(id)
		},

		clear(): void {
			data.clear()
		},

		query(operator: string, operand: unknown): string[] {
			if (operator === 'equals' || operator === 'eq') {
				const results: string[] = []
				for (const [id, value] of data) {
					if (value === operand) {
						results.push(id)
					}
				}
				return results
			}

			if (operator === 'in') {
				const values = operand as T[]
				const valueSet = new Set(values)
				const results: string[] = []
				for (const [id, value] of data) {
					if (valueSet.has(value)) {
						results.push(id)
					}
				}
				return results
			}

			throw new Error(`Unsupported operator: ${operator}`)
		},

		serialize(): unknown {
			return Array.from(data.entries())
		},

		deserialize(serialized: unknown): void {
			data.clear()
			const entries = serialized as Array<[string, T]>
			for (const [id, value] of entries) {
				data.set(id, value)
			}
		}
	}
}

/**
 * Create a trie-based index for prefix matching and autocomplete.
 */
export function createTrieIndex(): Index<string> {
	interface TrieNode {
		children: Map<string, TrieNode>
		ids: Set<string>
		isEnd: boolean
	}

	const createNode = (): TrieNode => ({
		children: new Map(),
		ids: new Set(),
		isEnd: false
	})

	let root = createNode()
	const valueToId = new Map<string, Set<string>>()

	return {
		insert(id: string, value: string): void {
			const lower = value.toLowerCase()
			let node = root

			for (const char of lower) {
				if (!node.children.has(char)) {
					node.children.set(char, createNode())
				}
				node = node.children.get(char)!
				node.ids.add(id)
			}
			node.isEnd = true

			// Track for removal
			if (!valueToId.has(lower)) {
				valueToId.set(lower, new Set())
			}
			valueToId.get(lower)!.add(id)
		},

		update(id: string, oldValue: string, newValue: string): void {
			this.remove(id, oldValue)
			this.insert(id, newValue)
		},

		remove(id: string, value: string): void {
			const lower = value.toLowerCase()
			let node = root

			for (const char of lower) {
				if (!node.children.has(char)) return
				node = node.children.get(char)!
				node.ids.delete(id)
			}

			valueToId.get(lower)?.delete(id)
		},

		clear(): void {
			root = createNode()
			valueToId.clear()
		},

		query(operator: string, operand: unknown): string[] {
			const prefix = String(operand).toLowerCase()

			// Navigate to prefix node
			let node = root
			for (const char of prefix) {
				if (!node.children.has(char)) return []
				node = node.children.get(char)!
			}

			// Return all IDs under this prefix
			return [...node.ids]
		},

		serialize(): unknown {
			return { values: [...valueToId.entries()].map(([v, ids]) => [v, [...ids]]) }
		},

		deserialize(data: unknown): void {
			this.clear()
			const { values } = data as { values: Array<[string, string[]]> }
			for (const [value, ids] of values) {
				for (const id of ids) {
					this.insert(id, value)
				}
			}
		}
	}
}

/**
 * Create an inverted index for full-text search.
 */
export function createFullTextIndex(options?: {
	tokenizer?: (text: string) => string[]
	minTokenLength?: number
}): Index<string> {
	const tokenize =
		options?.tokenizer ??
		((text: string) =>
			text
				.toLowerCase()
				.split(/\W+/)
				.filter((t) => t.length >= (options?.minTokenLength ?? 2)))

	// Token → IDs
	const index = new Map<string, Set<string>>()
	// ID → Tokens
	const docTokens = new Map<string, Set<string>>()

	return {
		insert(id: string, value: string): void {
			const tokens = tokenize(value)
			docTokens.set(id, new Set(tokens))

			for (const token of tokens) {
				if (!index.has(token)) {
					index.set(token, new Set())
				}
				index.get(token)!.add(id)
			}
		},

		update(id: string, _oldValue: string, newValue: string): void {
			// Remove old tokens
			const oldTokens = docTokens.get(id)
			if (oldTokens) {
				for (const token of oldTokens) {
					index.get(token)?.delete(id)
				}
			}

			// Add new tokens
			this.insert(id, newValue)
		},

		remove(id: string, _value: string): void {
			const tokens = docTokens.get(id)
			if (tokens) {
				for (const token of tokens) {
					index.get(token)?.delete(id)
				}
			}
			docTokens.delete(id)
		},

		clear(): void {
			index.clear()
			docTokens.clear()
		},

		query(operator: string, operand: unknown): string[] {
			const searchTokens = tokenize(String(operand))

			if (operator === 'matchAll' || operator === 'search') {
				// All tokens must match
				let result: Set<string> | null = null
				for (const token of searchTokens) {
					const ids = index.get(token) ?? new Set()
					if (result === null) {
						result = new Set(ids)
					} else {
						result = new Set([...result].filter((id) => ids.has(id)))
					}
				}
				return [...(result ?? [])]
			}

			if (operator === 'matchAny') {
				// Any token can match
				const result = new Set<string>()
				for (const token of searchTokens) {
					const ids = index.get(token) ?? new Set()
					for (const id of ids) result.add(id)
				}
				return [...result]
			}

			throw new Error(`Unsupported operator: ${operator}`)
		},

		serialize(): unknown {
			return {
				index: [...index.entries()].map(([token, ids]) => [token, [...ids]]),
				docs: [...docTokens.entries()].map(([id, tokens]) => [id, [...tokens]])
			}
		},

		deserialize(data: unknown): void {
			this.clear()
			const { index: idx, docs } = data as {
				index: Array<[string, string[]]>
				docs: Array<[string, string[]]>
			}

			for (const [token, ids] of idx) {
				index.set(token, new Set(ids))
			}
			for (const [id, tokens] of docs) {
				docTokens.set(id, new Set(tokens))
			}
		}
	}
}

/**
 * Trie index provider for autocomplete/prefix search.
 */
export const trieIndexProvider: IndexProvider<string> = {
	create: (_options?: IndexOptions) => createTrieIndex(),
	operators: ['prefixMatch', 'autocomplete', 'startsWith']
}

/**
 * Full-text index provider for search.
 */
export const fullTextIndexProvider: IndexProvider<string> = {
	create: (options?: IndexOptions) =>
		createFullTextIndex({
			minTokenLength: (options?.minTokenLength as number) ?? 2
		}),
	operators: ['search', 'matchAll', 'matchAny']
}
