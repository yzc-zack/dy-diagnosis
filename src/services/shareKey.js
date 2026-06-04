const KEY_PARAM = 'k'
const ADMIN_PARAM = 'admin'
const SECRET = 'dy-diagnosis-share-link-v1'
const SALT = 'scrolltome-douyin-diagnosis'

function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function getCryptoKey() {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(SECRET), 'PBKDF2', false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptShareKey(apiKey) {
  const encoder = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getCryptoKey()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(apiKey))

  return base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iv: base64UrlEncode(iv),
        data: base64UrlEncode(new Uint8Array(encrypted)),
      }),
    ),
  )
}

export async function decryptShareKey(encryptedKey) {
  const decoder = new TextDecoder()
  const payload = JSON.parse(decoder.decode(base64UrlDecode(encryptedKey)))
  const iv = base64UrlDecode(payload.iv)
  const data = base64UrlDecode(payload.data)
  const key = await getCryptoKey()
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)

  return decoder.decode(decrypted)
}

export function getEncryptedKeyFromUrl() {
  return new URLSearchParams(window.location.search).get(KEY_PARAM) || ''
}

export function isAdminMode() {
  return new URLSearchParams(window.location.search).get(ADMIN_PARAM) === '1'
}

export function buildShareUrl(encryptedKey) {
  const url = new URL(window.location.href)
  url.searchParams.delete(ADMIN_PARAM)
  url.searchParams.set(KEY_PARAM, encryptedKey)
  return url.toString()
}
