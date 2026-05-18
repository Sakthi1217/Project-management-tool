export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'editor' | 'viewer';
}

export interface Responsable {
  id: number;
  nombre: string;
  email: string | null;
  rol: string | null;
  avatar_url: string | null;
  color: string;
  tareas_pendientes?: number;
  total_tareas?: number;
  total_proyectos?: number;
  created_at: string;
  updated_at: string;
}

export interface Programa {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: 'activo' | 'inactivo' | 'completado';
  fecha_inicio: string | null;
  fecha_fin: string | null;
  presupuesto: number | null;
  color: string;
  responsable_id: number | null;
  responsable_nombre?: string;
  responsable_color?: string;
  total_proyectos?: number;
  avance_promedio?: number;
  created_at: string;
  updated_at: string;
}

export interface Proyecto {
  id: number;
  programa_id: number | null;
  nombre: string;
  descripcion: string | null;
  estado: 'planificacion' | 'en_progreso' | 'en_pausa' | 'completado' | 'cancelado';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  fecha_inicio: string | null;
  fecha_fin: string | null;
  porcentaje_avance: number;
  responsable_id: number | null;
  responsable_nombre?: string;
  responsable_color?: string;
  programa_nombre?: string;
  programa_color?: string;
  total_tareas?: number;
  tareas_completadas?: number;
  dias_laborables?: string;
  created_at: string;
  updated_at: string;
}

export interface Tarea {
  id: number;
  proyecto_id: number;
  nombre: string;
  descripcion: string | null;
  estado: 'pendiente' | 'en_progreso' | 'completada' | 'bloqueada';
  prioridad: 'baja' | 'media' | 'alta' | 'critica';
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_dias: number | null;
  responsable_id: number | null;
  tarea_padre_id: number | null;
  sprint_id: number | null;
  sprint_nombre?: string;
  orden: number;
  responsable_nombre?: string;
  responsable_color?: string;
  responsable_email?: string;
  porcentaje_avance: number;
  story_points: number | null;
  peso: number;
  created_at: string;
  updated_at: string;
}

export interface Dependencia {
  id: number;
  tarea_id: number;
  tarea_dependiente_id: number;
  tipo: 'fin_a_inicio' | 'inicio_a_inicio' | 'fin_a_fin';
}

export interface Hito {
  id: number;
  proyecto_id: number;
  nombre: string;
  fecha: string;
  completado: number;
  orden?: number;
  gantt_orden?: number;
  proyecto_nombre?: string;
  created_at: string;
  updated_at: string;
}

export interface ArchivoAdjunto {
  id: number;
  tarea_id: number;
  comentario_id: number | null;
  usuario_id: number;
  nombre_original: string;
  nombre_archivo: string;
  mime_type: string;
  tamano: number;
  created_at: string;
}

export interface Mencion {
  responsable_id: number;
  responsable_nombre: string;
}

export interface Comentario {
  id: number;
  tarea_id: number;
  usuario_id: number;
  contenido: string;
  usuario_nombre: string;
  usuario_email: string;
  archivos: ArchivoAdjunto[];
  menciones: Mencion[];
  created_at: string;
  updated_at: string;
}

export interface Sprint {
  id: number;
  proyecto_id: number;
  nombre: string;
  descripcion: string | null;
  estado: 'planificacion' | 'activo' | 'completado' | 'cancelado';
  fecha_inicio: string | null;
  fecha_fin: string | null;
  objetivo: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
}

export interface ActividadItem {
  id: number;
  proyecto_id: number;
  usuario_id: number | null;
  usuario_nombre: string;
  tipo: string;
  descripcion: string;
  entidad_tipo: string | null;
  entidad_id: number | null;
  created_at: string;
}

export interface DashboardStats {
  programasActivos: number;
  proyectosEnCurso: number;
  totalTareas: number;
  tareasCompletadas: number;
  tareasPendientes: number;
  tareasEnProgreso: number;
  tareasBloqueadas: number;
  tareasVencidas: number;
  tareasProximas: number;
  proyectosAtrasados: number;
  hitosProximos: Hito[];
  proyectosPorEstado: Array<{ estado: string; count: number }>;
  tareasPorEstado: Array<{ estado: string; count: number }>;
}
