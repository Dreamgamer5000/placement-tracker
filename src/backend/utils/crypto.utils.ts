import crypto from 'crypto';

export function getAdminPassword(): string {
  let pwd = process.env.ADMIN_PASSWORD || process.env.PASSWORD || process.env.Password;
  if (!pwd) return '';
  if ((pwd.startsWith('"') && pwd.endsWith('"')) || (pwd.startsWith("'") && pwd.endsWith("'"))) {
    pwd = pwd.slice(1, -1);
  }
  return pwd.trim();
}

export function getAdminPasswordHash(): string {
  return crypto.createHash('sha256').update(getAdminPassword()).digest('hex');
}

export function verifyAdminPassword(headerPassword?: string | null): boolean {
  const pwd = headerPassword || '';
  const hash = crypto.createHash('sha256').update(pwd).digest('hex');
  return hash === getAdminPasswordHash();
}
