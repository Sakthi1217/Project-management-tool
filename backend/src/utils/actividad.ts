import { run } from '../db/database.js';

export async function logActividad(
  proyecto_id: number,
  user: { id: number; nombre: string } | null,
  tipo: string,
  descripcion: string,
  entidad_tipo?: string,
  entidad_id?: number
) {
  try {
    await run(
      'INSERT INTO proyecto_actividad (proyecto_id, usuario_id, usuario_nombre, tipo, descripcion, entidad_tipo, entidad_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [proyecto_id, user?.id || null, user?.nombre || 'Sistema', tipo, descripcion, entidad_tipo || null, entidad_id || null]
    );
  } catch {
    // Never fail the main operation due to activity logging
  }
}
