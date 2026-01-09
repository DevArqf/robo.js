# LLM Types

> **For AI Agents**: Reference for LLM provider types and model aliases.

**File:** `/Users/pkmmte/Documents/GitHub/robo.js/packages/@robojs/code/src/types/llm.ts`

## LLMProvider

```typescript
interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>
  stream(request: ChatRequest): AsyncIterable<StreamChunk>
}
```

## BrandedModelAlias

```typescript
type BrandedModelAlias =
  | 'Sage'                    // Entry-level (haiku)
  | 'Great Sage'              // Mid-tier (sonnet)
  | 'Raphael'                 // High capability (opus)
  | 'Words of the World'      // Highest tier (opus)
```

## ChatRequest

```typescript
{
  messages: ChatMessage[],
  tools?: ToolSchema[],
  toolChoice?: 'auto' | 'none' | { type: 'function', function: { name: string } },
  temperature?: number,
  maxTokens?: number,
  modelAlias?: BrandedModelAlias,
  modelId?: string
}
```

## ChatMessage

```typescript
{
  role: 'system' | 'user' | 'assistant' | 'tool',
  content: string | ChatMessageContent[],
  name?: string,
  toolCallId?: string,
  toolCalls?: ToolCall[]
}
```

## Related

- [LLM Provider Implementation](../implementation/)
