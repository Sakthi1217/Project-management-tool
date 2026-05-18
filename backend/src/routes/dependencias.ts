import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/tarea/:tareaId', async (req: AuthRequest, res: Response) => {
  const deps = await getAll(`
    SELECT d.*, t.nombre as tarea_nombre, td.nombre as dependiente_nombre
    FROM dependencias d
    JOIN tareas t ON d.tarea_id = t.id
    JOIN tareas td ON d.tarea_dependiente_id = td.id
    WHERE d.tarea_id = $1 OR d.tarea_dependiente_id = $1
  `, [req.params.tareaId]);
  res.json(deps);
});

router.get('/proyecto/:proyectoId', async (req: AuthRequest, res: Response) => {
  const deps = await getAll(`
    SELECT d.*
    FROM dependencias d
    JOIN tareas t ON d.tarea_id = t.id
    WHERE t.proyecto_id = $1
  `, [req.params.proyectoId]);
  res.json(deps);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { tarea_id, tarea_dependiente_id, tipo } = req.body;
  if (!tarea_id || !tarea_dependiente_id) { res.status(400).json({ error: 'tarea_id y tarea_dependiente_id son requeridos' }); return; }
  const created = await getOne(
    'INSERT INTO dependencias (tarea_id, tarea_dependiente_id, tipo) VALUES ($1, $2, $3) RETURNING *',
    [tarea_id, tarea_dependiente_id, tipo || 'fin_a_inicio']
  );
  res.status(201).json(created);
});

router.delete('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  await run('DELETE FROM dependencias WHERE id = $1', [req.params.id]);
  res.json({ message: 'Dependencia eliminada' });
});

export default router;
