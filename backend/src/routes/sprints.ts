import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { logActividad } from '../utils/actividad.js';

const router = Router();
router.use(authMiddleware);

router.get('/proyecto/:proyectoId', async (req: AuthRequest, res: Response) => {
  const sprints = await getAll(
    'SELECT * FROM sprints WHERE proyecto_id = $1 ORDER BY orden ASC',
    [req.params.proyectoId]
  );
  res.json(sprints);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const sprint = await getOne('SELECT * FROM sprints WHERE id = $1', [req.params.id]);
  if (!sprint) { res.status(404).json({ error: 'Sprint no encontrado' }); return; }
  res.json(sprint);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden } = req.body;
  if (!nombre || !proyecto_id) { res.status(400).json({ error: 'Nombre y proyecto_id son requeridos' }); return; }
  const created = await getOne(
    'INSERT INTO sprints (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [proyecto_id, nombre, descripcion || null, estado || 'planificacion', fecha_inicio || null, fecha_fin || null, objetivo || null, orden || 0]
  );
  await logActividad(proyecto_id, req.user!, 'sprint_creado', `Sprint creado: ${nombre}`, 'sprint', created.id);
  res.status(201).json(created);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden } = req.body;
  const updated = await getOne(
    'UPDATE sprints SET nombre=$1, descripcion=$2, estado=$3, fecha_inicio=$4, fecha_fin=$5, objetivo=$6, orden=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
    [nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden, req.params.id]
  );
  if (!updated) { res.status(404).json({ error: 'Sprint no encontrado' }); return; }
  await logActividad(updated.proyecto_id, req.user!, 'sprint_actualizado', `Sprint actualizado: ${nombre}`, 'sprint', parseInt(req.params.id as string));
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const sprint = await getOne('SELECT * FROM sprints WHERE id = $1', [req.params.id]);
  await run('DELETE FROM sprints WHERE id = $1', [req.params.id]);
  if (sprint) await logActividad(sprint.proyecto_id, req.user!, 'sprint_eliminado', `Sprint eliminado: ${sprint.nombre}`, 'sprint', sprint.id);
  res.json({ message: 'Sprint eliminado' });
});

export default router;
