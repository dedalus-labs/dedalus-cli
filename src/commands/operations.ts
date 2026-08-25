import type { CliCommandDefinition, CliFlagDefinition, CliValueKind } from '../cli/runtime.js'

type Location = CliFlagDefinition['location']
type ParameterRow = readonly [
  name: string,
  location: Location,
  kind: CliValueKind,
  required: boolean,
  description: string | null,
  repeatable: boolean,
]
type OperationRow = readonly [
  id: string,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  commandPath: readonly string[],
  summary: string | null,
  description: string | null,
  transport: 'http' | 'websocket',
  streaming: 'sse' | null,
  parameters: readonly ParameterRow[],
  bodyParamKey: string | null,
]

export type OperationSpec = {
  readonly id: string
  readonly method: OperationRow[1]
  readonly path: string
  readonly parameterLocations: Readonly<Record<string, Location>>
  readonly command: CliCommandDefinition
}

const kebabCase = (value: string): string =>
  value.replaceAll('_', '-').replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLowerCase()

const camelCase = (value: string): string =>
  kebabCase(value).replace(/-([a-z0-9])/gu, (_match, character: string) => character.toUpperCase())

const flag = ([name, location, valueKind, required, description, repeatable]: ParameterRow): CliFlagDefinition => ({
  name: kebabCase(name),
  optionKey: camelCase(name),
  paramKey: name,
  location,
  required,
  ...(description ? { description } : {}),
  valueKind,
  ...(repeatable ? { repeatable: true } : {}),
})

export const defineOperations = (rows: readonly OperationRow[]): readonly OperationSpec[] =>
  rows.map(([id, method, path, commandPath, summary, description, transport, streaming, parameters, bodyParamKey]) => ({
    id,
    method,
    path,
    parameterLocations: Object.fromEntries(parameters.map(([name, location]) => [name, location])),
    command: {
      resourcePath: ['operations'],
      commandPath,
      methodName: id,
      ...(summary ? { summary } : {}),
      ...(description ? { description } : {}),
      transport,
      ...(streaming ? { streaming } : {}),
      iterable: transport === 'websocket' || streaming !== null,
      callShape: 'params',
      ...(bodyParamKey ? { bodyParamKey } : {}),
      positional: [],
      flags: parameters.map(flag),
    },
  }))
