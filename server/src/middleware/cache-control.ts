/**
 * Caching middleware to optimize client-side and server-side caching.
 * Sets appropriate Cache-Control headers based on response type and sensitivity.
 */

import type { NextFunction, Request, Response } from "express";

/**
 * Middleware to set Cache-Control headers based on response characteristics.
 * Implements smart caching for different response types:
 * - Public API responses: no-cache, must-revalidate
 * - Static assets: public, long cache
 * - User-specific data: private, no-cache
 *
 * @example
 * app.use(cacheControl);
 */
export function cacheControl(_req: Request, res: Response, next: NextFunction): void {
  // For API responses, use must-revalidate to ensure freshness
  // This default can be overridden by specific routes
  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}

/**
 * Middleware to set aggressive caching headers for static assets.
 * Use this for assets served from the public folder.
 *
 * @param maxAge - Maximum age in seconds (default: 1 year)
 * @example
 * app.use(express.static('public', { setHeaders: staticCacheControl(31536000) }));
 */
export function staticCacheControl(maxAge = 31536000): (req: Request, res: Response) => void {
  return (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", `public, max-age=${maxAge}, immutable`);
    res.setHeader("ETag", `"${Date.now()}"`);
  };
}

/**
 * Middleware to prevent caching for sensitive data.
 * Use this for routes that return user-specific or sensitive information.
 *
 * @example
 * router.get('/api/auth/me', noCacheControl, authHandler);
 */
export function noCacheControl(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
}

/**
 * Middleware to set cache headers for responses that can be cached for a specific duration.
 * Useful for semi-static data that changes infrequently.
 *
 * @param maxAge - Maximum age in seconds
 * @param isPublic - Whether the response can be cached publicly (default: false for private)
 * @example
 * router.get('/api/stores', cacheControlWithMaxAge(300, true), storesHandler);
 */
export function cacheControlWithMaxAge(
  maxAge: number,
  isPublic = false,
): (req: Request, res: Response, next: NextFunction) => void {
  return (_req: Request, res: Response, next: NextFunction) => {
    const visibility = isPublic ? "public" : "private";
    res.setHeader("Cache-Control", `${visibility}, max-age=${maxAge}, must-revalidate`);
    if (isPublic) {
      res.setHeader("CDN-Cache-Control", `max-age=${maxAge * 2}, must-revalidate`);
    }
    next();
  };
}

/**
 * Adds security headers that work with caching.
 * Prevents cache poisoning and ensures safe caching of sensitive headers.
 *
 * @example
 * app.use(secureCacheHeaders);
 */
export function secureCacheHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent browsers from MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS filtering
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent referrer information leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  next();
}
