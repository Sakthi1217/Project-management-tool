import { getAll, run } from '../db/database.js';

/**
 * Calculates the effective progress of a task using weighted subtask averages.
 *
 * Rules (in order of priority):
 *  1. If the task HAS children → always derive from children (ignore own estado/avance)
 *  2. If leaf task:
 *     - completada  → 100
 *     - pendiente   → 0
 *     - otherwise   → stored porcentaje_avance (manual)
 *
 * This ensures that updating a subtask always propagates up through
 * every ancestor, regardless of the ancestor's own estado.
 */
function calcularEfectivo(tareaId: number, todasTareas: any[]): number {
  const tarea = todasTareas.find(t => t.id === tareaId);
  if (!tarea) return 0;

  const hijos = todasTareas.filter(t => t.tarea_padre_id === tareaId);

  // Parent task → derive entirely from children
  if (hijos.length > 0) {
    const totalPeso = hijos.reduce((sum: number, h: any) => sum + (h.peso ?? 1), 0);
    if (totalPeso === 0) return 0;
    const pesado = hijos.reduce((sum: number, h: any) => {
      return sum + (h.peso ?? 1) * calcularEfectivo(h.id, todasTareas);
    }, 0);
    return Math.round(pesado / totalPeso);
  }

  // Leaf task → estado-driven
  if (tarea.estado === 'completada') return 100;
  if (tarea.estado === 'pendiente') return 0;
  return tarea.porcentaje_avance ?? 0;
}

/**
 * Recalculates and persists porcentaje_avance for all parent tasks and the project.
 * Called after any task mutation (create/update/delete/progress patch).
 *
 * Uses a bottom-up pass so that multi-level trees always converge correctly.
 */
export async function recalcularProgresoProyecto(proyecto_id: number | string): Promise<void> {
  const id = Number(proyecto_id);

  const tareas = await getAll(
    'SELECT id, tarea_padre_id, estado, porcentaje_avance, peso FROM tareas WHERE proyecto_id = $1',
    [id]
  );

  if (tareas.length === 0) {
    await run('UPDATE proyectos SET porcentaje_avance = 0 WHERE id = $1', [id]);
    return;
  }

  // ── Bottom-up: update parent tasks from deepest to shallowest ──────────────
  // Build a sorted list of parent IDs from leaves up to roots.
  // We do multiple passes until no more parents need updating to handle
  // arbitrary nesting depth without requiring a sorted traversal.

  let working = tareas.map(t => ({ ...t })); // mutable copy

  // Identify all unique depths by repeatedly finding "current leaves"
  // (tasks whose children have all been processed already).
  const processed = new Set<number>();
  let maxPasses = 20; // safety cap

  while (maxPasses-- > 0) {
    // Find tasks that are parents of only already-processed OR leaf tasks
    const padres = working.filter(t =>
      !processed.has(t.id) &&
      working.some(h => h.tarea_padre_id === t.id) &&
      working.filter(h => h.tarea_padre_id === t.id).every(h =>
        processed.has(h.id) || !working.some(g => g.tarea_padre_id === h.id)
      )
    );

    if (padres.length === 0) break;

    for (const padre of padres) {
      const efectivo = calcularEfectivo(padre.id, working);
      // Persist to DB
      await run(
        'UPDATE tareas SET porcentaje_avance = $1 WHERE id = $2',
        [efectivo, padre.id]
      );
      // Update our working copy so ancestors use the new value
      const idx = working.findIndex(t => t.id === padre.id);
      if (idx >= 0) working[idx] = { ...working[idx], porcentaje_avance: efectivo };
      processed.add(padre.id);
    }
  }

  // ── Project progress = weighted average of root tasks ──────────────────────
  const raiz = working.filter(t => !t.tarea_padre_id);
  const totalPeso = raiz.reduce((sum: number, t: any) => sum + (t.peso ?? 1), 0);

  let progresoProyecto = 0;
  if (totalPeso > 0) {
    const pesado = raiz.reduce((sum: number, t: any) => {
      return sum + (t.peso ?? 1) * calcularEfectivo(t.id, working);
    }, 0);
    progresoProyecto = Math.round(pesado / totalPeso);
  }

  await run('UPDATE proyectos SET porcentaje_avance = $1 WHERE id = $2', [progresoProyecto, id]);
}
