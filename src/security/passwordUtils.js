const crypto = require('crypto');

const HASH_PREFIX = 'scrypt';
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

function hashPassword(password) {
  const plainPassword = String(password || '');
  if (!plainPassword) {
    throw new Error('A senha nao pode ser vazia.');
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = crypto.scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');
  return `${HASH_PREFIX}$${salt}$${derivedKey}`;
}

function verifyPassword(password, storedHash) {
  const [prefix, salt, expectedHash] = String(storedHash || '').split('$');
  if (prefix !== HASH_PREFIX || !salt || !expectedHash) {
    return false;
  }

  const calculatedHash = crypto.scryptSync(String(password || ''), salt, KEY_LENGTH).toString('hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const calculatedBuffer = Buffer.from(calculatedHash, 'hex');

  if (expectedBuffer.length !== calculatedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, calculatedBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};
