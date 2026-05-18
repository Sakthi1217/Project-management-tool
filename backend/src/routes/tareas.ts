import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import { sendTaskAssignedEmail } from '../services/mail.js';
import { logActividad } from '../utils/actividad.js';
import { recalcularProgresoProyecto } from '../utils/progreso.js';

const router = Router();
router.use(authMiddleware);

router.get('/proyecto/:proyectoId', async (req: AuthRequest, res: Response) => {
  const tareas = await getAll(`
    SELECT t.*, r.nombre as responsable_nombre, r.color as responsable_color, r.email as responsable_email, s.nombre as sprint_nombre
    FROM tareas t
    LEFT JOIN responsables r ON t.responsable_id = r.id
    LEFT JOIN sprints s ON t.sprint_id = s.id
    WHERE t.proyecto_id = $1
    ORDER BY t.orden ASC
  `, [req.params.proyectoId]);
  res.json(tareas);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const tarea = await getOne(`
    SELECT t.*, r.nombre as responsable_nombre, r.color as responsable_color
    FROM tareas t
    LEFT JOIN responsables r ON t.responsable_id = r.id
    WHERE t.id = $1
  `, [req.params.id]);
  if (!tarea) { res.status(404).json({ error: 'Tarea no encontrada' }); return; }
  res.json(tarea);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden, sprint_id, prioridad, porcentaje_avance, story_points, peso } = req.body;
  if (!nombre || !proyecto_id) { res.status(400).json({ error: 'Nombre y proyecto_id son requeridos' }); return; }

  const estadoFinal = estado || 'pendiente';
  const avanceFinal = estadoFinal === 'completada' ? 100 : estadoFinal === 'pendiente' ? 0 : (porcentaje_avance ?? 0);

  const created = await getOne(
    'INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden, sprint_id, prioridad, porcentaje_avance, story_points, peso) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
    [proyecto_id, nombre, descripcion || null, estadoFinal, fecha_inicio || null, fecha_fin || null, duracion_dias || null, responsable_id || null, tarea_padre_id || null, orden || 0, sprint_id || null, prioridad || 'media', avanceFinal, story_points || null, peso ?? 1]
  );

  // Send email notification if assigned
  if (responsable_id) {
    const resp = await getOne('SELECT email FROM responsables WHERE id = $1', [responsable_id]);
    const proy = await getOne('SELECT nombre FROM proyectos WHERE id = $1', [proyecto_id]);
    if (resp?.email && proy) {
      sendTaskAssignedEmail(resp.email, nombre, proy.nombre, fecha_fin || 'Sin fecha').catch(() => {});
    }
  }

  await logActividad(proyecto_id, req.user!, 'tarea_creada', `Tarea creada: ${nombre}`, 'tarea', created.id);
  recalcularProgresoProyecto(proyecto_id).catch(() => {});

  res.status(201).json(created);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden, sprint_id, prioridad, porcentaje_avance, story_points, peso } = req.body;

  const avanceFinal = estado === 'completada' ? 100 : estado === 'pendiente' ? 0 : (porcentaje_avance ?? 0);

  const updated = await getOne(`
    UPDATE tareas SET nombre=$1, descripcion=$2, estado=$3, fecha_inicio=$4, fecha_fin=$5, duracion_dias=$6, responsable_id=$7, tarea_padre_id=$8, orden=$9, sprint_id=$10, prioridad=$11, porcentaje_avance=$12, story_points=$13, peso=$14, updated_at=NOW() WHERE id=$15
    RETURNING *
  `, [nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden, sprint_id, prioridad, avanceFinal, story_points, peso ?? 1, req.params.id]);

  if (updated) {
    await logActividad(updated.proyecto_id, req.user!, 'tarea_actualizada', `Tarea actualizada: ${nombre}`, 'tarea', parseInt(req.params.id as string));
    recalcularProgresoProyecto(updated.proyecto_id).catch(() => {});
    const withJoin = await getOne(`
      SELECT t.*, r.nombre as responsable_nombre, r.color as responsable_color
      FROM tareas t LEFT JOIN responsables r ON t.responsable_id = r.id
      WHERE t.id = $1
    `, [req.params.id]);
    res.json(withJoin);
  } else {
    res.json(updated);
  }
});

// Batch reorder — must come before /:id routes
router.patch('/reorder', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { items } = req.body as { items: { id: number; orden: number }[] };
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'items requeridos' });
    return;
  }
  for (const { id, orden } of items) {
    await run('UPDATE tareas SET orden=$1 WHERE id=$2', [orden, id]);
  }
  res.json({ ok: true });
});

router.patch('/:id/dates', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { fecha_inicio, fecha_fin } = req.body;
  const updated = await getOne(
    'UPDATE tareas SET fecha_inicio=$1, fecha_fin=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
    [fecha_inicio, fecha_fin, req.params.id]
  );
  res.json(updated);
});

router.patch('/:id/progress', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { porcentaje_avance } = req.body;
  // Only allow manual progress if the task is in_progress or blocked
  const current = await getOne('SELECT estado, proyecto_id FROM tareas WHERE id = $1', [req.params.id]);
  const avanceFinal = current?.estado === 'completada' ? 100 : current?.estado === 'pendiente' ? 0 : porcentaje_avance;
  const updated = await getOne(
    'UPDATE tareas SET porcentaje_avance=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [avanceFinal, req.params.id]
  );
  if (updated) recalcularProgresoProyecto(updated.proyecto_id).catch(() => {});
  res.json(updated);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const tarea = await getOne('SELECT * FROM tareas WHERE id = $1', [req.params.id]);
  await run('DELETE FROM tareas WHERE id = $1', [req.params.id]);
  if (tarea) {
    await logActividad(tarea.proyecto_id, req.user!, 'tarea_eliminada', `Tarea eliminada: ${tarea.nombre}`, 'tarea', tarea.id);
    recalcularProgresoProyecto(tarea.proyecto_id).catch(() => {});
  }
  res.json({ message: 'Tarea eliminada' });
});

export default router;
