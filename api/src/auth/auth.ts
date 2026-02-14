import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { ENV } from '../env.js';

export enum Role {
  CUSTOMER = 'CUSTOMER',
  PARTNER_STAFF = 'PARTNER_STAFF',
  ADMIN = 'ADMIN'
}

export type AuthUser = {
  userId: string;
  roles: Role[];
  partnerId?: string;
};

type AccessTokenClaims = {
  sub: string;
  roles: Role[];
  partnerId?: string;
};

type RefreshTokenClaims = {
  sub: string;
  tokenVersion: number;
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function signAccessToken(user: AuthUser): string {
  const claims: AccessTokenClaims = {
    sub: user.userId,
    roles: user.roles,
    partnerId: user.partnerId
  };
  return jwt.sign(claims, ENV.jwtAccessSecret, { expiresIn: ENV.jwtAccessTtlSeconds });
}

export function signRefreshToken(userId: string, tokenVersion: number): string {
  const claims: RefreshTokenClaims = { sub: userId, tokenVersion };
  return jwt.sign(claims, ENV.jwtRefreshSecret, { expiresIn: ENV.jwtRefreshTtlSeconds });
}

export function getAuthUserFromAccessToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, ENV.jwtAccessSecret) as AccessTokenClaims;
    return {
      userId: decoded.sub,
      roles: decoded.roles ?? [],
      partnerId: decoded.partnerId
    };
  } catch {
    return null;
  }
}

export function getAuthUserFromAuthorizationHeader(headerValue?: string): AuthUser | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return getAuthUserFromAccessToken(match[1] ?? '');
}

export function requireAuth(user: AuthUser | null): AuthUser {
  if (!user) {
    const err = new Error('UNAUTHENTICATED');
    // @ts-expect-error mercurius error extensions
    err.extensions = { code: 'UNAUTHENTICATED' };
    throw err;
  }
  return user;
}

export function hasRole(user: AuthUser, role: Role): boolean {
  return user.roles.includes(role);
}

export function requireRole(user: AuthUser, role: Role): void {
  if (!hasRole(user, role)) {
    const err = new Error('FORBIDDEN');
    // @ts-expect-error mercurius error extensions
    err.extensions = { code: 'FORBIDDEN' };
    throw err;
  }
}

export function requirePartnerScope(user: AuthUser, partnerId: string): void {
  if (hasRole(user, Role.ADMIN)) return;
  if (!user.partnerId || user.partnerId !== partnerId) {
    const err = new Error('FORBIDDEN');
    // @ts-expect-error mercurius error extensions
    err.extensions = { code: 'FORBIDDEN' };
    throw err;
  }
}

