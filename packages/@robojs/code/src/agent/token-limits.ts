/**
 * Model context limits configuration for @robojs/code SDK
 *
 * Maps model identifiers to their context window sizes.
 * Used for token budget management and proactive compaction.
 */

/**
 * Known model context limits in tokens.
 * These are the maximum context window sizes for various models.
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
	// Anthropic Claude 3 models
	'claude-3-opus': 200000,
	'claude-3-sonnet': 200000,
	'claude-3-haiku': 200000,
	'claude-3-5-sonnet': 200000,
	'claude-3-5-haiku': 200000,

	// Anthropic Claude 4 models
	'claude-4-opus': 200000,
	'claude-4-sonnet': 200000,
	'claude-opus-4': 200000,
	'claude-sonnet-4': 200000,

	// OpenAI GPT-4 models
	'gpt-4': 128000,
	'gpt-4-turbo': 128000,
	'gpt-4o': 128000,
	'gpt-4o-mini': 128000,

	// OpenAI GPT-3.5
	'gpt-3.5-turbo': 16385,

	// Default fallback
	default: 128000
}

/**
 * Get the context limit for a model.
 *
 * Tries exact match first, then partial match for model families,
 * then falls back to default.
 */
export function getModelContextLimit(modelId: string | undefined): number {
	if (!modelId) {
		return MODEL_CONTEXT_LIMITS['default']
	}

	// Try exact match first
	const exactMatch = MODEL_CONTEXT_LIMITS[modelId]
	if (exactMatch) {
		return exactMatch
	}

	// Try partial match (e.g., "claude-3-opus-20240229" matches "claude-3-opus")
	const lowerModelId = modelId.toLowerCase()
	for (const [key, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
		if (key !== 'default' && lowerModelId.includes(key.toLowerCase())) {
			return limit
		}
	}

	// Check for common patterns
	if (lowerModelId.includes('claude')) {
		return 200000 // All Claude models have 200k context
	}
	if (lowerModelId.includes('gpt-4')) {
		return 128000 // GPT-4 models typically have 128k
	}
	if (lowerModelId.includes('gpt-3.5')) {
		return 16385 // GPT-3.5 turbo
	}

	return MODEL_CONTEXT_LIMITS['default']
}

/**
 * Default token budget policy values.
 * Used when specific values aren't provided in ContextPolicy.
 */
export const DEFAULT_TOKEN_POLICY = {
	/**
	 * Percentage of context limit at which to trigger compaction.
	 * 70% gives good headroom while maximizing usable context.
	 */
	tokenThresholdPercent: 0.7,

	/**
	 * Tokens reserved for completion output.
	 * Subtracted from available context to prevent overflow.
	 */
	reservedOutputTokens: 8192,

	/**
	 * Minimum tokens to keep after compaction.
	 * Ensures we don't over-compact and lose important context.
	 */
	minTokensAfterCompaction: 10000,

	/**
	 * Target percentage after compaction.
	 * Compact to this level to give headroom for continued work.
	 */
	targetAfterCompactionPercent: 0.5
} as const

/**
 * Calculate the token threshold for triggering compaction.
 */
export function calculateTokenThreshold(
	modelContextLimit: number,
	thresholdPercent: number = DEFAULT_TOKEN_POLICY.tokenThresholdPercent,
	reservedOutputTokens: number = DEFAULT_TOKEN_POLICY.reservedOutputTokens
): number {
	const availableContext = modelContextLimit - reservedOutputTokens
	return Math.floor(availableContext * thresholdPercent)
}

/**
 * Calculate the target token count after compaction.
 */
export function calculateTargetAfterCompaction(
	modelContextLimit: number,
	targetPercent: number = DEFAULT_TOKEN_POLICY.targetAfterCompactionPercent,
	reservedOutputTokens: number = DEFAULT_TOKEN_POLICY.reservedOutputTokens,
	minTokens: number = DEFAULT_TOKEN_POLICY.minTokensAfterCompaction
): number {
	const availableContext = modelContextLimit - reservedOutputTokens
	const target = Math.floor(availableContext * targetPercent)
	return Math.max(target, minTokens)
}
