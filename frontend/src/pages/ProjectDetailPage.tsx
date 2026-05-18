import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Proyecto, Tarea, Dependencia, Hito, Responsable, Sprint, ActividadItem } from '../types';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import Badge from '../components/shared/Badge';
import ProgressBar from '../components/shared/ProgressBar';
import Avatar from '../components/shared/Avatar';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import GanttView from '../components/gantt/GanttView';
import KanbanView from '../components/views/KanbanView';
import CalendarView from '../components/views/CalendarView';
import MondayTableView from '../components/views/MondayTableView';
import UpdatesWall from '../components/updates/UpdatesWall';
import ExportButtons from '../components/export/ExportButtons';
import AiAssistantPanel from '../components/ai/AiAssistantPanel';
import ActivityFeed from '../components/shared/ActivityFeed';
import FilterPanel, { applyFilters } from '../components/shared/FilterPanel';
import type { TareaFilters } from '../components/shared/FilterPanel';
import { Plus, Pencil, Trash2, ListTodo, GanttChart, ChevronRight, ChevronDown, Target, Calendar, Columns, MessageCircle, Zap, Bot, Activity } from 'lucide-react';
import { getEstadoColor, getEstadoLabel, formatDate, isOverdue, isDueSoon, getPrioridadLabel } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useT } from '../i18n';
import toast from 'react-hot-toast';

