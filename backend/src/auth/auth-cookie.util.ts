import type { Request, Response, CookieOptions } from 'express';

const DEFAULT_COOKIE_NAME = 'access_token';
const DEFAULT_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function getAuthCookieName(): string {
  return process.env.AUTH_COOKIE_NAME?.trim() || DEFAULT_COOKIE_NAME;
}

export function buildAuthCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.AUTH_COOKIE_SECURE === 'true',
    sameSite: process.env.AUTH_COOKIE_SAME_SITE === 'strict' ? 'strict' : 'lax',
    path: '/',
    maxAge: Number(process.env.AUTH_COOKIE_MAX_AGE_MS) || DEFAULT_COOKIE_MAX_AGE_MS,
  };
}

export function setAuthCookie(response: Response, token: string): void {
  response.cookie(getAuthCookieName(), token, buildAuthCookieOptions());
}

export function clearAuthCookie(response: Response): void {
  response.clearCookie(getAuthCookieName(), buildAuthCookieOptions());
}

export function extractAuthCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;

  const cookieName = getAuthCookieName();
  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split('=');
    if (rawName === cookieName) {
      return decodeURIComponent(rawValueParts.join('='));
    }
  }

  return null;
}
