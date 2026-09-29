import { encryptToken, decryptToken } from '../src/lib/calendar/crypto';

describe('OAuth Token Security & AES-256-GCM Encryption', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should encrypt and decrypt OAuth access/refresh tokens correctly', () => {
    const rawToken = 'ya29.a0Axoo-mock-google-access-token-987654321';
    const encrypted = encryptToken(rawToken);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toEqual(rawToken);
    expect(typeof encrypted).toBe('string');

    const decrypted = decryptToken(encrypted);
    expect(decrypted).toEqual(rawToken);
  });

  it('should produce unique ciphertexts for identical tokens due to random IVs', () => {
    const rawToken = 'mock-refresh-token-secret-12345';
    const encrypted1 = encryptToken(rawToken);
    const encrypted2 = encryptToken(rawToken);

    expect(encrypted1).not.toEqual(encrypted2);
    expect(decryptToken(encrypted1)).toEqual(rawToken);
    expect(decryptToken(encrypted2)).toEqual(rawToken);
  });

  it('should fail decryption when payload is tampered', () => {
    const rawToken = 'sensitive-oauth-refresh-token';
    const encrypted = encryptToken(rawToken);
    const tampered = encrypted.slice(0, -4) + 'AAAA';

    expect(() => decryptToken(tampered)).toThrow();
  });
});
