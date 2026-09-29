import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Gets or creates the 32-byte server encryption key derived from environment secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.LOCKORA_SERVER_ENCRYPTION_KEY || process.env.CLERK_SECRET_KEY || 'lockora_default_secure_calendar_encryption_secret_32bytes';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a string (e.g. OAuth access token or refresh token) using AES-256-GCM.
 * Returns a base64 encoded string combining IV, authTag, and ciphertext.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combined format: IV (12) + AuthTag (16) + Encrypted Data
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts a base64 encoded string (IV + authTag + ciphertext) using AES-256-GCM.
 */
export function decryptToken(encryptedBase64: string): string {
  if (!encryptedBase64) return '';
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedBase64, 'base64');

  if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Invalid encrypted token payload format');
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
