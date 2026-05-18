import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const responsables = await getAll(`
    SELECT r.*,
    (SELECT COUNT(*) FROM tareas WHERE responsable_id = r.id AND estado != 'completada') as tareas_pendientes,
    (SELECT COUNT(*) FROM tareas WHERE responsable_id = r.id) as total_tareas,
    (SELECT COUNT(*) FROM proyectos WHERE responsable_id = r.id) as total_proyectos
    FROM responsables r
    ORDER BY r.nombre ASC
  `);
  res.json(responsables);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const responsable = await getOne('SELECT * FROM responsables WHERE id = $1', [req.params.id]);
  if (!responsable) { res.status(404).json({ error: 'Responsable no encontrado' }); return; }
  res.json(responsable);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, email, rol, avatar_url, color } = req.body;
  if (!nombre) { res.status(400).json({ error: 'Nombre es requerido' }); return; }
  const created = await getOne(
    'INSERT INTO responsables (nombre, email, rol, avatar_url, color) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [nombre, email || null, rol || null, avatar_url || null, color || '#2563eb']
  );
  res.status(201).json(created);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, email, rol, avatar_url, color } = req.body;
  const updated = await getOne(
    'UPDATE responsables SET nombre=$1, email=$2, rol=$3, avatar_url=$4, color=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
    [nombre, email, rol, avatar_url, color, req.params.id]
  );
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  await run('DELETE FROM responsables WHERE id = $1', [req.params.id]);
  res.json({ message: 'Responsable eliminado' });
});

export default router;
