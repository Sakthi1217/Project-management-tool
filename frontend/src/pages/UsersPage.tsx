import { useEffect, useState } from 'react';
import { api } from '../services/api';
import Header from '../components/shared/Header';
import Modal from '../components/shared/Modal';
import Badge from '../components/shared/Badge';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import EmptyState from '../components/shared/EmptyState';
import { Plus, Pencil, Trash2, ShieldCheck, Search, Eye, EyeOff, UserCog } from 'lucide-react';
import { formatDate } from '../utils/format';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

const rolConfig: Record<string, { label: string; color: string; icon: string }> = {
  admin: { label: 'Administrator', color: 'bg-red-100 text-red-700', icon: '🔑' },
  editor: { label: 'Editor', color: 'bg-blue-100 text-blue-700', icon: '✏️' },
  viewer: { label: 'Viewer', color: 'bg-gray-100 text-gray-700', icon: '👁️' },
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'viewer' });

  const load = () => {
    api.getUsuarios()
      .then(u => { setUsuarios(u); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ nombre: '', email: '', password: '', rol: 'viewer' });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setEditing(u);
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nombre || !form.email) {
      toast.error('Name and email are required');
      return;
    }
    if (!editing && !form.password) {
      toast.error('Password is required for new users');
      return;
    }

    try {
      const data: any = { nombre: form.nombre, email: form.email, rol: form.rol };
      if (form.password) data.password = form.password;

      if (editing) {
        await api.updateUsuario(editing.id, data);
        toast.success('User updated');
      } else {
        await api.createUsuario(data);
        toast.success('User created');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.deleteUsuario(deleteId);
      toast.success('User deleted');
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
    setDeleteId(null);
  };

  const filtered = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const countByRol = (rol: string) => usuarios.filter(u => u.rol === rol).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <Header
        breadcrumbs={[{ label: 'Users' }]}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-4 h-4" /> New User
          </button>
        }
      />

      <div className="p-4 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{usuarios.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Administrators</p>
                <p className="text-2xl font-bold text-red-600">{countByRol('admin')}</p>
              </div>
              <span className="text-2xl">🔑</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Editors</p>
                <p className="text-2xl font-bold text-blue-600">{countByRol('editor')}</p>
              </div>
              <span className="text-2xl">✏️</span>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Viewers</p>
                <p className="text-2xl font-bold text-gray-600">{countByRol('viewer')}</p>
              </div>
              <span className="text-2xl">👁️</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No users"
            description="No users to display"
            action={{ label: 'Create user', onClick: openCreate }}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                          style={{
                            backgroundColor: u.rol === 'admin' ? '#dc2626' : u.rol === 'editor' ? '#2563eb' : '#6b7280',
                          }}
                        >
                          {u.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.nombre}</p>
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] text-primary-500 font-medium">(You)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-5 py-3">
                      <Badge className={rolConfig[u.rol].color}>
                        {rolConfig[u.rol].label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button
                            onClick={() => setDeleteId(u.id)}
                            className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit User' : 'New User'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              value={form.nombre}
              onChange={e => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="user@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password {editing ? '(leave empty to keep unchanged)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder={editing ? '••••••••' : 'Minimum 6 characters'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
            <div className="grid grid-cols-3 gap-3">
              {(['admin', 'editor', 'viewer'] as const).map(rol => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setForm({ ...form, rol })}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                    form.rol === rol
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{rolConfig[rol].icon}</span>
                  <span className="text-sm font-medium text-gray-900">{rolConfig[rol].label}</span>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">
                    {rol === 'admin' && 'Full access'}
                    {rol === 'editor' && 'Create & edit'}
                    {rol === 'viewer' && 'Read only'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {editing && editing.id === currentUser?.id && form.rol !== 'admin' && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              You cannot remove the administrator role from yourself.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
            >
              {editing ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete User"
        message="Are you sure? The user will permanently lose access to the system."
      />
    </div>
  );
}
