import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// Extended request interface to include user session data
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

/**
 * Authentication middleware that checks if user is logged in
 * In a real application, this would verify JWT tokens or session cookies
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // For now, we'll implement a basic check for an admin token in headers
  // In production, this should be replaced with proper session management or JWT verification
  const authToken = req.headers['x-admin-token'] as string;
  
  if (!authToken) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'Missing authentication token' 
    });
  }

  // Basic token validation (in production, use proper JWT or session validation)
  if (authToken !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ 
      error: 'Invalid authentication',
      message: 'Invalid authentication token' 
    });
  }

  // Mock user data (in production, fetch from database based on token)
  req.user = {
    id: 'admin-user-id',
    email: 'admin@example.com',
    isAdmin: true
  };

  next();
}

/**
 * Admin authorization middleware that checks if authenticated user has admin privileges
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      message: 'User authentication required' 
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Insufficient permissions',
      message: 'Admin privileges required for this operation' 
    });
  }

  next();
}

/**
 * Combined middleware for admin-only routes
 */
export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    requireAdmin(req, res, next);
  });
}

/**
 * Validation middleware factory for request validation using Zod schemas
 */
export function validateRequest<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Request validation failed',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      // Attach validated data to request
      req.body = result.data.body || req.body;
      req.query = result.data.query || req.query;
      req.params = result.data.params || req.params;

      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: 'Internal validation error',
      });
    }
  };
}

/**
 * Body validation middleware specifically for request bodies
 */
export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Request body validation failed',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      req.body = result.data;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: 'Internal validation error',
      });
    }
  };
}

/**
 * Query parameters validation middleware
 */
export function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'Query parameters validation failed',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      req.query = result.data;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: 'Internal validation error',
      });
    }
  };
}

/**
 * URL parameters validation middleware
 */
export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        return res.status(400).json({
          error: 'Validation failed',
          message: 'URL parameters validation failed',
          details: result.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
      }

      req.params = result.data;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'Validation error',
        message: 'Internal validation error',
      });
    }
  };
}