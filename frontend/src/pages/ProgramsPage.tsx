import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import type { Programa, Proyecto, Responsable } from '../types';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import Badge from '../components/shared/Badge';
import ProgressBar from '../components/shared/ProgressBar';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import Avatar from '../components/shared/Avatar';
import { Plus, Pencil, Trash2, Layers, Search, Copy, ChevronDown, ChevronRight, FolderKanban, Eye } from 'lucide-react';
import { getEstadoColor, getEstadoLabel, formatDate, formatCurrency } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function ProgramsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [expandedPrograma, setExpandedPrograma] = useState<number | null>(null);
  const [programaProyectos, setProgramaProyectos] = useState<Record<number, Proyecto[]>>({});
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Programa | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    nombre: '', descripcion: '', estado: 'activo', fecha_inicio: '', fecha_fin: '',
    presupuesto: '', color: '#2563eb', responsable_id: '',
  });

  const load = () => {
    Promise.all([api.getProgramas(), api.getResponsables()])
      .then(([p, r]) => { setProgramas(p); setResponsables(r); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: '', descripcion: '', estado: 'activo', fecha_inicio: '', fecha_fin: '', presupuesto: '', color: '#2563eb', responsable_id: '' });
    setShowModal(true);
  };

  const openEdit = (p: Programa) => {
    setEditing(p);
    setForm({
      nombre: p.nombre, descripcion: p.descripcion || '', estado: p.estado,
      fecha_inicio: p.fecha_inicio || '', fecha_fin: p.fecha_fin || '',
      presupuesto: p.presupuesto?.toString() || '', color: p.color,
      responsable_id: p.responsable_id?.toString() || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      const data = { ...form, presupuesto: form.presupuesto ? parseFloat(form.presupuesto) : null, responsable_id: form.responsable_id ? parseInt(form.responsable_id) : null };
      if (editing) {
        await api.updatePrograma(editing.id, data);
        toast.success('Program updated');
      } else {
        await api.createPrograma(data);
        toast.success('Program created');
      }
      setShowModal(false);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deletePrograma(deleteId);
      toast.success('Program deleted');
      load();
    } catch (e: any) { toast.error(e.message); }
    setDeleteId(null);
  };

  const toggleProyectos = async (programaId: number) => {
    if (expandedPrograma === programaId) {
      setExpandedPrograma(null);
      return;
    }
    setExpandedPrograma(programaId);
    if (!programaProyectos[programaId]) {
      try {
        const proyectos = await api.getProyectosByPrograma(programaId);
        setProgramaProyectos(prev => ({ ...prev, [programaId]: proyectos }));
      } catch {
        setProgramaProyectos(prev => ({ ...prev, [programaId]: [] }));
      }
    }
  };

  const handleCopy = async (p: Programa) => {
    try {
      await api.copyPrograma(p.id);
      toast.success('Program duplicated');
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const filtered = programas.filter(p => p.nombre.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  return (
    <div>
      <Header
        breadcrumbs={[{ label: 'Programs' }]}
        actions={canEdit ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
            <Plus className="w-4 h-4" /> New Program
          </button>
        ) : undefined}
      />

      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Layers} title="No programs" description="No programs to display" action={canEdit ? { label: 'Create program', onClick: openCreate } : undefined} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{p.nombre}</h3>
                  </div>
                  <Badge className={getEstadoColor(p.estado)}>{getEstadoLabel(p.estado)}</Badge>
                </div>
                {p.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{p.descripcion}</p>}
                <div className="space-y-2 mb-3">
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Projects: {p.total_proyectos || 0}</span>
                    <span>{formatDate(p.fecha_inicio)} - {formatDate(p.fecha_fin)}</span>
                  </div>
                  {p.presupuesto && <p className="text-xs text-gray-500 dark:text-gray-400">Budget: {formatCurrency(p.presupuesto)}</p>}
                  <ProgressBar value={p.avance_promedio || 0} size="sm" />
                </div>
                {p.responsable_nombre && (
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar nombre={p.responsable_nombre} color={p.responsable_color} size="sm" />
                    <span className="text-xs text-gray-600 dark:text-gray-400">{p.responsable_nombre}</span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <button onClick={() => toggleProyectos(p.id)} className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 transition-colors">
                    {expandedPrograma === p.id ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    <FolderKanban className="w-3.5 h-3.5" />
                    <span>Projects ({p.total_proyectos || 0})</span>
                  </button>
                  <div className="flex gap-1">
                    {canEdit && (
                      <>
                        <button onClick={() => handleCopy(p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Duplicate"><Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"><Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" /></button>
                      </>
                    )}
                    {user?.rol === 'admin' && <button onClick={() => setDeleteId(p.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                  </div>
                </div>
                {expandedPrograma === p.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                    {(programaProyectos[p.id] || []).length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">No associated projects</p>
                    ) : (
                      (programaProyectos[p.id] || []).map(proy => (
                        <div key={proy.id} className="flex items-center justify-between gap-2 px-2 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{proy.nombre}</p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400">{proy.tareas_completadas || 0}/{proy.total_tareas || 0} tasks</p>
                          </div>
                          <Badge className={getEstadoColor(proy.estado) + ' text-[10px]'}>{getEstadoLabel(proy.estado)}</Badge>
                          <button onClick={() => navigate(`/projects/${proy.id}`)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"><Eye className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" /></button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Program' : 'New Program'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                <option value="activo">Active</option>
                <option value="inactivo">Inactive</option>
                <option value="completado">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Color</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
              <input type="date" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input type="date" value={form.fecha_fin} onChange={e => setForm({ ...form, fecha_fin: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Budget</label>
              <input type="number" value={form.presupuesto} onChange={e => setForm({ ...form, presupuesto: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Responsible</label>
              <select value={form.responsable_id} onChange={e => setForm({ ...form, responsable_id: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none">
                <option value="">Unassigned</option>
                {responsables.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">{editing ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Program" message="Are you sure? All associated projects and tasks will be deleted." />
    </div>
  );
}
