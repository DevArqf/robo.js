import { useMemo } from 'react'
import styles from './Markdown.module.css'

interface MarkdownProps {
	text: string
}

interface ParsedNode {
	type: 'text' | 'bold' | 'italic' | 'strikethrough' | 'code' | 'codeblock' | 'link'
	content: string
	language?: string
	url?: string
}

/**
 * Simple Discord-flavored markdown renderer
 * Supports: bold, italic, strikethrough, inline code, code blocks, links
 */
export function Markdown({ text }: MarkdownProps) {
	const nodes = useMemo(() => parseMarkdown(text), [text])

	return (
		<span className={styles.markdown}>
			{nodes.map((node, i) => (
				<MarkdownNode key={i} node={node} />
			))}
		</span>
	)
}

function MarkdownNode({ node }: { node: ParsedNode }) {
	switch (node.type) {
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
		default:
			return <>{node.content}</>
	}
}

/**
 * Parse Discord markdown into nodes
 * Order matters: code blocks first, then inline patterns
 */
function parseMarkdown(text: string): ParsedNode[] {
	const nodes: ParsedNode[] = []
	let remaining = text

	// Code block regex: ```language\ncode``` or ```code```
	const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/
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

	while (remaining.length > 0) {
		let match: RegExpExecArray | null = null
		let matchType: ParsedNode['type'] = 'text'
		let matchIndex = remaining.length

		// Find the earliest match
		const checks: Array<{ regex: RegExp; type: ParsedNode['type'] }> = [
			{ regex: codeBlockRegex, type: 'codeblock' },
			{ regex: inlineCodeRegex, type: 'code' },
			{ regex: boldRegex, type: 'bold' },
			{ regex: italicRegex, type: 'italic' },
			{ regex: strikethroughRegex, type: 'strikethrough' },
			{ regex: linkRegex, type: 'link' }
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
				case 'codeblock':
					nodes.push({
						type: 'codeblock',
						language: match[1] || undefined,
						content: match[2]
					})
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
			}
			remaining = remaining.slice(matchIndex + match[0].length)
		} else {
			break
		}
	}

	return nodes
}
