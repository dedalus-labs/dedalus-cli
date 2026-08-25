/** Ephemeral SSH connection flow used by `machines create --connect`. */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { MachineAPI } from './machines.js'

const pollIntervalMilliseconds = 500
const pollLimit = 120

type SSHConnection = {
  readonly endpoint: string
  readonly hostPattern: string
  readonly hostPublicKey: string
  readonly port: number
  readonly sshUsername: string
  readonly userCertificate: string
}

type SSHSession = {
  readonly connection?: unknown
  readonly error_code?: unknown
  readonly error_message?: unknown
  readonly retry_after_ms?: unknown
  readonly session_id?: unknown
  readonly status?: unknown
}

export const connectMachine = async (api: MachineAPI, machineID: string): Promise<void> => {
  const directory = await mkdtemp(join(tmpdir(), 'dedalus-ssh-'))
  try {
    const keyPath = join(directory, 'key')
    await runProcess('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', '', '-f', keyPath], 'ignore')
    const publicKey = (await readFile(`${keyPath}.pub`, 'utf8')).trim()
    if (!publicKey) throw new Error('ssh-keygen returned an empty public key')

    const session = await awaitSSHSession(api, machineID, publicKey)
    const connection = readyConnection(session)
    const certificatePath = `${keyPath}-cert.pub`
    const knownHostsPath = join(directory, 'known_hosts')
    await writeFile(certificatePath, `${connection.userCertificate.trim()}\n`, { mode: 0o600 })
    await writeFile(knownHostsPath,
      `@cert-authority ${connection.hostPattern} ${connection.hostPublicKey}\n`, { mode: 0o600 })

    process.stderr.write(
      `connecting to ${connection.sshUsername}@${connection.endpoint}:${connection.port}\n`,
    )
    const code = await runProcess('ssh', [
      '-i', keyPath,
      '-o', `CertificateFile=${certificatePath}`,
      '-o', `UserKnownHostsFile=${knownHostsPath}`,
      '-o', 'GlobalKnownHostsFile=/dev/null',
      '-o', 'StrictHostKeyChecking=yes',
      '-o', 'IdentitiesOnly=yes',
      '-p', String(connection.port),
      '--', `${connection.sshUsername}@${connection.endpoint}`,
    ], 'inherit')
    if (code !== 0) process.exitCode = code
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

export const awaitSSHSession = async (
  api: MachineAPI,
  machineID: string,
  publicKey: string,
): Promise<SSHSession> => {
  let session = sessionFrom(await api.createSSHSession(machineID, publicKey))
  for (let poll = 0; poll <= pollLimit; poll += 1) {
    const sessionID = requiredString(session.session_id, 'SSH session response omitted session_id')
    const status = requiredString(session.status, `SSH session ${sessionID} omitted status`)
    process.stderr.write(`ssh ${sessionID}: ${status}\n`)
    switch (status) {
      case 'ready':
        return session
      case 'wake_in_progress':
        if (poll === pollLimit) {
          throw new Error(`SSH session did not become ready after ${pollLimit} polls`)
        }
        break
      case 'failed':
        throw new Error(
          `SSH session failed: ${optionalString(session.error_message) ?? 'no detail from server'}` +
          ` (error_code=${optionalString(session.error_code) ?? 'unknown'})`,
        )
      case 'expired':
        throw new Error('SSH session expired before it became ready; try again with a fresh session')
      case 'closed':
        throw new Error('SSH session was closed before it became ready')
      default:
        throw new Error(`SSH session ${sessionID} returned unknown status '${status}'`)
    }

    await sleep(retryDelay(session.retry_after_ms))
    session = sessionFrom(await api.getMachineSSHSession(machineID, sessionID))
  }
  throw new Error('SSH session polling ended without a terminal state')
}

const readyConnection = (session: SSHSession): SSHConnection => {
  const sessionID = requiredString(session.session_id, 'SSH session response omitted session_id')
  if (!session.connection || typeof session.connection !== 'object') {
    throw new Error(`SSH session ${sessionID} is ready but the server returned no connection`)
  }
  const connection = session.connection as Record<string, unknown>
  const trust = connection.host_trust
  if (!trust || typeof trust !== 'object') {
    throw new Error(`SSH session ${sessionID} is ready but the server returned no host trust`)
  }
  const hostTrust = trust as Record<string, unknown>
  const endpoint = singleLine(connection.endpoint, 'endpoint', sessionID)
  const sshUsername = singleLine(connection.ssh_username, 'SSH username', sessionID)
  const userCertificate = singleLine(connection.user_certificate, 'user certificate', sessionID)
  const hostPattern = singleLine(hostTrust.host_pattern, 'host pattern', sessionID)
  const hostPublicKey = singleLine(hostTrust.public_key, 'host CA public key', sessionID)
  if (/\s/u.test(hostPattern)) {
    throw new Error(`SSH session ${sessionID} returned an invalid host pattern`)
  }
  const port = connection.port
  if (!Number.isSafeInteger(port) || (port as number) < 1 || (port as number) > 65_535) {
    throw new Error(`SSH session ${sessionID} returned an invalid port`)
  }
  return { endpoint, hostPattern, hostPublicKey, port: port as number, sshUsername, userCertificate }
}

const sessionFrom = (value: unknown): SSHSession => {
  if (!value || typeof value !== 'object') throw new Error('server returned an empty SSH session')
  return value as SSHSession
}

const singleLine = (value: unknown, name: string, sessionID: string): string => {
  const result = requiredString(value, `SSH session ${sessionID} is ready but returned no ${name}`)
  if (/[\r\n\0]/u.test(result)) {
    throw new Error(`SSH session ${sessionID} returned an invalid ${name}`)
  }
  return result
}

const requiredString = (value: unknown, message: string): string => {
  if (typeof value !== 'string' || !value) throw new Error(message)
  return value
}

const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

const retryDelay = (value: unknown): number => {
  if (value === undefined || value === 0) return pollIntervalMilliseconds
  if (!Number.isSafeInteger(value) || (value as number) <= 0 || (value as number) > 60_000) {
    throw new Error('SSH session returned an invalid retry_after_ms')
  }
  return value as number
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const runProcess = (
  command: string,
  args: readonly string[],
  stdio: 'ignore' | 'inherit',
): Promise<number> => new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio })
  child.once('error', (error) => {
    reject(new Error(`${command} is required but was not found in PATH`, { cause: error }))
  })
  child.once('close', (code, signal) => {
    if (signal) {
      reject(new Error(`${command} terminated by ${signal}`))
      return
    }
    if (code === null) {
      reject(new Error(`${command} exited without a status`))
      return
    }
    if (command === 'ssh-keygen' && code !== 0) {
      reject(new Error(`ssh-keygen exited with status ${code}`))
      return
    }
    resolve(code)
  })
})
