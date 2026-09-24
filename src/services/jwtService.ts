/**
 * Cryptographic JWT & Secure Password Hashing Service
 * Implements HMAC-SHA256 JSON Web Tokens (JWT) and Salted Cryptographic Password Hashing
 * using the standard browser Web Crypto API (window.crypto.subtle).
 */

export interface JwtPayload {
  sub: string;       // User ID
  email: string;     // User email
  name: string;      // User full name
  role: 'user' | 'host'; // User role
  iss: string;       // Issuer
  iat: number;       // Issued at (epoch seconds)
  exp: number;       // Expiration (epoch seconds)
  jti: string;       // Unique Token Identifier
}

export interface JwtVerificationResult {
  valid: boolean;
  payload?: JwtPayload;
  error?: string;
}

const JWT_SECRET = 'cp_sec_jwt_auth_k99_sha256_sign_campuspass_2026';
const JWT_ISSUER = 'campuspass-auth-v2';
const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 Days expiration

// Helper: base64url encode
function base64UrlEncode(str: string): string {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Helper: base64url decode
function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

// Helper: ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Get HMAC key for signing/verification
async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: { name: 'SHA-256' } },
    false,
    ['sign', 'verify']
  );
}

export class JwtService {
  /**
   * Generates a cryptographically random salt (16 bytes hex)
   */
  static generateSalt(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hashes a password with salt using SHA-256
   */
  static async hashPassword(password: string, existingSalt?: string): Promise<{ hash: string; salt: string }> {
    const salt = existingSalt || this.generateSalt();
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}:campuspass_pepper`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return {
      hash: bufferToHex(hashBuffer),
      salt
    };
  }

  /**
   * Verifies password against stored hash and salt (with fallback for legacy plaintext)
   */
  static async verifyPassword(inputPassword: string, storedHash?: string, salt?: string, legacyPlaintext?: string): Promise<boolean> {
    if (storedHash && salt) {
      const computed = await this.hashPassword(inputPassword, salt);
      return computed.hash === storedHash;
    }
    // Backward-compatibility fallback for legacy accounts
    if (legacyPlaintext) {
      return legacyPlaintext === inputPassword;
    }
    return false;
  }

  /**
   * Creates a signed JSON Web Token (JWT) with HS256 algorithm
   */
  static async createToken(user: { uid: string; email: string; name: string; role: 'user' | 'host' }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload: JwtPayload = {
      sub: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      iss: JWT_ISSUER,
      iat: now,
      exp: now + TOKEN_EXPIRY_SECONDS,
      jti: `jti_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const dataToSign = `${headerEncoded}.${payloadEncoded}`;

    const key = await getCryptoKey();
    const enc = new TextEncoder();
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(dataToSign));

    // Convert signature buffer to base64url string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));
    const signatureEncoded = signatureBase64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return `${dataToSign}.${signatureEncoded}`;
  }

  /**
   * Verifies a JWT token's signature, structure, and expiration
   */
  static async verifyToken(token: string): Promise<JwtVerificationResult> {
    try {
      if (!token || typeof token !== 'string') {
        return { valid: false, error: 'Empty token.' };
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return { valid: false, error: 'Malformed JWT token structure.' };
      }

      const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
      const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

      // Convert base64url signature back to ArrayBuffer
      let base64 = signatureEncoded.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      const binaryStr = atob(base64);
      const signatureBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        signatureBytes[i] = binaryStr.charCodeAt(i);
      }

      // Verify HMAC-SHA256 signature
      const key = await getCryptoKey();
      const enc = new TextEncoder();
      const isValidSig = await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBytes,
        enc.encode(dataToVerify)
      );

      if (!isValidSig) {
        return { valid: false, error: 'Invalid cryptographic JWT signature (Tampered token rejected).' };
      }

      // Parse payload
      const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadEncoded));

      // Validate expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'JWT token has expired. Please login again.' };
      }

      // Validate issuer
      if (payload.iss !== JWT_ISSUER) {
        return { valid: false, error: 'Invalid JWT token issuer.' };
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: err.message || 'JWT verification exception.' };
    }
  }

  /**
   * Retrieves and verifies stored JWT token from localStorage
   */
  static async getVerifiedStoredToken(): Promise<{ token: string; payload: JwtPayload } | null> {
    const token = localStorage.getItem('campuspass_jwt_token');
    if (!token) return null;

    const result = await this.verifyToken(token);
    if (!result.valid || !result.payload) {
      localStorage.removeItem('campuspass_jwt_token');
      return null;
    }

    return { token, payload: result.payload };
  }

  /**
   * Saves JWT token to storage
   */
  static saveToken(token: string): void {
    localStorage.setItem('campuspass_jwt_token', token);
  }

  /**
   * Removes JWT token from storage on logout
   */
  static clearToken(): void {
    localStorage.removeItem('campuspass_jwt_token');
  }
}
