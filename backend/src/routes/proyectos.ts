import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
  const { programa_id, estado, prioridad, responsable_id } = req.query;
  let query = `
    SELECT p.*, r.nombre as responsable_nombre, r.color as responsable_color,
    prog.nombre as programa_nombre, prog.color as programa_color,
    (SELECT COUNT(*) FROM tareas WHERE proyecto_id = p.id) as total_tareas,
    (SELECT COUNT(*) FROM tareas WHERE proyecto_id = p.id AND estado = 'completada') as tareas_completadas
    FROM proyectos p
    LEFT JOIN responsables r ON p.responsable_id = r.id
    LEFT JOIN programas prog ON p.programa_id = prog.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;
  if (programa_id) { query += ` AND p.programa_id = $${paramIdx++}`; params.push(programa_id); }
  if (estado) { query += ` AND p.estado = $${paramIdx++}`; params.push(estado); }
  if (prioridad) { query += ` AND p.prioridad = $${paramIdx++}`; params.push(prioridad); }
  if (responsable_id) { query += ` AND p.responsable_id = $${paramIdx++}`; params.push(responsable_id); }
  query += ' ORDER BY p.created_at DESC';
  const proyectos = await getAll(query, params);
  res.json(proyectos);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const proyecto = await getOne(`
    SELECT p.*, r.nombre as responsable_nombre, r.color as responsable_color,
    prog.nombre as programa_nombre
    FROM proyectos p
    LEFT JOIN responsables r ON p.responsable_id = r.id
    LEFT JOIN programas prog ON p.programa_id = prog.id
    WHERE p.id = $1
  `, [req.params.id]);
  if (!proyecto) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }
  res.json(proyecto);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id, dias_laborables } = req.body;
  if (!nombre) { res.status(400).json({ error: 'Nombre es requerido' }); return; }
  const created = await getOne(
    'INSERT INTO proyectos (programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id, dias_laborables) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
    [programa_id || null, nombre, descripcion || null, estado || 'planificacion', prioridad || 'media', fecha_inicio || null, fecha_fin || null, porcentaje_avance || 0, responsable_id || null, dias_laborables || '1,2,3,4,5']
  );
  res.status(201).json(created);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id, dias_laborables } = req.body;
  const updated = await getOne(
    'UPDATE proyectos SET programa_id=$1, nombre=$2, descripcion=$3, estado=$4, prioridad=$5, fecha_inicio=$6, fecha_fin=$7, porcentaje_avance=$8, responsable_id=$9, dias_laborables=$10, updated_at=NOW() WHERE id=$11 RETURNING *',
    [programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id, dias_laborables || '1,2,3,4,5', req.params.id]
  );
  res.json(updated);
});

// Copy/duplicate a proyecto with all its tareas, hitos, sprints, and dependencias
router.post('/:id/copy', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const original = await getOne('SELECT * FROM proyectos WHERE id = $1', [req.params.id]);
  if (!original) { res.status(404).json({ error: 'Proyecto no encontrado' }); return; }

  const newName = req.body.nombre || `${original.nombre} (copia)`;
  const newProyecto = await getOne(
    'INSERT INTO proyectos (programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8) RETURNING *',
    [original.programa_id, newName, original.descripcion, 'planificacion', original.prioridad, original.fecha_inicio, original.fecha_fin, original.responsable_id]
  );

  // Copy sprints
  const sprints = await getAll('SELECT * FROM sprints WHERE proyecto_id = $1 ORDER BY orden', [req.params.id]);
  const sprintMap: Record<number, number> = {};
  for (const s of sprints) {
    const ns = await getOne(
      'INSERT INTO sprints (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [newProyecto.id, s.nombre, s.descripcion, s.estado, s.fecha_inicio, s.fecha_fin, s.objetivo, s.orden]
    );
    sprintMap[s.id] = ns.id;
  }

  // Copy tareas (parents first, then children)
  const tareas = await getAll('SELECT * FROM tareas WHERE proyecto_id = $1 ORDER BY tarea_padre_id NULLS FIRST, orden', [req.params.id]);
  const tareaMap: Record<number, number> = {};
  for (const t of tareas) {
    const nt = await getOne(
      'INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden, sprint_id, prioridad) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *',
      [newProyecto.id, t.nombre, t.descripcion, 'pendiente', t.fecha_inicio, t.fecha_fin, t.duracion_dias, t.responsable_id, t.tarea_padre_id ? tareaMap[t.tarea_padre_id] || null : null, t.orden, t.sprint_id ? sprintMap[t.sprint_id] || null : null, t.prioridad || 'media']
    );
    tareaMap[t.id] = nt.id;
  }

  // Copy hitos
  const hitos = await getAll('SELECT * FROM hitos WHERE proyecto_id = $1', [req.params.id]);
  for (const h of hitos) {
    await run(
      'INSERT INTO hitos (proyecto_id, nombre, fecha, completado) VALUES ($1, $2, $3, false)',
      [newProyecto.id, h.nombre, h.fecha]
    );
  }

  // Copy dependencias
  const deps = await getAll(`
    SELECT d.* FROM dependencias d
    JOIN tareas t ON d.tarea_id = t.id
    WHERE t.proyecto_id = $1
  `, [req.params.id]);
  for (const d of deps) {
    if (tareaMap[d.tarea_id] && tareaMap[d.tarea_dependiente_id]) {
      await run(
        'INSERT INTO dependencias (tarea_id, tarea_dependiente_id, tipo) VALUES ($1, $2, $3)',
        [tareaMap[d.tarea_id], tareaMap[d.tarea_dependiente_id], d.tipo]
      );
    }
  }

  res.status(201).json(newProyecto);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  await run('DELETE FROM proyectos WHERE id = $1', [req.params.id]);
  res.json({ message: 'Proyecto eliminado' });
});

export default router;
