const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const SIG_METHOD = 'RSA-SHA256'
const log = require('bole')('hikaru.decryption')

function decrypt (publicKey, localKey, token, signature) {
  try {
    const decrypted = crypto.privateDecrypt(localKey, token).toString()
    if (verify(decrypted, signature, publicKey)) {
      return decrypted
    }
  } catch (e) {
    log.error(`failed to decrypt token with error: ${e.message}`)
  }
  return null
}

function encrypt (publicKey, localKey, secret) {
  let token = crypto.publicEncrypt(publicKey, Buffer.from(secret))
  let signature = sign(localKey, secret)
  return {
    token,
    signature
  }
}

function readFile (log, filePath) {
  const fullPath = path.resolve(filePath)
  if (!fs.existsSync(fullPath)) {
    console.log(`could not load local cert '${fullPath}'`)
    log.error(`could not load local cert '${fullPath}'`)
    return null
  }
  return fs.readFileSync(fullPath)
}

function sign (privateKey, token) {
  const signature = crypto.createSign(SIG_METHOD)
  signature.write(token)
  signature.end()
  return signature.sign(privateKey)
}

function verify (token, signature, publicKey) {
  const verifier = crypto.createVerify(SIG_METHOD)
  verifier.write(token)
  verifier.end()
  return verifier.verify(publicKey, signature)
}

module.exports = function () {
  return {
    decrypt: decrypt,
    encrypt: encrypt,
    read: readFile,
    sign: sign,
    verify: verify
  }
}