// Advance date to next working day if it falls on a non-working day
function adjustToWorkingDay(dateStr: string, diasLaborables: string): string {
  if (!dateStr) return dateStr;
  const workDays = diasLaborables.split(',').map(Number);
  // JS getDay(): 0=Sun,1=Mon..6=Sat → our format: 1=Mon..6=Sat,7=Sun
  const toOurDay = (d: number) => d === 0 ? 7 : d;
  const date = new Date(dateStr + 'T12:00:00');
  let attempts = 0;
  while (!workDays.includes(toOurDay(date.getDay())) && attempts < 7) {
    date.setDate(date.getDate() + 1);
    attempts++;
  }
  return date.toISOString().split('T')[0];
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const t = useT();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [dependencias, setDependencias] = useState<Dependencia[]>([]);
  const [hitosData, setHitos] = useState<Hito[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'gantt' | 'list' | 'kanban' | 'calendar' | 'hitos' | 'actividad'>('gantt');
  const [actividad, setActividad] = useState<ActividadItem[]>([]);
  const [filters, setFilters] = useState<TareaFilters>({ estado: '', prioridad: '', responsable_id: '', sprint_id: '', solo_vencidas: false, solo_sin_fecha: false, buscar: '' });
  const [updatesWallTarea, setUpdatesWallTarea] = useState<Tarea | null>(null);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showTareaModal, setShowTareaModal] = useState(false);
  const [showHitoModal, setShowHitoModal] = useState(false);
  const [editingTarea, setEditingTarea] = useState<Tarea | null>(null);
  const [editingHito, setEditingHito] = useState<Hito | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'tarea' | 'hito' | 'sprint'; id: number } | null>(null);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintForm, setSprintForm] = useState({
    nombre: '', descripcion: '', estado: 'planificacion', fecha_inicio: '', fecha_fin: '', objetivo: '',
  });

  const [tareaForm, setTareaForm] = useState({
    nombre: '', descripcion: '', estado: 'pendiente', prioridad: 'media', fecha_inicio: '', fecha_fin: '',
    duracion_dias: '', responsable_id: '', tarea_padre_id: '', sprint_id: '', orden: '0',
    porcentaje_avance: '0', story_points: '', peso: '1',
  });
  const [hitoForm, setHitoForm] = useState({ nombre: '', fecha: '', completado: false });

  const load = () => {
    if (!id) return;
    const pid = parseInt(id);
    Promise.all([
      api.getProyecto(pid), api.getTareasByProyecto(pid),
      api.getDependenciasByProyecto(pid), api.getHitosByProyecto(pid), api.getResponsables(),
      api.getSprintsByProyecto(pid).catch(() => []),
      api.getActividadByProyecto(pid).catch(() => []),
    ]).then(([p, t, d, h, r, s, act]) => {
      setProyecto(p); setTareas(t); setDependencias(d); setHitos(h); setResponsables(r); setSprints(s); setActividad(act);
      setExpanded(new Set(t.filter((ta: Tarea) => t.some((sub: Tarea) => sub.tarea_padre_id === ta.id)).map((ta: Tarea) => ta.id)));
      setLoading(false);
    }).catch(() => { setLoading(false); navigate('/projects'); });
  };

  useEffect(() => { load(); }, [id]);

  const openCreateTarea = (parentId?: number, sprintId?: number) => {
    setEditingTarea(null);
    setTareaForm({ nombre: '', descripcion: '', estado: 'pendiente', prioridad: 'media', fecha_inicio: '', fecha_fin: '', duracion_dias: '', responsable_id: '', tarea_padre_id: parentId?.toString() || '', sprint_id: sprintId?.toString() || '', orden: '0', porcentaje_avance: '0', story_points: '', peso: '1' });
    setShowTareaModal(true);
  };

  const openEditTarea = (t: Tarea) => {
    setEditingTarea(t);
    setTareaForm({
      nombre: t.nombre, descripcion: t.descripcion || '', estado: t.estado, prioridad: (t as any).prioridad || 'media',
      fecha_inicio: t.fecha_inicio || '', fecha_fin: t.fecha_fin || '',
      duracion_dias: t.duracion_dias?.toString() || '', responsable_id: t.responsable_id?.toString() || '',
      tarea_padre_id: t.tarea_padre_id?.toString() || '', sprint_id: t.sprint_id?.toString() || '', orden: t.orden.toString(),
      porcentaje_avance: t.porcentaje_avance?.toString() || '0', story_points: t.story_points?.toString() || '',
      peso: (t.peso ?? 1).toString(),
    });
    setShowTareaModal(true);
  };

  const handleSaveTarea = async () => {
    try {
      const data = {
        ...tareaForm, proyecto_id: parseInt(id!),
        duracion_dias: tareaForm.duracion_dias ? parseInt(tareaForm.duracion_dias) : null,
        responsable_id: tareaForm.responsable_id ? parseInt(tareaForm.responsable_id) : null,
        tarea_padre_id: tareaForm.tarea_padre_id ? parseInt(tareaForm.tarea_padre_id) : null,
        sprint_id: tareaForm.sprint_id ? parseInt(tareaForm.sprint_id) : null,
        orden: parseInt(tareaForm.orden),
        porcentaje_avance: parseInt(tareaForm.porcentaje_avance) || 0,
        story_points: tareaForm.story_points ? parseInt(tareaForm.story_points) : null,
        peso: parseInt(tareaForm.peso) || 1,
      };
      if (editingTarea) { await api.updateTarea(editingTarea.id, data); toast.success('Task updated'); }
      else { await api.createTarea(data); toast.success('Task created'); }
      setShowTareaModal(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSaveHito = async () => {
    try {
      const data = { ...hitoForm, proyecto_id: parseInt(id!) };
      if (editingHito) { await api.updateHito(editingHito.id, data); toast.success('Milestone updated'); }
      else { await api.createHito(data); toast.success('Milestone created'); }
      setShowHitoModal(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSaveSprint = async () => {
    try {
      const data = { ...sprintForm, proyecto_id: parseInt(id!), orden: sprints.length };
      if (editingSprint) { await api.updateSprint(editingSprint.id, data); toast.success('Sprint updated'); }
      else { await api.createSprint(data); toast.success('Sprint created'); }
      setShowSprintModal(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openEditSprint = (s: Sprint) => {
    setEditingSprint(s);
    setSprintForm({
      nombre: s.nombre, descripcion: s.descripcion || '', estado: s.estado,
      fecha_inicio: s.fecha_inicio || '', fecha_fin: s.fecha_fin || '', objetivo: s.objetivo || '',
    });
    setShowSprintModal(true);
  };

  const openCreateSprint = () => {
    setEditingSprint(null);
    setSprintForm({ nombre: '', descripcion: '', estado: 'planificacion', fecha_inicio: '', fecha_fin: '', objetivo: '' });
    setShowSprintModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'tarea') await api.deleteTarea(deleteTarget.id);
      else if (deleteTarget.type === 'sprint') await api.deleteSprint(deleteTarget.id);
      else await api.deleteHito(deleteTarget.id);
      toast.success(`${deleteTarget.type === 'tarea' ? 'Task' : deleteTarget.type === 'sprint' ? 'Sprint' : 'Milestone'} deleted`);
      load();
    } catch (e: any) { toast.error(e.message); }
    setDeleteTarget(null);
  };

  const handleReorderTareas = async (items: { id: number; orden: number }[]) => {
    try {
      await api.reorderTareas(items);
      load();
    } catch {
      toast.error('Error reordering tasks');
    }
  };

  const handleReorderHitos = async (items: { id: number; orden?: number; gantt_orden?: number }[]) => {
    try {
      await api.reorderHitos(items);
      load();
    } catch {
      toast.error('Error reordering milestones');
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const rootTareas = tareas.filter(t => !t.tarea_padre_id);
  const getChildren = (parentId: number) => tareas.filter(t => t.tarea_padre_id === parentId);

  const renderTareaRow = (tarea: Tarea, level: number = 0) => {
    const children = getChildren(tarea.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(tarea.id);
    const overdue = isOverdue(tarea.fecha_fin) && tarea.estado !== 'completada';
    const dueSoon = isDueSoon(tarea.fecha_fin) && tarea.estado !== 'completada';

    return (
      <div key={tarea.id}>
        <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${overdue ? 'bg-red-50 dark:bg-red-900/20' : dueSoon ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}>
          <div style={{ paddingLeft: `${level * 24}px` }} className="flex items-center gap-2 flex-1 min-w-0">
            {hasChildren ? (
              <button onClick={() => toggleExpand(tarea.id)} className="p-0.5">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
              </button>
            ) : <div className="w-5" />}
            <span className="text-sm text-gray-900 dark:text-gray-100 truncate font-medium">{tarea.nombre}</span>
          </div>
          <Badge className={`${getEstadoColor(tarea.estado)} flex-shrink-0`}>{getEstadoLabel(tarea.estado)}</Badge>
          {tarea.responsable_nombre && <Avatar nombre={tarea.responsable_nombre} color={tarea.responsable_color} size="sm" />}
          <span className={`text-xs flex-shrink-0 w-28 text-right ${overdue ? 'text-red-600 font-semibold' : dueSoon ? 'text-yellow-600 font-semibold' : 'text-gray-500 dark:text-gray-400'}`}>
            {formatDate(tarea.fecha_inicio)} - {formatDate(tarea.fecha_fin)}
          </span>
          <button onClick={() => setUpdatesWallTarea(tarea)} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded flex-shrink-0" title="Updates">
            <MessageCircle className="w-3.5 h-3.5 text-gray-400 hover:text-primary-500" />
          </button>
          {canEdit && (
            <div className="flex gap-1 flex-shrink-0">
              {hasChildren || !tarea.tarea_padre_id ? (
                <button onClick={() => openCreateTarea(tarea.id)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded" title="Add subtask"><Plus className="w-3.5 h-3.5 text-gray-400" /></button>
              ) : null}
              <button onClick={() => openEditTarea(tarea)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
              {user?.rol === 'admin' && <button onClick={() => setDeleteTarget({ type: 'tarea', id: tarea.id })} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
            </div>
          )}
        </div>
        {hasChildren && isExpanded && children.map(c => renderTareaRow(c, level + 1))}
      </div>
    );
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;
  if (!proyecto) return null;

  return (
    <div>
      <Header
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: proyecto.nombre }]}
        actions={<ExportButtons proyecto={proyecto} tareas={tareas} hitos={hitosData} />}
      />

      <div className="p-4 sm:p-6">
        {/* Project Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-5 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{proyecto.nombre}</h2>
              {proyecto.descripcion && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{proyecto.descripcion}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge className={getEstadoColor(proyecto.estado)}>{getEstadoLabel(proyecto.estado)}</Badge>
              <Badge className={`${(proyecto as any).prioridad ? '' : ''}${getPrioridadColorLocal(proyecto.prioridad)}`}>{getPrioridadLabel(proyecto.prioridad)}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Program</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{proyecto.programa_nombre || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Responsible</p>
              <div className="flex items-center gap-2 mt-0.5">
                {proyecto.responsable_nombre ? (
                  <>
                    <Avatar nombre={proyecto.responsable_nombre} color={proyecto.responsable_color} size="sm" />
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{proyecto.responsable_nombre}</span>
                  </>
                ) : <span className="text-sm text-gray-400">Unassigned</span>}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Dates</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(proyecto.fecha_inicio)} → {formatDate(proyecto.fecha_fin)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Progress</p>
              <ProgressBar value={proyecto.porcentaje_avance} />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('workdays.label')}</p>
              <div className="flex gap-1 mt-1">
                {['M','T','W','T','F','S','S'].map((dia, idx) => {
                  const val = String(idx + 1);
                  const active = proyecto.dias_laborables?.split(',').includes(val);
                  return (
                    <span key={idx} className={`text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded ${active ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {dia}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {[
              { key: 'gantt', icon: GanttChart, label: t('tab.gantt') },
              { key: 'list', icon: ListTodo, label: t('tab.table') },
              { key: 'kanban', icon: Columns, label: t('tab.kanban') },
              { key: 'calendar', icon: Calendar, label: t('tab.calendar') },
              { key: 'hitos', icon: Target, label: t('tab.milestones') },
              { key: 'actividad', icon: Activity, label: t('tab.activity') },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] whitespace-nowrap flex-shrink-0 ${
                  tab === key ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
            {canEdit && tab !== 'hitos' && tab !== 'calendar' && tab !== 'actividad' && (
              <div className="ml-auto pb-2 flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setShowAiAssistant(true)} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-xs font-medium hover:from-purple-600 hover:to-indigo-600 transition-all">
                  <Bot className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('btn.aiAssistant')}</span>
                </button>
                <button onClick={openCreateSprint} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-purple-500 text-white rounded-lg text-xs font-medium hover:bg-purple-600 transition-colors">
                  <Zap className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('btn.newSprint')}</span>
                </button>
                <button onClick={() => openCreateTarea()} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('btn.newTask')}</span>
                </button>
              </div>
            )}
            {canEdit && tab === 'hitos' && (
              <div className="ml-auto pb-2 flex-shrink-0">
                <button onClick={() => { setEditingHito(null); setHitoForm({ nombre: '', fecha: '', completado: false }); setShowHitoModal(true); }} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-primary-500 text-white rounded-lg text-xs font-medium hover:bg-primary-600 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{t('btn.newMilestone')}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {tab === 'gantt' && (
          <GanttView tareas={tareas} dependencias={dependencias} hitos={hitosData} onUpdate={load} onReorder={canEdit ? handleReorderTareas : undefined} onReorderHitos={canEdit ? handleReorderHitos : undefined} onEditTarea={canEdit ? openEditTarea : undefined} readOnly={!canEdit} />
        )}

        {tab === 'list' && (
          <div className="space-y-3">
            <FilterPanel
              filters={filters}
              onChange={setFilters}
              responsables={responsables}
              sprints={sprints}
              storageKey={`proyecto-${id}`}
            />
            <MondayTableView
              tareas={applyFilters(tareas, filters)}
              sprints={sprints}
              responsables={responsables}
              onEditTarea={openEditTarea}
              onCreateTarea={openCreateTarea}
              onDeleteTarea={(tid) => setDeleteTarget({ type: 'tarea', id: tid })}
              onOpenUpdates={(tarea) => setUpdatesWallTarea(tarea)}
              onEditSprint={openEditSprint}
              onDeleteSprint={(sid) => setDeleteTarget({ type: 'sprint', id: sid })}
              onReorder={canEdit ? handleReorderTareas : undefined}
              canEdit={canEdit}
              isAdmin={user?.rol === 'admin'}
            />
          </div>
        )}

        {tab === 'kanban' && (
          <KanbanView
            tareas={tareas}
            responsables={responsables}
            onUpdate={load}
            onEditTarea={openEditTarea}
            onOpenUpdates={(tarea) => setUpdatesWallTarea(tarea)}
            readOnly={!canEdit}
          />
        )}

        {tab === 'calendar' && (
          <CalendarView
            tareas={tareas}
            hitos={hitosData}
            onTareaClick={(tarea) => setUpdatesWallTarea(tarea)}
          />
        )}

        {tab === 'actividad' && <ActivityFeed actividad={actividad} />}

        {tab === 'hitos' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {hitosData.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">{t('milestone.none')}</div>
            ) : (
              hitosData.map(h => (
                <div key={h.id} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className={`w-3 h-3 rotate-45 flex-shrink-0 ${h.completado ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{h.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(h.fecha)}</span>
                  </div>
                  <Badge className={h.completado ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                    {h.completado ? t('milestone.completed') : t('milestone.pending')}
                  </Badge>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingHito(h); setHitoForm({ nombre: h.nombre, fecha: h.fecha, completado: !!h.completado }); setShowHitoModal(true); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"><Pencil className="w-3.5 h-3.5 text-gray-400" /></button>
                      {user?.rol === 'admin' && <button onClick={() => setDeleteTarget({ type: 'hito', id: h.id })} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Tarea Modal */}
      <Modal isOpen={showTareaModal} onClose={() => setShowTareaModal(false)} title={editingTarea ? t('task.edit') : t('task.new')} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.name')} *</label>
            <input value={tareaForm.nombre} onChange={e => setTareaForm({ ...tareaForm, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.description')}</label>
            <textarea value={tareaForm.descripcion} onChange={e => setTareaForm({ ...tareaForm, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.status')}</label>
            <select value={tareaForm.estado} onChange={e => {
              const nuevoEstado = e.target.value;
              const avance = nuevoEstado === 'completada' ? '100' : nuevoEstado === 'pendiente' ? '0' : tareaForm.porcentaje_avance;
              setTareaForm({ ...tareaForm, estado: nuevoEstado, porcentaje_avance: avance });
            }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="pendiente">{t('status.pending')}</option>
              <option value="en_progreso">{t('status.inProgress')}</option>
              <option value="completada">{t('status.completed')}</option>
              <option value="bloqueada">{t('status.blocked')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.priority')}</label>
            <select value={tareaForm.prioridad} onChange={e => setTareaForm({ ...tareaForm, prioridad: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="baja">{t('priority.low')}</option>
              <option value="media">{t('priority.medium')}</option>
              <option value="alta">{t('priority.high')}</option>
              <option value="critica">{t('priority.critical')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.responsible')}</label>
            <select value={tareaForm.responsable_id} onChange={e => setTareaForm({ ...tareaForm, responsable_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t('common.noAssigned')}</option>
              {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('task.startDate')}
              {proyecto?.dias_laborables && proyecto.dias_laborables !== '1,2,3,4,5,6,7' && (
                <span className="ml-1 text-xs text-gray-400">{t('task.workingDaysNote')}</span>
              )}
            </label>
            <input
              type="date"
              value={tareaForm.fecha_inicio}
              onChange={e => {
                const adjusted = adjustToWorkingDay(e.target.value, proyecto?.dias_laborables || '1,2,3,4,5');
                setTareaForm({ ...tareaForm, fecha_inicio: adjusted });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('task.endDate')}
              {proyecto?.dias_laborables && proyecto.dias_laborables !== '1,2,3,4,5,6,7' && (
                <span className="ml-1 text-xs text-gray-400">{t('task.workingDaysNote')}</span>
              )}
            </label>
            <input
              type="date"
              value={tareaForm.fecha_fin}
              onChange={e => {
                const adjusted = adjustToWorkingDay(e.target.value, proyecto?.dias_laborables || '1,2,3,4,5');
                setTareaForm({ ...tareaForm, fecha_fin: adjusted });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.duration')}</label>
            <input type="number" value={tareaForm.duracion_dias} onChange={e => setTareaForm({ ...tareaForm, duracion_dias: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.parent')}</label>
            <select value={tareaForm.tarea_padre_id} onChange={e => setTareaForm({ ...tareaForm, tarea_padre_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t('task.noParent')}</option>
              {tareas.filter(t => !t.tarea_padre_id && t.id !== editingTarea?.id).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.sprint')}</label>
            <select value={tareaForm.sprint_id} onChange={e => setTareaForm({ ...tareaForm, sprint_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t('task.noSprint')}</option>
              {sprints.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('task.storyPoints')}</label>
            <input type="number" min="0" max="100" value={tareaForm.story_points} onChange={e => setTareaForm({ ...tareaForm, story_points: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="ej: 3, 5, 8..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('task.weight')} <span className="text-xs text-gray-400">{t('task.weightNote')}</span>
            </label>
            <input type="number" min="1" max="100" value={tareaForm.peso} onChange={e => setTareaForm({ ...tareaForm, peso: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="1" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            {(() => {
              const tieneHijos = editingTarea ? tareas.some(t => t.tarea_padre_id === editingTarea.id) : false;
              const autoByEstado = tareaForm.estado === 'completada' || tareaForm.estado === 'pendiente';
              const isDisabled = tieneHijos || autoByEstado;
              const displayValue = autoByEstado
                ? (tareaForm.estado === 'completada' ? '100' : '0')
                : tareaForm.porcentaje_avance;
              return (
                <>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('task.progress')}
                    {tieneHijos && (
                      <span className="ml-2 text-xs text-blue-500 dark:text-blue-400">
                        {t('task.autoFromChildren')}
                      </span>
                    )}
                    {!tieneHijos && autoByEstado && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        ({tareaForm.estado === 'completada' ? 'Auto: 100%' : 'Auto: 0%'})
                      </span>
                    )}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min="0" max="100" step="5"
                      value={displayValue}
                      disabled={isDisabled}
                      onChange={e => setTareaForm({ ...tareaForm, porcentaje_avance: e.target.value })}
                      className="flex-1 accent-primary-500 disabled:opacity-40"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-10 text-right">
                      {displayValue}%
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-4">
            <button onClick={() => setShowTareaModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
            <button onClick={handleSaveTarea} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600">{editingTarea ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      </Modal>

      {/* Hito Modal */}
      <Modal isOpen={showHitoModal} onClose={() => setShowHitoModal(false)} title={editingHito ? t('milestone.edit') : t('milestone.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('milestone.name')} *</label>
            <input value={hitoForm.nombre} onChange={e => setHitoForm({ ...hitoForm, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('milestone.date')} *</label>
            <input type="date" value={hitoForm.fecha} onChange={e => setHitoForm({ ...hitoForm, fecha: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="completado" checked={hitoForm.completado} onChange={e => setHitoForm({ ...hitoForm, completado: e.target.checked })} className="rounded border-gray-300" />
            <label htmlFor="completado" className="text-sm text-gray-700 dark:text-gray-300">{t('milestone.completed')}</label>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowHitoModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
            <button onClick={handleSaveHito} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600">{editingHito ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      </Modal>

      {/* Sprint Modal */}
      <Modal isOpen={showSprintModal} onClose={() => setShowSprintModal(false)} title={editingSprint ? t('sprint.edit') : t('sprint.new')} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.name')} *</label>
            <input value={sprintForm.nombre} onChange={e => setSprintForm({ ...sprintForm, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.description')}</label>
            <textarea value={sprintForm.descripcion} onChange={e => setSprintForm({ ...sprintForm, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.status')}</label>
            <select value={sprintForm.estado} onChange={e => setSprintForm({ ...sprintForm, estado: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="planificacion">{t('sprint.status.planning')}</option>
              <option value="activo">{t('sprint.status.active')}</option>
              <option value="completado">{t('sprint.status.completed')}</option>
              <option value="cancelado">{t('sprint.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.goal')}</label>
            <input value={sprintForm.objetivo} onChange={e => setSprintForm({ ...sprintForm, objetivo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.startDate')}</label>
            <input type="date" value={sprintForm.fecha_inicio} onChange={e => setSprintForm({ ...sprintForm, fecha_inicio: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('sprint.endDate')}</label>
            <input type="date" value={sprintForm.fecha_fin} onChange={e => setSprintForm({ ...sprintForm, fecha_fin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-4">
            <button onClick={() => setShowSprintModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">{t('common.cancel')}</button>
            <button onClick={handleSaveSprint} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600">{editingSprint ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteTarget !== null} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={`Delete ${deleteTarget?.type === 'tarea' ? 'Task' : deleteTarget?.type === 'sprint' ? 'Sprint' : 'Milestone'}`} message="Are you sure you want to delete this item?" />

      {/* Updates Wall Slide-over */}
      {updatesWallTarea && (
        <UpdatesWall
          tarea={updatesWallTarea}
          responsables={responsables}
          isOpen={!!updatesWallTarea}
          onClose={() => setUpdatesWallTarea(null)}
        />
      )}

      {proyecto && (
        <AiAssistantPanel
          isOpen={showAiAssistant}
          onClose={() => setShowAiAssistant(false)}
          proyectoId={parseInt(id!)}
          proyectoNombre={proyecto.nombre}
          onUpdate={load}
        />
      )}
    </div>
  );
}

function getPrioridadColorLocal(prioridad: string): string {
  const colors: Record<string, string> = {
    baja: 'bg-gray-100 text-gray-700',
    media: 'bg-blue-100 text-blue-700',
    alta: 'bg-orange-100 text-orange-700',
    critica: 'bg-red-100 text-red-700',
  };
  return colors[prioridad] || 'bg-gray-100 text-gray-700';
}