import { useState } from 'react';
import type { Responsable, Sprint } from '../../types';
import { Filter, X, Save } from 'lucide-react';

export interface TareaFilters {
  estado: string;
  prioridad: string;
  responsable_id: string;
  sprint_id: string;
  solo_vencidas: boolean;
  solo_sin_fecha: boolean;
  buscar: string;
}

const EMPTY_FILTERS: TareaFilters = {
  estado: '', prioridad: '', responsable_id: '', sprint_id: '',
  solo_vencidas: false, solo_sin_fecha: false, buscar: '',
};

interface FilterPanelProps {
  filters: TareaFilters;
  onChange: (f: TareaFilters) => void;
  responsables: Responsable[];
  sprints: Sprint[];
  storageKey: string;
}

export default function FilterPanel({ filters, onChange, responsables, sprints, storageKey }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<{ name: string; filters: TareaFilters }[]>(() => {
    try { return JSON.parse(localStorage.getItem(`filters_${storageKey}`) || '[]'); } catch { return []; }
  });
  const [saveName, setSaveName] = useState('');

  const activeCount = Object.entries(filters).filter(([k, v]) =>
    k !== 'buscar' ? (v !== '' && v !== false) : v !== ''
  ).length;

  const saveFilter = () => {
    if (!saveName.trim()) return;
    const updated = [...savedFilters, { name: saveName.trim(), filters }];
    setSavedFilters(updated);
    localStorage.setItem(`filters_${storageKey}`, JSON.stringify(updated));
    setSaveName('');
  };

  const deleteFilter = (idx: number) => {
    const updated = savedFilters.filter((_, i) => i !== idx);
    setSavedFilters(updated);
    localStorage.setItem(`filters_${storageKey}`, JSON.stringify(updated));
  };

  const selectClass = "w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 dark:text-white focus:ring-1 focus:ring-primary-500 outline-none";

  return (
    <div className="relative">
      {/* Search bar always visible */}
      <div className="flex items-center gap-2 mb-2">
        <input
          value={filters.buscar}
          onChange={e => onChange({ ...filters, buscar: e.target.value })}
          placeholder="Search task..."
          className="flex-1 px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
        />
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            activeCount > 0
              ? 'bg-primary-500 text-white border-primary-500'
              : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters {activeCount > 0 && <span className="bg-white/30 text-white px-1 rounded-full">{activeCount}</span>}
        </button>
        {activeCount > 0 && (
          <button onClick={() => onChange(EMPTY_FILTERS)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-400 hover:text-red-600" title="Clear filters">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Status</label>
              <select value={filters.estado} onChange={e => onChange({ ...filters, estado: e.target.value })} className={selectClass}>
                <option value="">All</option>
                <option value="pendiente">Pending</option>
                <option value="en_progreso">In Progress</option>
                <option value="completada">Completed</option>
                <option value="bloqueada">Blocked</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Priority</label>
              <select value={filters.prioridad} onChange={e => onChange({ ...filters, prioridad: e.target.value })} className={selectClass}>
                <option value="">All</option>
                <option value="critica">Critical</option>
                <option value="alta">High</option>
                <option value="media">Medium</option>
                <option value="baja">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Responsible</label>
              <select value={filters.responsable_id} onChange={e => onChange({ ...filters, responsable_id: e.target.value })} className={selectClass}>
                <option value="">All</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Sprint</label>
              <select value={filters.sprint_id} onChange={e => onChange({ ...filters, sprint_id: e.target.value })} className={selectClass}>
                <option value="">All</option>
                <option value="none">No Sprint</option>
                {sprints.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={filters.solo_vencidas} onChange={e => onChange({ ...filters, solo_vencidas: e.target.checked })} className="rounded accent-primary-500" />
              Overdue only
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <input type="checkbox" checked={filters.solo_sin_fecha} onChange={e => onChange({ ...filters, solo_sin_fecha: e.target.checked })} className="rounded accent-primary-500" />
              No date assigned
            </label>
          </div>

          {/* Save filter */}
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <input
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="Filter name..."
                className="flex-1 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button onClick={saveFilter} disabled={!saveName.trim()} className="flex items-center gap-1 px-2 py-1 bg-primary-500 text-white rounded text-xs font-medium disabled:opacity-40 hover:bg-primary-600">
                <Save className="w-3 h-3" /> Save
              </button>
            </div>
            {savedFilters.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {savedFilters.map((sf, idx) => (
                  <div key={idx} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                    <button onClick={() => onChange(sf.filters)} className="text-gray-600 dark:text-gray-300 hover:text-primary-600">
                      {sf.name}
                    </button>
                    <button onClick={() => deleteFilter(idx)} className="text-gray-400 hover:text-red-500">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function applyFilters(tareas: any[], filters: TareaFilters): any[] {
  return tareas.filter(t => {
    if (filters.buscar && !t.nombre.toLowerCase().includes(filters.buscar.toLowerCase())) return false;
    if (filters.estado && t.estado !== filters.estado) return false;
    if (filters.prioridad && t.prioridad !== filters.prioridad) return false;
    if (filters.responsable_id && String(t.responsable_id) !== filters.responsable_id) return false;
    if (filters.sprint_id === 'none' && t.sprint_id !== null) return false;
    if (filters.sprint_id && filters.sprint_id !== 'none' && String(t.sprint_id) !== filters.sprint_id) return false;
    if (filters.solo_vencidas && (!t.fecha_fin || new Date(t.fecha_fin) >= new Date())) return false;
    if (filters.solo_sin_fecha && (t.fecha_inicio || t.fecha_fin)) return false;
    return true;
  });
}
