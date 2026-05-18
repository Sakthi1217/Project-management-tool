import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Fail fast — never fall back to a default secret in any environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Exiting.');
  process.exit(1);
}

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    rol: string;
    nombre: string;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token de autenticación requerido' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.user.rol)) {
      res.status(403).json({ error: 'No tienes permisos para esta acción' });
      return;
    }
    next();
  };
}
