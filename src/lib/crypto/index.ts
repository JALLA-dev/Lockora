/**
 * Lockora Client-Side Cryptography Utilities
 * 
 * Uses Web Crypto API for performance and standard compatibility.
 */

// We use base64 for string representation of buffers
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Derives a Master Key from the user's Vault Password and salt using PBKDF2.
 */
export async function deriveMasterKey(password: string, salt: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ENCODER.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: ENCODER.encode(salt),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates an RSA-OAEP Asymmetric Key Pair for sharing.
 */
export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generates a random AES-GCM symmetric key for encrypting a specific secret.
 */
export async function generateSecretDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a string using AES-GCM. Returns a base64 string combining IV and Ciphertext.
 */
export async function encryptSymmetric(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    ENCODER.encode(plaintext)
  );

  // Combine IV and Encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return bufferToBase64(combined.buffer);
}

/**
 * Decrypts a base64 string (IV + Ciphertext) using AES-GCM.
 */
export async function decryptSymmetric(key: CryptoKey, ciphertextBase64: string): Promise<string> {
  const combined = new Uint8Array(base64ToBuffer(ciphertextBase64));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  return DECODER.decode(decrypted);
}

/**
 * Exports a CryptoKey (Public/Private/Symmetric) to Base64 (JWK or PKCS8/SPKI format).
 */
export async function exportKey(key: CryptoKey, format: 'jwk' | 'spki' | 'pkcs8' | 'raw' = 'jwk'): Promise<string> {
  const exported = await crypto.subtle.exportKey(format, key);
  if (format === 'jwk') {
    return JSON.stringify(exported);
  }
  return bufferToBase64(exported as ArrayBuffer);
}

/**
 * Imports a CryptoKey from Base64.
 */
export async function importKey(
  keyData: string,
  algorithm: RsaHashedImportParams | AesKeyAlgorithm | string,
  usages: KeyUsage[],
  format: 'jwk' | 'spki' | 'pkcs8' | 'raw' = 'jwk'
): Promise<CryptoKey> {
  let data: ArrayBuffer | JsonWebKey;
  if (format === 'jwk') {
    data = JSON.parse(keyData);
  } else {
    data = base64ToBuffer(keyData);
  }

  if (format === 'jwk') {
    return crypto.subtle.importKey('jwk', data as JsonWebKey, algorithm as any, true, usages);
  } else {
    return crypto.subtle.importKey(format as 'raw' | 'pkcs8' | 'spki', data as BufferSource, algorithm as any, true, usages);
  }
}

/**
 * Encrypts a string (e.g., a base64 encoded symmetric key) using RSA-OAEP public key.
 */
export async function encryptAsymmetric(publicKey: CryptoKey, dataBase64: string): Promise<string> {
  const data = base64ToBuffer(dataBase64);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    data
  );
  return bufferToBase64(encrypted);
}

/**
 * Decrypts a base64 string using RSA-OAEP private key.
 */
export async function decryptAsymmetric(privateKey: CryptoKey, ciphertextBase64: string): Promise<string> {
  const data = base64ToBuffer(ciphertextBase64);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    data
  );
  return bufferToBase64(decrypted);
}
