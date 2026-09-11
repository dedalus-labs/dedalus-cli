// @custom start
// Check declared custom ranges without requiring a remote generator baseline.
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
    const comments = new Map<number, ts.CommentRange>()
    const visit = (node: ts.Node): void => {
      for (const comment of [
        ...(ts.getLeadingCommentRanges(source, node.pos) ?? []),
        ...(ts.getLeadingCommentRanges(source, node.end) ?? []),
        ...(ts.getTrailingCommentRanges(source, node.end) ?? []),
      ]) {
        comments.set(comment.pos, comment)
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    const ordered = [...comments.values()].sort((a, b) => a.pos - b.pos)
    let open: number | undefined
    let ranges = 0
    const report = (position: number, message: string) => {
      errors.push(`${path}:${tree.getLineAndCharacterOfPosition(position).line + 1}: ${message}`)
    }
    for (const [index, comment] of ordered.entries()) {
      const text = source.slice(comment.pos, comment.end).trim()
      if (!/^\/\/\s*@custom\b/u.test(text)) continue
      if (text === '// @custom start') {
        if (open !== undefined) report(comment.pos, 'custom ranges must not nest')
        else open = comment.pos
        const next = ordered[index + 1]
        const explanation = next === undefined ? '' : source.slice(next.pos, next.end)
        if (
          next === undefined || source.slice(comment.end, next.pos).trim() !== '' ||
          /^\/\/\s*@custom\b/u.test(explanation) ||
          !/[^\s*]/u.test(explanation.replace(/^\/\/|^\/\*+|\*\/$/gu, ''))
        ) {
          report(comment.pos, 'explain the custom range in the following comment')
        }
      } else if (text === '// @custom end') {
        if (open === undefined) report(comment.pos, 'custom end has no matching start')
        else {
          ranges += 1
          open = undefined
        }
      } else {
        report(comment.pos, 'use // @custom start or // @custom end')
      }
    }
    if (open !== undefined) report(open, 'custom start has no matching end')
    if (ranges === 0) report(0, 'declare at least one paired custom range')
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
// @custom end
