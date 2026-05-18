import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Proyecto, Programa, Responsable } from '../types';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import Badge from '../components/shared/Badge';
import ProgressBar from '../components/shared/ProgressBar';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import Avatar from '../components/shared/Avatar';
import { Plus, Pencil, Trash2, FolderKanban, Search, LayoutList, Columns3, Eye, Copy } from 'lucide-react';
import { getEstadoColor, getPrioridadColor, getPrioridadLabel, getEstadoLabel, formatDate, isOverdue, isDueSoon } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import { useLangStore } from '../store/langStore';
import { useT } from '../i18n';
import toast from 'react-hot-toast';

const estadosKanban = ['planificacion', 'en_progreso', 'en_pausa', 'completado', 'cancelado'];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { lang } = useLangStore();
  const t = useT();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Proyecto | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [filterPrograma, setFilterPrograma] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterPrioridad, setFilterPrioridad] = useState('');
  const [form, setForm] = useState({
    programa_id: '', nombre: '', descripcion: '', estado: 'planificacion', prioridad: 'media',
    fecha_inicio: '', fecha_fin: '', porcentaje_avance: '0', responsable_id: '',
    dias_laborables: '1,2,3,4,5',
  });

  const load = () => {
    const params: Record<string, string> = {};
    if (filterPrograma) params.programa_id = filterPrograma;
    if (filterEstado) params.estado = filterEstado;
    if (filterPrioridad) params.prioridad = filterPrioridad;
    Promise.all([api.getProyectos(params), api.getProgramas(), api.getResponsables()])
      .then(([p, prog, r]) => { setProyectos(p); setProgramas(prog); setResponsables(r); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterPrograma, filterEstado, filterPrioridad]);

  const openCreate = () => {
    setEditing(null);
    setForm({ programa_id: '', nombre: '', descripcion: '', estado: 'planificacion', prioridad: 'media', fecha_inicio: '', fecha_fin: '', porcentaje_avance: '0', responsable_id: '', dias_laborables: '1,2,3,4,5' });
    setShowModal(true);
  };

  const openEdit = (p: Proyecto) => {
    setEditing(p);
    setForm({
      programa_id: p.programa_id?.toString() || '', nombre: p.nombre, descripcion: p.descripcion || '',
      estado: p.estado, prioridad: p.prioridad, fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '',
      porcentaje_avance: p.porcentaje_avance.toString(), responsable_id: p.responsable_id?.toString() || '',
      dias_laborables: p.dias_laborables || '1,2,3,4,5',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        ...form,
        programa_id: form.programa_id ? parseInt(form.programa_id) : null,
        porcentaje_avance: parseInt(form.porcentaje_avance),
        responsable_id: form.responsable_id ? parseInt(form.responsable_id) : null,
      };
      if (editing) { await api.updateProyecto(editing.id, data); toast.success('Project updated'); }
      else { await api.createProyecto(data); toast.success('Project created'); }
      setShowModal(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.deleteProyecto(deleteId); toast.success('Project deleted'); load(); } catch (e: any) { toast.error(e.message); }
    setDeleteId(null);
  };

  const handleCopy = async (p: Proyecto) => {
    try {
      await api.copyProyecto(p.id);
      toast.success('Project duplicated');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = proyectos.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));

  const ProjectCard = ({ p }: { p: Proyecto }) => (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border p-4 hover:shadow-md transition-shadow ${isOverdue(p.fecha_fin) && p.estado !== 'completado' ? 'border-red-300 dark:border-red-700' : isDueSoon(p.fecha_fin) && p.estado !== 'completado' ? 'border-yellow-300 dark:border-yellow-700' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{p.nombre}</h3>
        <Badge className={getPrioridadColor(p.prioridad)}>{getPrioridadLabel(p.prioridad)}</Badge>
      </div>
      {p.programa_nombre && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.programa_color || '#ccc' }} />
          <span className="text-xs text-gray-500">{p.programa_nombre}</span>
        </div>
      )}
      <Badge className={`${getEstadoColor(p.estado)} mb-2`}>{getEstadoLabel(p.estado)}</Badge>
      <div className="mt-2">
        <ProgressBar value={p.porcentaje_avance} size="sm" />
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
        <span>{formatDate(p.fecha_inicio)} - {formatDate(p.fecha_fin)}</span>
        <span>{p.tareas_completadas || 0}/{p.total_tareas || 0} tasks</span>
      </div>
      {p.responsable_nombre && (
        <div className="flex items-center gap-2 mt-2">
          <Avatar nombre={p.responsable_nombre} color={p.responsable_color} size="sm" />
          <span className="text-xs text-gray-600 dark:text-gray-400">{p.responsable_nombre}</span>
        </div>
      )}
      <div className="flex justify-end gap-1 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
        <button onClick={() => navigate(`/projects/${p.id}`)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
        {canEdit && <button onClick={() => handleCopy(p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Duplicate"><Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>}
        {canEdit && <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>}
        {user?.rol === 'admin' && <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-500" /></button>}
      </div>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  return (
    <div>
      <Header
        breadcrumbs={[{ label: 'Projects' }]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              <button onClick={() => setView('list')} className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}><LayoutList className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
              <button onClick={() => setView('kanban')} className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}><Columns3 className="w-4 h-4 text-gray-600 dark:text-gray-300" /></button>
            </div>
            {canEdit && (
              <button onClick={openCreate} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('btn.newProject')}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('common.search')} className="w-full sm:w-auto pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <select value={filterPrograma} onChange={e => setFilterPrograma(e.target.value)} className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
            <option value="">{t('project.allPrograms')}</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
            <option value="">{t('project.allStatuses')}</option>
            <option value="planificacion">{t('projectStatus.planning')}</option>
            <option value="en_progreso">{t('projectStatus.inProgress')}</option>
            <option value="en_pausa">{t('projectStatus.paused')}</option>
            <option value="completado">{t('projectStatus.completed')}</option>
            <option value="cancelado">{t('projectStatus.cancelled')}</option>
          </select>
          <select value={filterPrioridad} onChange={e => setFilterPrioridad(e.target.value)} className="w-full sm:w-auto px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
            <option value="">{t('project.allPriorities')}</option>
            <option value="baja">{t('priority.low')}</option>
            <option value="media">{t('priority.medium')}</option>
            <option value="alta">{t('priority.high')}</option>
            <option value="critica">{t('priority.critical')}</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={FolderKanban} title={t('empty.noProjects')} description={t('empty.noProjectsDesc')} action={canEdit ? { label: t('empty.createProject'), onClick: openCreate } : undefined} />
        ) : view === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {estadosKanban.map(estado => (
              <div key={estado} className="flex-shrink-0 w-72">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{getEstadoLabel(estado)}</h3>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {filtered.filter(p => p.estado === estado).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {filtered.filter(p => p.estado === estado).map(p => <ProjectCard key={p.id} p={p} />)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? t('project.edit') : t('project.new')} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.name')} *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.description')}</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.program')}</label>
            <select value={form.programa_id} onChange={e => setForm({ ...form, programa_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t('project.noProgram')}</option>
              {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.responsible')}</label>
            <select value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="">{t('common.noAssigned')}</option>
              {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.status')}</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="planificacion">{t('projectStatus.planning')}</option>
              <option value="en_progreso">{t('projectStatus.inProgress')}</option>
              <option value="en_pausa">{t('projectStatus.paused')}</option>
              <option value="completado">{t('projectStatus.completed')}</option>
              <option value="cancelado">{t('projectStatus.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.priority')}</label>
            <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
              <option value="baja">{t('priority.low')}</option>
              <option value="media">{t('priority.medium')}</option>
              <option value="alta">{t('priority.high')}</option>
              <option value="critica">{t('priority.critical')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.startDate')}</label>
            <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.endDate')}</label>
            <input type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('project.workingDays')}</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { val: '1', key: 'day.mon' as const }, { val: '2', key: 'day.tue' as const }, { val: '3', key: 'day.wed' as const },
                { val: '4', key: 'day.thu' as const }, { val: '5', key: 'day.fri' as const },
                { val: '6', key: 'day.sat' as const }, { val: '7', key: 'day.sun' as const },
              ].map(({ val, key }) => {
                const label = t(key);
                const active = form.dias_laborables.split(',').includes(val);
                const isWeekend = val === '6' || val === '7';
                const toggle = () => {
                  const days = form.dias_laborables ? form.dias_laborables.split(',').filter(Boolean) : [];
                  const next = active ? days.filter(d => d !== val) : [...days, val].sort();
                  setForm({ ...form, dias_laborables: next.join(',') || '1' });
                };
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={toggle}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
                      active
                        ? isWeekend ? 'bg-orange-500 text-white border-orange-500' : 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {!form.dias_laborables.split(',').includes('6') && !form.dias_laborables.split(',').includes('7') && (
              <p className="text-xs text-green-600 mt-1">{t('project.weekendsExcluded')}</p>
            )}
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project.progress')}: {form.porcentaje_avance}%</label>
            <input type="range" min="0" max="100" value={form.porcentaje_avance} onChange={e => setForm({ ...form, porcentaje_avance: e.target.value })} className="w-full" />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">{t('common.cancel')}</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">{editing ? t('common.save') : t('common.create')}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Project" message={t('confirm.deleteProject')} />
    </div>
  );
}
