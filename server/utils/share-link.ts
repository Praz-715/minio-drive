import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

/** Token URL-safe untuk link publik (base56, tanpa karakter ambigu). */
export function genToken(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const buf = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += chars[buf[i]! % chars.length]
  return s
}

/** Hash password link (scrypt, format `salt:hash` hex). */
export async function hashLinkPassword(pw: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const dk = (await scryptAsync(pw, salt, 32)) as Buffer
  return `${salt}:${dk.toString('hex')}`
}

/** Verifikasi password link (timing-safe). */
export async function verifyLinkPassword(pw: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const dk = (await scryptAsync(pw, salt, 32)) as Buffer
  const hashBuf = Buffer.from(hash, 'hex')
  return dk.length === hashBuf.length && timingSafeEqual(dk, hashBuf)
}

/** true kalau link sudah lewat masa berlaku. */
export function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() < Date.now()
}

/**
 * Throttle percobaan password link publik (in-memory, per-proses, per-token)
 * untuk menahan brute-force online. Cukup untuk deploy single-instance.
 */
const linkFails = new Map<string, number[]>()
const FAIL_WINDOW = 10 * 60 * 1000 // 10 menit
const FAIL_MAX = 10

export function tooManyLinkAttempts(token: string): boolean {
  const now = Date.now()
  const arr = (linkFails.get(token) || []).filter((t) => now - t < FAIL_WINDOW)
  linkFails.set(token, arr)
  return arr.length >= FAIL_MAX
}

export function recordLinkFail(token: string): void {
  const now = Date.now()
  const arr = (linkFails.get(token) || []).filter((t) => now - t < FAIL_WINDOW)
  arr.push(now)
  linkFails.set(token, arr)
}
