import { useState, useEffect, useRef } from 'react';
import { X, Send, Paperclip, FileText, Image, Download, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import type { Comentario, ArchivoAdjunto, Responsable, Tarea } from '../../types';
import { useAuthStore } from '../../store/authStore';
import MentionInput from './MentionInput';
import toast from 'react-hot-toast';

interface UpdatesWallProps {
  tarea: Tarea;
  responsables: Responsable[];
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdatesWall({ tarea, responsables, isOpen, onClose }: UpdatesWallProps) {
  const { user } = useAuthStore();
  const canEdit = user?.rol === 'admin' || user?.rol === 'editor';
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [contenido, setContenido] = useState('');
  const [menciones, setMenciones] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadComentarios = async () => {
    try {
      const data = await api.getComentariosByTarea(tarea.id);
      setComentarios(data);
    } catch (e: any) {
      toast.error('Error loading comments');
    }
  };

  useEffect(() => {
    if (isOpen) loadComentarios();
  }, [isOpen, tarea.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comentarios]);

  const handleSubmit = async () => {
    if (!contenido.trim()) return;
    setLoading(true);
    try {
      await api.createComentario({
        tarea_id: tarea.id,
        contenido: contenido.trim(),
        menciones: menciones.length > 0 ? menciones : undefined,
      });
      setContenido('');
      setMenciones([]);
      await loadComentarios();
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  };

  const handleEdit = async (id: number) => {
    if (!editContent.trim()) return;
    try {
      await api.updateComentario(id, editContent.trim());
      setEditingId(null);
      setEditContent('');
      await loadComentarios();
      toast.success('Comment updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteComentario(id);
      await loadComentarios();
      toast.success('Comment deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadArchivo(tarea.id, file);
      await loadComentarios();
      toast.success('File uploaded');
    } catch (err: any) {
      toast.error(err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteArchivo = async (archivoId: number) => {
    try {
      await api.deleteArchivo(archivoId);
      await loadComentarios();
      toast.success('File deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-blue-500" />;
    return <FileText className="w-4 h-4 text-gray-500" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Updates Wall</h3>
            <p className="text-sm text-gray-500 truncate">{tarea.nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Comments List */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
          {comentarios.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-sm">No comments yet.</p>
              <p className="text-xs mt-1">Be the first to comment.</p>
            </div>
          ) : (
            comentarios.slice().reverse().map(c => (
              <div key={c.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white text-xs font-bold">
                      {c.usuario_nombre?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.usuario_nombre}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
                    </div>
                  </div>
                  {canEdit && (c.usuario_id === user?.id || user?.rol === 'admin') && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(c.id); setEditContent(c.contenido); }}
                        className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editingId === c.id ? (
                  <div className="mt-2">
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                      rows={3}
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => handleEdit(c.id)} className="px-3 py-1 bg-primary-500 text-white rounded text-xs font-medium hover:bg-primary-600">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.contenido}</p>
                )}

                {/* Mentions */}
                {c.menciones && c.menciones.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.menciones.map(m => (
                      <span key={m.responsable_id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        @{m.responsable_nombre}
                      </span>
                    ))}
                  </div>
                )}

                {/* Files */}
                {c.archivos && c.archivos.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {c.archivos.map(a => (
                      <div key={a.id} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                        {getFileIcon(a.mime_type)}
                        <span className="text-xs text-gray-700 truncate flex-1">{a.nombre_original}</span>
                        <span className="text-xs text-gray-400">{formatSize(a.tamano)}</span>
                        <a
                          href={`/uploads/${a.nombre_archivo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {canEdit && (
                          <button onClick={() => handleDeleteArchivo(a.id)} className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        {canEdit && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <MentionInput
              value={contenido}
              onChange={setContenido}
              onMentionsChange={setMenciones}
              responsables={responsables}
              placeholder="Write a comment... use @ to mention"
            />
            <div className="flex items-center justify-between mt-3">
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" /> Attach
                </button>
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading || !contenido.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
