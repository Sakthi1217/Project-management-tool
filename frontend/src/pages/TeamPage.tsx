import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Responsable } from '../types';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import Avatar from '../components/shared/Avatar';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import { Plus, Pencil, Trash2, Users, Search, Briefcase, ListTodo, FolderKanban } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function TeamPage() {
  const { user } = useAuthStore();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Responsable | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ nombre: '', email: '', rol: '', color: '#2563eb' });

  const load = () => {
    api.getResponsables().then(r => { setResponsables(r); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: '', email: '', rol: '', color: '#2563eb' });
    setShowModal(true);
  };

  const openEdit = (r: Responsable) => {
    setEditing(r);
    setForm({ nombre: r.nombre, email: r.email || '', rol: r.rol || '', color: r.color });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editing) { await api.updateResponsable(editing.id, form); toast.success('Member updated'); }
      else { await api.createResponsable(form); toast.success('Member created'); }
      setShowModal(false); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try { await api.deleteResponsable(deleteId); toast.success('Member deleted'); load(); } catch (e: any) { toast.error(e.message); }
    setDeleteId(null);
  };

  const filtered = responsables.filter(r => r.nombre.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  return (
    <div>
      <Header
        breadcrumbs={[{ label: 'Team' }]}
        actions={canEdit ? (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors">
            <Plus className="w-4 h-4" /> New Member
          </button>
        ) : undefined}
      />

      <div className="p-4 sm:p-6">
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search members..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Users} title="No members" description="No team members found" action={canEdit ? { label: 'Add member', onClick: openCreate } : undefined} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <Avatar nombre={r.nombre} color={r.color} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{r.nombre}</h3>
                    {r.rol && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">{r.rol}</span>
                      </div>
                    )}
                    {r.email && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-lg font-bold text-gray-900">{r.total_proyectos || 0}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Projects</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ListTodo className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-lg font-bold text-gray-900">{r.total_tareas || 0}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Tasks</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ListTodo className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-lg font-bold text-gray-900">{r.tareas_pendientes || 0}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">Pending</p>
                  </div>
                </div>

                {/* Workload bar */}
                {(r.total_tareas || 0) > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Workload</span>
                      <span>{Math.round(((r.total_tareas || 0) - (r.tareas_pendientes || 0)) / (r.total_tareas || 1) * 100)}% completed</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full">
                      <div
                        className="h-1.5 bg-primary-500 rounded-full transition-all"
                        style={{ width: `${Math.round(((r.total_tareas || 0) - (r.tareas_pendientes || 0)) / (r.total_tareas || 1) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {canEdit && (
                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-100">
                    <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    {user?.rol === 'admin' && <button onClick={() => setDeleteId(r.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Member' : 'New Member'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <input value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-full h-10 rounded-lg cursor-pointer" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors">{editing ? 'Save' : 'Create'}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteId !== null} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Member" message="Are you sure you want to delete this member?" />
    </div>
  );
}
