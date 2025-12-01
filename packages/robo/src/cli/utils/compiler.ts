import { buildSeed, hasSeed, useSeed } from '../compiler/seed.js'
import { buildCode } from '../compiler/build.js'
import { buildDeclarationFiles, isTypescriptProject } from '../compiler/typescript.js'

export const Compiler = {
	buildCode,
	buildDeclarationFiles,
	buildSeed,
	hasSeed,
	isTypescriptProject,
	useSeed
}
