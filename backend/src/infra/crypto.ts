import argon2 from 'argon2';
import crypto from 'node:crypto';
import { env } from '@/config/env';

/**
 * 1. Argon2id Password Hashing
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * 2. SHA-256 Key & Token Hashing
 */
export function hashSha256(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * 3. Cryptographically Secure 64-Character Hex String Generation
 * (32 bytes of secure entropy => 64 hex characters)
 */
export function generateRandomHex64(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 4. AES-256-GCM Authenticated Encryption & Decryption
 */
const ENCRYPTION_KEY = Buffer.from(env.ENCRYPTION_KEY_HEX, 'hex');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encryptCredential(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext,
    iv: iv.toString('hex'),
    tag,
  };
}

export function serializeEncryptedPayload(payload: EncryptedPayload): string {
  return `${payload.iv}:${payload.tag}:${payload.ciphertext}`;
}

export function decryptCredential(encrypted: EncryptedPayload | string): string {
  let ivHex: string;
  let tagHex: string;
  let ciphertextHex: string;

  if (typeof encrypted === 'string') {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid serialized encrypted payload format. Expected iv:tag:ciphertext');
    }
    [ivHex, tagHex, ciphertextHex] = parts;
  } else {
    ivHex = encrypted.iv;
    tagHex = encrypted.tag;
    ciphertextHex = encrypted.ciphertext;
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

