// @custom
// Check declared custom modules without requiring a remote generator baseline.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const checkCustom = (
  files: readonly string[],
  read: (path: string) => string,
): string[] => {
  const errors: string[] = []
  for (const path of files) {
    const source = read(path)
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
    let declared = false
    const visit = (node: ts.Node): void => {
      const comments = ts.getLeadingCommentRanges(source, node.pos) ?? []
      for (let index = 0; index < comments.length - 1; index += 1) {
        const marker = comments[index]!
        const explanation = comments[index + 1]!
        if (source.slice(marker.pos, marker.end).trim() !== '// @custom') continue
        const body = source.slice(explanation.pos, explanation.end).replace(/^\/\/|^\/\*+|\*\/$/gu, '')
        if (/[^\s*]/u.test(body)) declared = true
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    if (!declared) {
      errors.push(`${path}: add // @custom followed by a comment explaining the customization`)
    }
  }
  return errors
}

const invoked = process.argv[1]
if (invoked !== undefined && resolve(invoked) === fileURLToPath(import.meta.url)) {
  const files: unknown = JSON.parse(readFileSync('custom-code.json', 'utf8'))
  if (!Array.isArray(files) || !files.every((file): file is string => typeof file === 'string')) {
    throw new Error('custom-code.json must be an array of repository file paths')
  }
  const errors = checkCustom(files, (path) => readFileSync(path, 'utf8'))
  if (errors.length > 0) {
    process.stderr.write(errors.join('\n') + '\n')
    process.exitCode = 1
  }
}
