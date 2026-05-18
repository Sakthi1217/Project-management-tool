import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { logActividad } from '../utils/actividad.js';

const router = Router();
router.use(authMiddleware);

router.get('/proyecto/:proyectoId', async (req: AuthRequest, res: Response) => {
  const hitos = await getAll('SELECT * FROM hitos WHERE proyecto_id = $1 ORDER BY orden ASC, fecha ASC', [req.params.proyectoId]);
  res.json(hitos);
});

router.get('/proximos', async (_req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const hitos = await getAll(`
    SELECT h.*, p.nombre as proyecto_nombre
    FROM hitos h
    JOIN proyectos p ON h.proyecto_id = p.id
    WHERE h.completado = false AND h.fecha >= $1 AND h.fecha <= $2
    ORDER BY h.fecha ASC
  `, [today, nextWeek]);
  res.json(hitos);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { proyecto_id, nombre, fecha, completado } = req.body;
  if (!nombre || !proyecto_id || !fecha) { res.status(400).json({ error: 'nombre, proyecto_id y fecha son requeridos' }); return; }
  const created = await getOne(
    'INSERT INTO hitos (proyecto_id, nombre, fecha, completado) VALUES ($1, $2, $3, $4) RETURNING *',
    [proyecto_id, nombre, fecha, completado ? true : false]
  );
  await logActividad(proyecto_id, req.user!, 'hito_creado', `Hito creado: ${nombre}`, 'hito', created.id);
  res.status(201).json(created);
});

// Reorder milestones — must come before /:id
router.patch('/reorder', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { items } = req.body as { items: { id: number; orden?: number; gantt_orden?: number }[] };
  if (!Array.isArray(items) || items.length === 0) { res.status(400).json({ error: 'items requeridos' }); return; }
  for (const item of items) {
    const sets: string[] = [];
    const vals: any[] = [];
    if (item.orden !== undefined)       { sets.push(`orden=$${vals.length+1}`);       vals.push(item.orden); }
    if (item.gantt_orden !== undefined) { sets.push(`gantt_orden=$${vals.length+1}`); vals.push(item.gantt_orden); }
    if (sets.length > 0) { vals.push(item.id); await run(`UPDATE hitos SET ${sets.join(', ')} WHERE id=$${vals.length}`, vals); }
  }
  res.json({ ok: true });
});

// Update milestone date only (used by Gantt drag)
router.patch('/:id/date', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { fecha } = req.body;
  if (!fecha) { res.status(400).json({ error: 'fecha requerida' }); return; }
  const updated = await getOne(
    'UPDATE hitos SET fecha=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [fecha, req.params.id]
  );
  res.json(updated);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, fecha, completado } = req.body;
  const updated = await getOne(
    'UPDATE hitos SET nombre=$1, fecha=$2, completado=$3, updated_at=NOW() WHERE id=$4 RETURNING *',
    [nombre, fecha, completado ? true : false, req.params.id]
  );
  if (updated) {
    await logActividad(updated.proyecto_id, req.user!, 'hito_actualizado', `Hito actualizado: ${nombre}`, 'hito', parseInt(req.params.id as string));
  }
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const hito = await getOne('SELECT * FROM hitos WHERE id = $1', [req.params.id]);
  await run('DELETE FROM hitos WHERE id = $1', [req.params.id]);
  if (hito) await logActividad(hito.proyecto_id, req.user!, 'hito_eliminado', `Hito eliminado: ${hito.nombre}`, 'hito', hito.id);
  res.json({ message: 'Hito eliminado' });
});

export default router;
