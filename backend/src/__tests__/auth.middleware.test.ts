/**
 * Unit tests for authMiddleware and requireRole.
 * No DB involved — pure JWT verification logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import { authMiddleware, requireRole, type AuthRequest } from '../middleware/auth.js';

const SECRET = process.env.JWT_SECRET!;

// ── Helpers ───────────────────────────────────────────────────────────────────
function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json:   vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(authHeader?: string): AuthRequest {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as AuthRequest;
}

function validToken(payload = { id: 1, email: 'u@test.com', rol: 'admin', nombre: 'Test' }) {
  return jwt.sign(payload, SECRET, { expiresIn: '1h' });
}

// ── authMiddleware ─────────────────────────────────────────────────────────────
describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => { next = vi.fn(); });

  it('returns 401 when Authorization header is absent', () => {
    const req = makeReq();
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a malformed / unsigned token', () => {
    const req = makeReq('Bearer not.a.real.token');
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token signed with a wrong secret', () => {
    const badToken = jwt.sign({ id: 1, email: 'x@x.com', rol: 'viewer', nombre: 'X' }, 'wrong-secret');
    const req = makeReq(`Bearer ${badToken}`);
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 for an expired token', () => {
    const expired = jwt.sign({ id: 1, email: 'x@x.com', rol: 'viewer', nombre: 'X' }, SECRET, { expiresIn: '-1s' });
    const req = makeReq(`Bearer ${expired}`);
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('calls next() and populates req.user for a valid token', () => {
    const token = validToken({ id: 42, email: 'alice@ppai.com', rol: 'editor', nombre: 'Alice' });
    const req = makeReq(`Bearer ${token}`);
    const res = mockRes();
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.id).toBe(42);
    expect(req.user?.email).toBe('alice@ppai.com');
    expect(req.user?.rol).toBe('editor');
  });
});

// ── requireRole ────────────────────────────────────────────────────────────────
describe('requireRole', () => {
  let next: NextFunction;

  beforeEach(() => { next = vi.fn(); });

  it('returns 401 when req.user is not set', () => {
    const req = makeReq();
    const res = mockRes();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when user role is not in the allowed list', () => {
    const req = makeReq();
    req.user = { id: 1, email: 'x@x.com', rol: 'viewer', nombre: 'X' };
    const res = mockRes();
    requireRole('admin', 'editor')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('calls next() when user role matches', () => {
    const req = makeReq();
    req.user = { id: 1, email: 'x@x.com', rol: 'admin', nombre: 'X' };
    const res = mockRes();
    requireRole('admin', 'editor')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
