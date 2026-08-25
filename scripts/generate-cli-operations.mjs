import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const specification = JSON.parse(readFileSync(resolve(root, 'openapi.augmented.json'), 'utf8'))
const outputPath = resolve(root, 'src/commands/operations.generated.ts')
const documentationPath = resolve(root, 'api.md')

const commandNames = {
  listMachines: ['machine-lifecycle', 'list'],
  createMachine: ['machine-lifecycle', 'create'],
  deleteMachine: ['machine-lifecycle', 'delete'],
  getMachine: ['machine-lifecycle', 'retrieve'],
  patchMachine: ['machine-lifecycle', 'patch'],
  listMachineArtifacts: ['machine-lifecycle', 'list-artifacts'],
  deleteMachineArtifact: ['machine-lifecycle', 'delete-artifact'],
  getMachineArtifact: ['machine-lifecycle', 'retrieve-artifact'],
  listMachineExecutions: ['machine-lifecycle', 'list-executions'],
  createMachineExecution: ['machine-lifecycle', 'create-execution'],
  deleteMachineExecution: ['machine-lifecycle', 'delete-execution'],
  getMachineExecution: ['machine-lifecycle', 'retrieve-execution'],
  listMachineExecutionEvents: ['machine-lifecycle', 'list-execution-events'],
  getMachineExecutionOutput: ['machine-lifecycle', 'list-execution-output'],
  getMachineNetwork: ['machine-lifecycle', 'get-network'],
  listMachinePorts: ['machine-lifecycle', 'list-ports'],
  createMachinePort: ['machine-lifecycle', 'create-port'],
  deleteMachinePort: ['machine-lifecycle', 'delete-port'],
  getMachinePort: ['machine-lifecycle', 'retrieve-port'],
  sleepMachine: ['machine-lifecycle', 'sleep'],
  listMachineSSHSessions: ['machine-lifecycle', 'list-ssh-sessions'],
  createMachineSSHSession: ['machine-lifecycle', 'create-ssh-session'],
  deleteMachineSSHSession: ['machine-lifecycle', 'delete-ssh-session'],
  getMachineSSHSession: ['machine-lifecycle', 'retrieve-ssh-session'],
  watchMachineStatus: ['machine-lifecycle', 'watch-status'],
  listMachineTerminals: ['machine-lifecycle', 'list-terminals'],
  createMachineTerminal: ['machine-lifecycle', 'create-terminal'],
  deleteMachineTerminal: ['machine-lifecycle', 'delete-terminal'],
  getMachineTerminal: ['machine-lifecycle', 'retrieve-terminal'],
  connectMachineTerminal: ['machine-lifecycle', 'connect-terminal'],
  wakeMachine: ['machine-lifecycle', 'wake'],
  getNetwork: ['networks', 'retrieve'],
  getUsage: ['usage', 'list'],
  listMachineComputeUsage: ['usage:machines', 'list-compute-usage'],
  listMachineStorageUsage: ['usage:machines', 'list-storage-usage'],
}

const methods = new Set(['get', 'post', 'put', 'patch', 'delete'])
const dereference = (schema = {}) => {
  if (!schema.$ref) return schema
  return schema.$ref.slice(2).split('/').reduce((value, key) => value?.[key], specification) ?? schema
}
const kind = (schema = {}) => {
  const resolved = dereference(schema)
  const type = Array.isArray(resolved.type) ? resolved.type.find((value) => value !== 'null') : resolved.type
  return ['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(type) ? type : 'unknown'
}
const parameterRow = (parameter) => [
  parameter.name,
  parameter.in,
  kind(parameter.schema),
  parameter.required === true,
  parameter.description ?? null,
  kind(parameter.schema) === 'array',
]
const bodyRows = (operation) => {
  const bodySchema = dereference(operation.requestBody?.content?.['application/json']?.schema)
  if (!bodySchema?.properties) return operation.requestBody ? [['body', 'body', 'unknown', operation.requestBody.required === true, null, false]] : []
  const required = new Set(bodySchema.required ?? [])
  return Object.entries(bodySchema.properties).map(([name, schema]) => [name, 'body', kind(schema), required.has(name), schema.description ?? null, kind(schema) === 'array'])
}

const rows = []
for (const [path, pathItem] of Object.entries(specification.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue
    const commandPath = commandNames[operation.operationId]
    if (!commandPath) throw new Error(`No CLI command name for ${operation.operationId}`)
    const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])].map(parameterRow)
    const body = bodyRows(operation)
    const websocket = operation.responses?.['101'] !== undefined
    const sse = Object.values(operation.responses ?? {}).some((response) => response.content?.['text/event-stream'])
    if (websocket) body.push(['send', 'body', 'unknown', false, 'JSON message to send after connecting.', false])
    rows.push([
      operation.operationId,
      method,
      path,
      commandPath,
      operation.summary ?? null,
      operation.description ?? null,
      websocket ? 'websocket' : 'http',
      sse ? 'sse' : null,
      [...parameters, ...body],
      body.some(([name]) => name === 'body') ? 'body' : null,
    ])
  }
}

const banner = "// File generated from openapi.augmented.json by scripts/generate-cli-operations.mjs.\n"
const compactRows = rows.map((row) => `  ${JSON.stringify(row)}`).join(',\n')
const source = `${banner}import { defineOperations } from './operations.js'\n\nexport const operationSpecs = defineOperations([\n${compactRows},\n] as const)\n`
const groupedRows = rows.reduce((groups, row) => {
  const resource = row[3][0]
  groups[resource] ??= []
  groups[resource].push(row)
  return groups
}, {})
const documentation = [
  '# Dedalus CLI API',
  '',
  'Complete reference of every operation, grouped by resource. See [the README](./README.md) for usage and authentication.',
  '',
  ...Object.entries(groupedRows).flatMap(([resource, operations]) => [
    `## ${resource}`,
    '',
    ...operations.flatMap(([, method, path, commandPath, summary, description, , , parameters]) => {
      const flags = parameters.map(([name, , , required]) => `\`--${name.replaceAll('_', '-').toLowerCase()}\`${required ? ' (required)' : ''}`)
      return [
        `### \`dedalus ${commandPath.join(' ')}\``,
        '',
        `\`${method.toUpperCase()} ${path}\`${summary ? ` — ${summary}` : ''}`,
        ...(description ? ['', description] : []),
        ...(flags.length > 0 ? ['', `Flags: ${flags.join(', ')}`] : []),
        '',
      ]
    }),
  ]),
].join('\n')
if (process.argv.includes('--check')) {
  if (readFileSync(outputPath, 'utf8') !== source) throw new Error('Generated CLI operations are stale; run npm run generate:commands')
  if (readFileSync(documentationPath, 'utf8') !== documentation) throw new Error('Generated CLI API reference is stale; run npm run generate:commands')
} else {
  writeFileSync(outputPath, source)
  writeFileSync(documentationPath, documentation)
}
