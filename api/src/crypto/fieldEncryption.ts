import crypto from 'crypto';

export type EncryptedSecret = {
  ciphertextB64: string;
  ivB64: string;
  tagB64: string;
};

export function encryptString(plaintext: string, key: Buffer): EncryptedSecret {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertextB64: ciphertext.toString('base64'),
    ivB64: iv.toString('base64'),
    tagB64: tag.toString('base64')
  };
}

export function decryptString(encrypted: EncryptedSecret, key: Buffer): string {
  const iv = Buffer.from(encrypted.ivB64, 'base64');
  const ciphertext = Buffer.from(encrypted.ciphertextB64, 'base64');
  const tag = Buffer.from(encrypted.tagB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

