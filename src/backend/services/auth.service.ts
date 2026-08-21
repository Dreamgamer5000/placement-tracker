import crypto from 'crypto';
import { getAdminPasswordHash } from '../utils/crypto.utils.js';

interface LoginAttempt {
  lastAttempt: number;
  failures: number;
}

const loginAttempts = new Map<string, LoginAttempt>();

export class AuthService {
  static checkRateLimit(ip: string): { allowed: boolean; waitSeconds?: number } {
    const now = Date.now();
    const attemptData = loginAttempts.get(ip) || { lastAttempt: 0, failures: 0 };
    const waitTimeMs = attemptData.failures > 0 ? (2 ** attemptData.failures) * 1000 : 0;

    if (now - attemptData.lastAttempt < waitTimeMs) {
      const waitSeconds = Math.ceil((waitTimeMs - (now - attemptData.lastAttempt)) / 1000);
      return { allowed: false, waitSeconds };
    }

    return { allowed: true };
  }

  static verifyPassword(ip: string, password: string): boolean {
    const now = Date.now();
    const attemptData = loginAttempts.get(ip) || { lastAttempt: 0, failures: 0 };
    attemptData.lastAttempt = now;
    loginAttempts.set(ip, attemptData);

    const hash = crypto.createHash('sha256').update(password || '').digest('hex');

    if (hash === getAdminPasswordHash()) {
      // Reset on success
      loginAttempts.delete(ip);
      return true;
    }

    // Increment failure on wrong password
    attemptData.failures += 1;
    loginAttempts.set(ip, attemptData);
    return false;
  }
}
