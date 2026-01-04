/**
 * robo db export
 *
 * Exports schema to markdown or JSON format.
 */

import { Command } from '../../utils/cli-handler.js'
import { color } from '../../../core/color.js'
import { logger } from '../../../core/logger.js'
import type { CliContext } from '../../../types/cli.js'

const command = new Command('export')
	.description('Export schema to markdown or JSON.')
	.option('-f', '--format', 'output format: md (default) or json')
	.option('-o', '--output', 'output file path (prints to stdout if not specified)')
	.option('-s', '--silent', 'do not print anything')
	.option('-v', '--verbose', 'print more information for debugging')
	.option('-h', '--help', 'Shows the available command options')
	.handler(exportAction)

export default command

interface ExportCommandOptions {
	format?: string
	output?: string
	silent?: boolean
	verbose?: boolean
}

async function exportAction(context: CliContext) {
	const options = context.options as ExportCommandOptions
	const format = options.format || 'md'
	const outputPath = options.output

	logger({
		enabled: !options.silent,
		level: options.verbose ? 'debug' : 'info'
	})

	try {
		const { Flashcore } = await import('../../../flashcore/index.js')

		if (!Flashcore.$.isInitialized) {
			logger.log('')
			logger.warn('Flashcore has not been initialized.')
			logger.log('')
			return
		}

		const models = Flashcore.$.getRegisteredModels()
		if (models.size === 0) {
			logger.log('')
			logger.info('No models registered.')
			logger.log('')
			return
		}

		let output: string

		if (format === 'json') {
			output = await exportToJson(models)
		} else if (format === 'md' || format === 'markdown') {
			output = await exportToMarkdown(models)
		} else {
			logger.error(`Unknown format: ${format}. Use 'md' or 'json'.`)
			return
		}

		if (outputPath) {
			const { writeFile } = await import('fs/promises')
			await writeFile(outputPath, output, 'utf-8')
			logger.info(`Schema exported to ${color.cyan(outputPath)}`)
		} else {
			// Print to stdout
			console.log(output)
		}

	} catch (error) {
		logger.error('Failed to export schema:', error)
	}
}

async function exportToMarkdown(models: Map<string, any>): Promise<string> {
	const lines: string[] = []

	lines.push('# Flashcore Schema')
	lines.push('')
	lines.push(`Generated: ${new Date().toISOString()}`)
	lines.push('')
	lines.push('## Models')
	lines.push('')

	for (const [name, model] of models) {
		lines.push(`### ${name}`)
		lines.push('')
		lines.push('| Field | Type | Required | Unique | Default |')
		lines.push('|-------|------|----------|--------|---------|')

		const schema = model._schema
		for (const [fieldName, field] of Object.entries(schema.fields)) {
			const f = field as any
			const type = f.type || 'unknown'
			const required = f.optional ? 'No' : 'Yes'
			const unique = f.unique ? 'Yes' : 'No'
			const defaultVal = f.default !== undefined ? `\`${JSON.stringify(f.default)}\`` : '-'

			lines.push(`| ${fieldName} | ${type} | ${required} | ${unique} | ${defaultVal} |`)
		}

		lines.push('')

		// Show relations if any
		if (schema.relations && Object.keys(schema.relations).length > 0) {
			lines.push('**Relations:**')
			lines.push('')
			for (const [relName, rel] of Object.entries(schema.relations)) {
				const r = rel as any
				lines.push(`- \`${relName}\`: ${r.type} → ${r.model}`)
			}
			lines.push('')
		}

		// Show indexes if any
		if (schema.indexes && schema.indexes.length > 0) {
			lines.push('**Indexes:**')
			lines.push('')
			for (const idx of schema.indexes) {
				const fields = idx.fields.join(', ')
				const type = idx.unique ? 'unique' : 'index'
				lines.push(`- ${type}(${fields})`)
			}
			lines.push('')
		}
	}

	return lines.join('\n')
}

async function exportToJson(models: Map<string, any>): Promise<string> {
	const output: Record<string, any> = {
		generated: new Date().toISOString(),
		models: {}
	}

	for (const [name, model] of models) {
		const schema = model._schema

		output.models[name] = {
			checksum: model._schemaChecksum,
			fields: {},
			relations: schema.relations || {},
			indexes: schema.indexes || []
		}

		for (const [fieldName, field] of Object.entries(schema.fields)) {
			const f = field as any
			output.models[name].fields[fieldName] = {
				type: f.type,
				optional: f.optional ?? false,
				unique: f.unique ?? false,
				default: f.default
			}
		}
	}

	return JSON.stringify(output, null, 2)
}
