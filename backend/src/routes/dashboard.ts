import { Router, Response } from 'express';
import { getOne, getAll } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/stats', async (_req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split('T')[0];
  const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const programasActivos = (await getOne("SELECT COUNT(*) as count FROM programas WHERE estado = 'activo'"))!.count;
  const proyectosEnCurso = (await getOne("SELECT COUNT(*) as count FROM proyectos WHERE estado = 'en_progreso'"))!.count;
  const totalTareas = (await getOne("SELECT COUNT(*) as count FROM tareas"))!.count;
  const tareasCompletadas = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado = 'completada'"))!.count;
  const tareasPendientes = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado = 'pendiente'"))!.count;
  const tareasEnProgreso = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado = 'en_progreso'"))!.count;
  const tareasBloqueadas = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado = 'bloqueada'"))!.count;

  const tareasVencidas = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado NOT IN ('completada') AND fecha_fin < $1", [today]))!.count;
  const tareasProximas = (await getOne("SELECT COUNT(*) as count FROM tareas WHERE estado NOT IN ('completada') AND fecha_fin >= $1 AND fecha_fin <= $2", [today, threeDays]))!.count;

  const proyectosAtrasados = (await getOne("SELECT COUNT(*) as count FROM proyectos WHERE estado NOT IN ('completado','cancelado') AND fecha_fin < $1", [today]))!;

  const hitosProximos = await getAll(`
    SELECT h.*, p.nombre as proyecto_nombre
    FROM hitos h JOIN proyectos p ON h.proyecto_id = p.id
    WHERE h.completado = false AND h.fecha >= $1 AND h.fecha <= $2
    ORDER BY h.fecha ASC
  `, [today, sevenDays]);

  const proyectosPorEstado = await getAll(
    'SELECT estado, COUNT(*) as count FROM proyectos GROUP BY estado'
  );

  const tareasPorEstado = await getAll(
    'SELECT estado, COUNT(*) as count FROM tareas GROUP BY estado'
  );

  res.json({
    programasActivos: parseInt(programasActivos),
    proyectosEnCurso: parseInt(proyectosEnCurso),
    totalTareas: parseInt(totalTareas),
    tareasCompletadas: parseInt(tareasCompletadas),
    tareasPendientes: parseInt(tareasPendientes),
    tareasEnProgreso: parseInt(tareasEnProgreso),
    tareasBloqueadas: parseInt(tareasBloqueadas),
    tareasVencidas: parseInt(tareasVencidas),
    tareasProximas: parseInt(tareasProximas),
    proyectosAtrasados: parseInt(proyectosAtrasados.count),
    hitosProximos,
    proyectosPorEstado,
    tareasPorEstado,
  });
});

export default router;
