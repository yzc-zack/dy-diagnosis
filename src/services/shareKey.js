import CryptoJS from 'crypto-js'

const KEY_PARAM = 'key'
const SECRET = 'dy-diagnosis-share-link-v1'

export function encryptShareKey(apiKey) {
  return encodeURIComponent(CryptoJS.AES.encrypt(apiKey, SECRET).toString())
}

export function decryptShareKey(encryptedKey) {
  const decrypted = CryptoJS.AES.decrypt(decodeURIComponent(encryptedKey), SECRET)
  const apiKey = decrypted.toString(CryptoJS.enc.Utf8)

  if (!apiKey) {
    throw new Error('访问授权解析失败')
  }

  return apiKey
}

export function getEncryptedKeyFromUrl() {
  return new URLSearchParams(window.location.search).get(KEY_PARAM) || ''
}
