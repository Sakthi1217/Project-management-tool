export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getEstadoColor(estado: string): string {
  const colors: Record<string, string> = {
    activo: 'bg-green-100 text-green-800',
    inactivo: 'bg-gray-100 text-gray-800',
    completado: 'bg-blue-100 text-blue-800',
    planificacion: 'bg-purple-100 text-purple-800',
    en_progreso: 'bg-yellow-100 text-yellow-800',
    en_pausa: 'bg-orange-100 text-orange-800',
    cancelado: 'bg-red-100 text-red-800',
    pendiente: 'bg-gray-100 text-gray-800',
    completada: 'bg-green-100 text-green-800',
    bloqueada: 'bg-red-100 text-red-800',
  };
  return colors[estado] || 'bg-gray-100 text-gray-800';
}

export function getPrioridadColor(prioridad: string): string {
  const colors: Record<string, string> = {
    baja: 'bg-gray-100 text-gray-700',
    media: 'bg-blue-100 text-blue-700',
    alta: 'bg-orange-100 text-orange-700',
    critica: 'bg-red-100 text-red-700',
  };
  return colors[prioridad] || 'bg-gray-100 text-gray-700';
}

export function getPrioridadLabel(prioridad: string): string {
  const labels: Record<string, string> = {
    baja: 'Low',
    media: 'Medium',
    alta: 'High',
    critica: 'Critical',
  };
  return labels[prioridad] || prioridad;
}

export function getEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    activo: 'Active',
    inactivo: 'Inactive',
    completado: 'Completed',
    planificacion: 'Planning',
    en_progreso: 'In Progress',
    en_pausa: 'On Hold',
    cancelado: 'Cancelled',
    pendiente: 'Pending',
    completada: 'Completed',
    bloqueada: 'Blocked',
  };
  return labels[estado] || estado;
}

export function isOverdue(fechaFin: string | null): boolean {
  if (!fechaFin) return false;
  return new Date(fechaFin) < new Date(new Date().toISOString().split('T')[0]);
}

export function isDueSoon(fechaFin: string | null, days: number = 3): boolean {
  if (!fechaFin) return false;
  const today = new Date(new Date().toISOString().split('T')[0]);
  const due = new Date(fechaFin);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}
