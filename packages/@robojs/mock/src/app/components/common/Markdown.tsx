import { useMemo, createContext, useContext } from 'react'
import styles from './Markdown.module.css'
import type { StageMember, StageRole, StageChannel } from '../../types/stage'

interface MarkdownProps {
	text: string
	members?: StageMember[]
	roles?: StageRole[]
	channels?: StageChannel[]
}

interface ParsedNode {
	type:
		| 'text'
		| 'bold'
		| 'italic'
		| 'strikethrough'
		| 'code'
		| 'codeblock'
		| 'link'
		| 'h1'
		| 'h2'
		| 'h3'
		| 'newline'
		| 'userMention'
		| 'roleMention'
		| 'channelMention'
		| 'everyoneMention'
		| 'hereMention'
	content: string
	language?: string
	url?: string
	id?: string
}

// Context for resolving mention names
interface MentionContext {
	members: StageMember[]
	roles: StageRole[]
	channels: StageChannel[]
}

const MentionCtx = createContext<MentionContext>({ members: [], roles: [], channels: [] })

/**
 * Simple Discord-flavored markdown renderer
 * Supports: bold, italic, strikethrough, inline code, code blocks, links, mentions
 */
export function Markdown({ text, members = [], roles = [], channels = [] }: MarkdownProps) {
	const nodes = useMemo(() => parseMarkdown(text), [text])
	const contextValue = useMemo(() => ({ members, roles, channels }), [members, roles, channels])

	return (
		<MentionCtx.Provider value={contextValue}>
			<div className={styles.markdown}>
				{nodes.map((node, i) => (
					<MarkdownNode key={i} node={node} />
				))}
			</div>
		</MentionCtx.Provider>
	)
}

function MarkdownNode({ node }: { node: ParsedNode }) {
	switch (node.type) {
		case 'h1':
			return <h1 className={styles.h1}>{node.content}</h1>
		case 'h2':
			return <h2 className={styles.h2}>{node.content}</h2>
		case 'h3':
			return <h3 className={styles.h3}>{node.content}</h3>
		case 'bold':
			return <strong className={styles.bold}>{node.content}</strong>
		case 'italic':
			return <em className={styles.italic}>{node.content}</em>
		case 'strikethrough':
			return <del className={styles.strikethrough}>{node.content}</del>
		case 'code':
			return <code className={styles.code}>{node.content}</code>
		case 'codeblock':
			return (
				<pre className={styles.codeblock}>
					<code>{node.content}</code>
				</pre>
			)
		case 'link':
			return (
				<a href={node.url} className={styles.link} target="_blank" rel="noopener noreferrer">
					{node.content}
				</a>
			)
		case 'newline':
			return <br />
		case 'userMention':
			return <UserMention id={node.id!} />
		case 'roleMention':
			return <RoleMention id={node.id!} />
		case 'channelMention':
			return <ChannelMention id={node.id!} />
		case 'everyoneMention':
			return <span className={styles.everyoneMention}>@everyone</span>
		case 'hereMention':
			return <span className={styles.hereMention}>@here</span>
		default:
			return <>{node.content}</>
	}
}

function UserMention({ id }: { id: string }) {
	const { members } = useContext(MentionCtx)
	const member = members.find((m) => m.user?.id === id)
	const displayName = member?.nick || member?.user?.username || 'Unknown User'

	return <span className={styles.userMention}>@{displayName}</span>
}

function RoleMention({ id }: { id: string }) {
	const { roles } = useContext(MentionCtx)
	const role = roles.find((r) => r.id === id)
	const displayName = role?.name || 'deleted-role'
	const color = role?.color ? `#${role.color.toString(16).padStart(6, '0')}` : undefined

	return (
		<span className={styles.roleMention} style={color ? { color, backgroundColor: `${color}33` } : undefined}>
			@{displayName}
		</span>
	)
}

function ChannelMention({ id }: { id: string }) {
	const { channels } = useContext(MentionCtx)
	const channel = channels.find((c) => c.id === id)
	const displayName = channel?.name || 'unknown-channel'

	return <span className={styles.channelMention}>#{displayName}</span>
}

/**
 * Parse Discord markdown into nodes
 * Order: code blocks first (multi-line), then headers, then inline patterns
 */
function parseMarkdown(text: string): ParsedNode[] {
	const nodes: ParsedNode[] = []

	// Split by code block markers - more reliable than regex exec with global flag
	const parts = text.split(/(```[\s\S]*?```)/g)

	for (const part of parts) {
		if (!part) continue

		// Check if this part is a code block
		const codeBlockMatch = /^```(\w*)\n?([\s\S]*?)```$/.exec(part)
		if (codeBlockMatch) {
			nodes.push({
				type: 'codeblock',
				language: codeBlockMatch[1] || undefined,
				content: codeBlockMatch[2]
			})
		} else {
			// Process as regular text with headers
			parseTextWithHeaders(part, nodes)
		}
	}

	return nodes
}

