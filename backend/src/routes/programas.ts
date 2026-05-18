import { Router, Response } from 'express';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response) => {
  const programas = await getAll(`
    SELECT p.*, r.nombre as responsable_nombre, r.color as responsable_color,
    (SELECT COUNT(*) FROM proyectos WHERE programa_id = p.id) as total_proyectos,
    (SELECT COALESCE(AVG(porcentaje_avance), 0) FROM proyectos WHERE programa_id = p.id) as avance_promedio
    FROM programas p
    LEFT JOIN responsables r ON p.responsable_id = r.id
    ORDER BY p.created_at DESC
  `);
  res.json(programas);
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const programa = await getOne(`
    SELECT p.*, r.nombre as responsable_nombre, r.color as responsable_color
    FROM programas p
    LEFT JOIN responsables r ON p.responsable_id = r.id
    WHERE p.id = $1
  `, [req.params.id]);
  if (!programa) { res.status(404).json({ error: 'Programa no encontrado' }); return; }
  res.json(programa);
});

// Get proyectos for a programa
router.get('/:id/proyectos', async (req: AuthRequest, res: Response) => {
  const proyectos = await getAll(`
    SELECT p.*, r.nombre as responsable_nombre, r.color as responsable_color,
    (SELECT COUNT(*) FROM tareas WHERE proyecto_id = p.id) as total_tareas,
    (SELECT COUNT(*) FROM tareas WHERE proyecto_id = p.id AND estado = 'completada') as tareas_completadas
    FROM proyectos p
    LEFT JOIN responsables r ON p.responsable_id = r.id
    WHERE p.programa_id = $1
    ORDER BY p.created_at DESC
  `, [req.params.id]);
  res.json(proyectos);
});

router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id } = req.body;
  if (!nombre) { res.status(400).json({ error: 'Nombre es requerido' }); return; }
  const created = await getOne(
    'INSERT INTO programas (nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [nombre, descripcion || null, estado || 'activo', fecha_inicio || null, fecha_fin || null, presupuesto || null, color || '#2563eb', responsable_id || null]
  );
  res.status(201).json(created);
});

router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id } = req.body;
  const updated = await getOne(
    'UPDATE programas SET nombre=$1, descripcion=$2, estado=$3, fecha_inicio=$4, fecha_fin=$5, presupuesto=$6, color=$7, responsable_id=$8, updated_at=NOW() WHERE id=$9 RETURNING *',
    [nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id, req.params.id]
  );
  res.json(updated);
});

// Copy/duplicate a programa (without its proyectos)
router.post('/:id/copy', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const original = await getOne('SELECT * FROM programas WHERE id = $1', [req.params.id]);
  if (!original) { res.status(404).json({ error: 'Programa no encontrado' }); return; }

  const newName = req.body.nombre || `${original.nombre} (copia)`;
  const created = await getOne(
    'INSERT INTO programas (nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [newName, original.descripcion, original.estado, original.fecha_inicio, original.fecha_fin, original.presupuesto, original.color, original.responsable_id]
  );
  res.status(201).json(created);
});

router.delete('/:id', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  await run('DELETE FROM programas WHERE id = $1', [req.params.id]);
  res.json({ message: 'Programa eliminado' });
});

export default router;
