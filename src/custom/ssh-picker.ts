/** Search machine names while retaining stable IDs for the SSH request. */

import { emitKeypressEvents, type Key } from 'node:readline'
import type { MachineAPI } from './machines.js'

export type MachineChoice = {
  readonly id: string
  readonly name: string | null
  readonly status: string
}

export type PickerState = {
  readonly machines: readonly MachineChoice[]
  readonly query: string
  readonly cursor: number
}

export const matchingMachines = (state: PickerState): readonly MachineChoice[] => {
  const query = state.query.toLowerCase().trim()
  return state.machines.filter((machine) =>
    `${machine.name ?? ''} ${machine.id} ${machine.status}`.toLowerCase().includes(query))
}

export const updatePicker = (state: PickerState, text: string, key: Key): PickerState => {
  const count = matchingMachines(state).length
  if (key.name === 'up') return { ...state, cursor: Math.max(0, state.cursor - 1) }
  if (key.name === 'down') return { ...state, cursor: Math.max(0, Math.min(count - 1, state.cursor + 1)) }
  if (key.name === 'backspace') return { ...state, query: [...state.query].slice(0, -1).join(''), cursor: 0 }
  if (key.ctrl && key.name === 'u') return { ...state, query: '', cursor: 0 }
  if (!key.ctrl && !key.meta && text && !/[\x00-\x1f\x7f-\x9f]/u.test(text)) {
    return { ...state, query: state.query + text, cursor: 0 }
  }
  return state
}

export const renderPicker = (state: PickerState, rows: number, columns: number): string => {
  const matches = matchingMachines(state)
  const count = Math.max(1, Math.floor((rows - 8) / 2))
  const start = Math.max(0, state.cursor - count + 1)
  const lines = ['Select a machine for SSH', '', `/ ${state.query}`, '']
  for (let index = start; index < Math.min(matches.length, start + count); index += 1) {
    const machine = matches[index]!
    lines.push(`${index === state.cursor ? '>' : ' '} ${machine.name ?? 'Unnamed machine'}  [${machine.status}]`)
    lines.push(`    ${machine.id}`)
  }
  if (matches.length === 0) lines.push('No matching machines')
  lines.push('', `${matches.length} of ${state.machines.length} machines · ↑/↓ select · Enter connect · Esc cancel`)
  return lines.map((line) => terminalText(line).slice(0, Math.max(1, columns - 1))).join('\n') + '\n'
}

export const loadMachineChoices = async (api: MachineAPI, signal: AbortSignal): Promise<MachineChoice[]> => {
  const machines: MachineChoice[] = []
  const cursors = new Set<string>()
  let cursor: string | undefined
  do {
    const page = record(await api.listMachines(cursor, signal), 'machine list')
    if (!Array.isArray(page.items)) throw new Error('machine list response omitted items')
    for (const value of page.items) {
      const machine = record(value, 'machine')
      if (machine.desired_state === 'destroyed' || machine.phase === 'destroyed') continue
      if (typeof machine.machine_id !== 'string' || !machine.machine_id) {
        throw new Error('machine list response omitted machine_id')
      }
      if (typeof machine.phase !== 'string' || !machine.phase) {
        throw new Error(`machine ${machine.machine_id} response omitted lifecycle status`)
      }
      if (machine.name !== undefined && machine.name !== null && typeof machine.name !== 'string') {
        throw new Error(`machine ${machine.machine_id} response returned an invalid name`)
      }
      machines.push({ id: machine.machine_id, name: machine.name as string | null | undefined ?? null, status: machine.phase })
    }
    if (page.next_cursor === null || page.next_cursor === undefined || page.next_cursor === '') break
    if (typeof page.next_cursor !== 'string' || cursors.has(page.next_cursor)) {
      throw new Error('machine list response returned an invalid or repeated cursor')
    }
    cursor = page.next_cursor
    cursors.add(cursor)
  } while (!signal.aborted)
  signal.throwIfAborted()
  if (machines.length === 0) throw new Error('No machines available for SSH. Create one with dedalus machines create.')
  return machines
}

export const pickSSHMachine = (api: MachineAPI): Promise<string | undefined> => {
  const input = process.stdin
  const output = process.stderr
  if (!input.isTTY || !process.stdout.isTTY || !output.isTTY) {
    return Promise.reject(new Error('machine name or ID is required without an interactive terminal; usage: dedalus ssh <name|machine_id>'))
  }
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    const wasRaw = input.isRaw
    const wasFlowing = input.readableFlowing
    let done = false
    let loading = true
    let state: PickerState = { machines: [], query: '', cursor: 0 }
    const render = (): void => {
      const view = loading ? 'Loading machines…\n\nEsc cancel\n' : renderPicker(state, output.rows || 24, output.columns || 80)
      output.write('\x1b[H\x1b[2J' + view)
    }
    const finish = (id?: string, error?: unknown): void => {
      if (done) return
      done = true
      controller.abort()
      input.off('keypress', onKey)
      input.off('error', onError)
      input.off('end', onEnd)
      output.off('resize', render)
      input.setRawMode(wasRaw)
      if (!wasFlowing) input.pause()
      output.write('\x1b[?25h\x1b[?1049l')
      if (error) reject(error)
      else resolve(id)
    }
    const onKey = (text: string, key: Key): void => {
      if (key.name === 'escape' || (key.ctrl && key.name === 'c')) return finish()
      if (loading) return
      if (key.name === 'return') {
        const selected = matchingMachines(state)[state.cursor]
        if (selected) finish(selected.id)
        return
      }
      state = updatePicker(state, text, key)
      render()
    }
    const onError = (error: Error): void => finish(undefined, error)
    const onEnd = (): void => finish()
    emitKeypressEvents(input)
    input.setRawMode(true)
    input.on('keypress', onKey)
    input.once('error', onError)
    input.once('end', onEnd)
    output.on('resize', render)
    input.resume()
    output.write('\x1b[?1049h\x1b[?25l')
    render()
    void loadMachineChoices(api, controller.signal).then((machines) => {
      if (done) return
      loading = false
      state = { ...state, machines }
      render()
    }, (error: unknown) => finish(undefined, error))
  })
}

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} response must be an object`)
  }
  return value as Record<string, unknown>
}

const terminalText = (text: string): string => text.replace(/[\x00-\x1f\x7f-\x9f]/gu, '')
