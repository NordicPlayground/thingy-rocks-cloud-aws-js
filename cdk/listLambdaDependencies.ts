import dependencyTree from 'dependency-tree'
import { statSync } from 'fs'
import path from 'path'

export const listLambdaDependencies = (entryFile: string): string[] => {
	statSync(entryFile)
	return dependencyTree.toList({
		filename: entryFile,
		directory: process.cwd(),
		tsConfig: path.join(process.cwd(), 'tsconfig.json'),
		filter: (path) => !path.includes('node_modules'), // do not include node_modules
	})
}