/**
 * Parse text that may contain headers and inline markdown
 */
function parseTextWithHeaders(text: string, nodes: ParsedNode[]): void {
	const lines = text.split('\n')

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex]

		// Check for headers at start of line (must check ### before ## before #)
		const h3Match = /^### (.+)$/.exec(line)
		const h2Match = /^## (.+)$/.exec(line)
		const h1Match = /^# (.+)$/.exec(line)

		if (h3Match) {
			nodes.push({ type: 'h3', content: h3Match[1] })
		} else if (h2Match) {
			nodes.push({ type: 'h2', content: h2Match[1] })
		} else if (h1Match) {
			nodes.push({ type: 'h1', content: h1Match[1] })
		} else if (line.length > 0) {
			// Parse inline markdown for non-empty lines
			parseInlineMarkdown(line, nodes)
		}

		// Add newline between lines (but not after the last line)
		if (lineIndex < lines.length - 1) {
			nodes.push({ type: 'newline', content: '' })
		}
	}
}

/**
 * Parse inline markdown (bold, italic, code, mentions, etc.)
 */
function parseInlineMarkdown(text: string, nodes: ParsedNode[]): void {
	let remaining = text

	// Mention regex patterns (must be checked before other patterns)
	const userMentionRegex = /<@!?(\d{17,20})>/
	const roleMentionRegex = /<@&(\d{17,20})>/
	const channelMentionRegex = /<#(\d{17,20})>/
	const everyoneMentionRegex = /@everyone/
	const hereMentionRegex = /@here/
	// Inline code regex: `code`
	const inlineCodeRegex = /`([^`]+)`/
	// Bold regex: **text**
	const boldRegex = /\*\*([^*]+)\*\*/
	// Italic regex: *text* or _text_
	const italicRegex = /(?<!\*)\*([^*]+)\*(?!\*)|_([^_]+)_/
	// Strikethrough regex: ~~text~~
	const strikethroughRegex = /~~([^~]+)~~/
	// Link regex: [text](url)
	const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/
	// Auto-link regex: https://... or http://...
	const autoLinkRegex = /https?:\/\/[^\s<>)\]]+/

	while (remaining.length > 0) {
		let match: RegExpExecArray | null = null
		let matchType: ParsedNode['type'] | 'autolink' = 'text'
		let matchIndex = remaining.length

		// Find the earliest match (mentions first, then formatting)
		const checks: Array<{ regex: RegExp; type: ParsedNode['type'] | 'autolink' }> = [
			{ regex: userMentionRegex, type: 'userMention' },
			{ regex: roleMentionRegex, type: 'roleMention' },
			{ regex: channelMentionRegex, type: 'channelMention' },
			{ regex: everyoneMentionRegex, type: 'everyoneMention' },
			{ regex: hereMentionRegex, type: 'hereMention' },
			{ regex: inlineCodeRegex, type: 'code' },
			{ regex: boldRegex, type: 'bold' },
			{ regex: italicRegex, type: 'italic' },
			{ regex: strikethroughRegex, type: 'strikethrough' },
			{ regex: linkRegex, type: 'link' },
			{ regex: autoLinkRegex, type: 'autolink' }
		]

		for (const { regex, type } of checks) {
			const result = regex.exec(remaining)
			if (result && result.index < matchIndex) {
				match = result
				matchType = type
				matchIndex = result.index
			}
		}

		// Add text before match
		if (matchIndex > 0) {
			nodes.push({ type: 'text', content: remaining.slice(0, matchIndex) })
		}

		if (match) {
			switch (matchType) {
				case 'userMention':
					nodes.push({ type: 'userMention', content: match[0], id: match[1] })
					break
				case 'roleMention':
					nodes.push({ type: 'roleMention', content: match[0], id: match[1] })
					break
				case 'channelMention':
					nodes.push({ type: 'channelMention', content: match[0], id: match[1] })
					break
				case 'everyoneMention':
					nodes.push({ type: 'everyoneMention', content: match[0] })
					break
				case 'hereMention':
					nodes.push({ type: 'hereMention', content: match[0] })
					break
				case 'code':
					nodes.push({ type: 'code', content: match[1] })
					break
				case 'bold':
					nodes.push({ type: 'bold', content: match[1] })
					break
				case 'italic':
					nodes.push({ type: 'italic', content: match[1] || match[2] })
					break
				case 'strikethrough':
					nodes.push({ type: 'strikethrough', content: match[1] })
					break
				case 'link':
					nodes.push({ type: 'link', content: match[1], url: match[2] })
					break
				case 'autolink':
					nodes.push({ type: 'link', content: match[0], url: match[0] })
					break
			}
			remaining = remaining.slice(matchIndex + match[0].length)
		} else {
			break
		}
	}
}
