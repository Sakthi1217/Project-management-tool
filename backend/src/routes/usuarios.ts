import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', requireRole('admin'), async (_req: AuthRequest, res: Response) => {
  const usuarios = await getAll(
    'SELECT id, nombre, email, rol, created_at, updated_at FROM usuarios ORDER BY created_at DESC'
  );
  res.json(usuarios);
});

router.get('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const usuario = await getOne(
    'SELECT id, nombre, email, rol, created_at, updated_at FROM usuarios WHERE id = $1',
    [req.params.id]
  );
  if (!usuario) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  res.json(usuario);
});

router.post('/', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { nombre, email, password, rol } = req.body;

  if (!nombre || !email || !password) {
    res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
    return;
  }

  if (!['admin', 'editor', 'viewer'].includes(rol)) {
    res.status(400).json({ error: 'Rol debe ser admin, editor o viewer' });
    return;
  }

  const existing = await getOne('SELECT id FROM usuarios WHERE email = $1', [email]);
  if (existing) {
    res.status(409).json({ error: 'El email ya está registrado' });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = await getOne(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id',
    [nombre, email, hash, rol]
  );

  res.status(201).json({
    id: result.id,
    nombre,
    email,
    rol,
  });
});

router.put('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const { nombre, email, rol, password } = req.body;
  const userId = parseInt(req.params.id as string);

  if (userId === req.user!.id && rol !== 'admin') {
    res.status(400).json({ error: 'No puedes quitarte el rol de administrador a ti mismo' });
    return;
  }

  if (email) {
    const existing = await getOne('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [email, userId]);
    if (existing) {
      res.status(409).json({ error: 'El email ya está en uso por otro usuario' });
      return;
    }
  }

  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await run(
      'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, password_hash=$4, updated_at=NOW() WHERE id=$5',
      [nombre, email, rol, hash, userId]
    );
  } else {
    await run(
      'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, updated_at=NOW() WHERE id=$4',
      [nombre, email, rol, userId]
    );
  }

  const updated = await getOne(
    'SELECT id, nombre, email, rol, created_at, updated_at FROM usuarios WHERE id = $1',
    [userId]
  );
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const userId = parseInt(req.params.id as string);

  if (userId === req.user!.id) {
    res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    return;
  }

  const adminCount = await getOne("SELECT COUNT(*) as count FROM usuarios WHERE rol = 'admin'");
  const target = await getOne('SELECT rol FROM usuarios WHERE id = $1', [userId]);
  if (target?.rol === 'admin' && parseInt(adminCount.count) <= 1) {
    res.status(400).json({ error: 'Debe existir al menos un administrador' });
    return;
  }

  await run('DELETE FROM usuarios WHERE id = $1', [userId]);
  res.json({ message: 'Usuario eliminado' });
});

export default router;
