import { Tarea } from '../types';

/**
 * Calculates the effective progress of a task:
 *
 *  1. Has children → always weighted average of children (ignore own estado)
 *  2. Leaf – completada  → 100
 *  3. Leaf – pendiente   → 0
 *  4. Leaf – en_progreso / bloqueada → stored porcentaje_avance (manual)
 *
 * This mirrors the backend logic so the UI stays in sync before
 * the next server refresh.
 */
export function calcularProgresoEfectivo(tareaId: number, todasTareas: Tarea[]): number {
  const tarea = todasTareas.find(t => t.id === tareaId);
  if (!tarea) return 0;

  const hijos = todasTareas.filter(t => t.tarea_padre_id === tareaId);

  // Parent → derive from children
  if (hijos.length > 0) {
    const totalPeso = hijos.reduce((sum, h) => sum + (h.peso ?? 1), 0);
    if (totalPeso === 0) return 0;
    const pesado = hijos.reduce((sum, h) => {
      return sum + (h.peso ?? 1) * calcularProgresoEfectivo(h.id, todasTareas);
    }, 0);
    return Math.round(pesado / totalPeso);
  }

  // Leaf
  if (tarea.estado === 'completada') return 100;
  if (tarea.estado === 'pendiente') return 0;
  return tarea.porcentaje_avance ?? 0;
}

/**
 * Calculates overall project progress from root tasks using weighted average.
 */
export function calcularProgresoProyecto(tareas: Tarea[]): number {
  const raiz = tareas.filter(t => !t.tarea_padre_id);
  if (raiz.length === 0) return 0;

  const totalPeso = raiz.reduce((sum, t) => sum + (t.peso ?? 1), 0);
  if (totalPeso === 0) return 0;

  const pesado = raiz.reduce((sum, t) => {
    return sum + (t.peso ?? 1) * calcularProgresoEfectivo(t.id, tareas);
  }, 0);

  return Math.round(pesado / totalPeso);
}
