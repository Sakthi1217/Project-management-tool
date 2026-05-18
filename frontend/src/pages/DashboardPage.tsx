import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardStats } from '../types';
import Header from '../components/shared/Header';
import {
  BarChart3,
  FolderKanban,
  ListTodo,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
} from 'lucide-react';
import { formatDate, getEstadoLabel } from '../utils/format';

function StatCard({ icon: Icon, label, value, color, subtext }: {
  icon: any; label: string; value: number; color: string; subtext?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: Array<{ estado: string; count: number }> }) {
  const total = data.reduce((acc, d) => acc + d.count, 0);
  if (total === 0) return <p className="text-gray-400 text-sm text-center py-8">No data</p>;

  const colors: Record<string, string> = {
    pendiente: '#9ca3af', en_progreso: '#eab308', completada: '#22c55e', bloqueada: '#ef4444',
    planificacion: '#a855f7', en_pausa: '#f97316', completado: '#3b82f6', cancelado: '#6b7280',
    activo: '#22c55e', inactivo: '#9ca3af',
  };

  let cumulative = 0;
  const segments = data.map((d) => {
    const pct = (d.count / total) * 100;
    const offset = cumulative;
    cumulative += pct;
    return { ...d, pct, offset, color: colors[d.estado] || '#9ca3af' };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="w-32 h-32 -rotate-90">
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx="18" cy="18" r="15.9155"
              fill="none"
              stroke={seg.color}
              strokeWidth="3"
              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
              strokeDashoffset={`${-seg.offset}`}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{total}</span>
        </div>
      </div>
      <div className="space-y-2">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600 dark:text-gray-400">{getEstadoLabel(seg.estado)}</span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboardStats().then((data) => { setStats(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <Header breadcrumbs={[{ label: 'Dashboard' }]} />
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={BarChart3} label="Active Programs" value={stats.programasActivos} color="bg-blue-100 text-blue-600" />
          <StatCard icon={FolderKanban} label="Projects In Progress" value={stats.proyectosEnCurso} color="bg-green-100 text-green-600" />
          <StatCard icon={CheckCircle2} label="Completed Tasks" value={stats.tareasCompletadas} color="bg-emerald-100 text-emerald-600" subtext={`of ${stats.totalTareas} total`} />
          <StatCard icon={AlertTriangle} label="Overdue Tasks" value={stats.tareasVencidas} color="bg-red-100 text-red-600" subtext={`${stats.tareasProximas} due soon`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tareas por Estado */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Tasks by Status</h3>
            <DonutChart data={stats.tareasPorEstado} />
          </div>

          {/* Proyectos por Estado */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">Projects by Status</h3>
            <DonutChart data={stats.proyectosPorEstado} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Milestones */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-primary-500" /> Upcoming Milestones (7 days)
            </h3>
            {stats.hitosProximos.length === 0 ? (
              <p className="text-gray-400 text-sm">No upcoming milestones</p>
            ) : (
              <div className="space-y-3">
                {stats.hitosProximos.map((h: any) => (
                  <div key={h.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.nombre}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{h.proyecto_nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-primary-500 bg-primary-50 px-2 py-1 rounded-full">
                      {formatDate(h.fecha)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-500" /> Quick Summary
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Delayed projects</span>
                <span className={`text-sm font-semibold ${stats.proyectosAtrasados > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.proyectosAtrasados}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Tasks in progress</span>
                <span className="text-sm font-semibold text-yellow-600">{stats.tareasEnProgreso}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Blocked tasks</span>
                <span className={`text-sm font-semibold ${stats.tareasBloqueadas > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {stats.tareasBloqueadas}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-400">Completion rate</span>
                <span className="text-sm font-semibold text-blue-600">
                  {stats.totalTareas > 0 ? Math.round((stats.tareasCompletadas / stats.totalTareas) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
