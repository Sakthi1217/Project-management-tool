import { useState, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import { formatDate, getPrioridadLabel } from '../../utils/format';
import Modal from '../shared/Modal';
import { Bot, Loader2, CheckCircle, ChevronDown, ChevronRight, Sparkles, Upload, X, FileText, Image as ImageIcon, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

interface AiPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  proyectoId: number;
  proyectoNombre: string;
  proyectoDescripcion: string | null;
  onPlanApplied: () => void;
}

interface GeneratedTask {
  nombre: string;
  descripcion: string;
  prioridad: string;
  duracion_dias: number;
  subtareas?: Array<{
    nombre: string;
    descripcion: string;
    prioridad: string;
    duracion_dias: number;
  }>;
  selected: boolean;
}

interface GeneratedSprint {
  nombre: string;
  objetivo: string;
  duracion_dias: number;
  tareas_incluidas: string[];
}

interface AttachedFile {
  file: File;
  preview?: string; // data URL for images
  id: string;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];

export default function AiPlannerModal({ isOpen, onClose, proyectoId, proyectoNombre, proyectoDescripcion, onPlanApplied }: AiPlannerModalProps) {
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [plan, setPlan] = useState<{
    plan_nombre: string;
    descripcion: string;
    tareas: GeneratedTask[];
    sprints_sugeridos: GeneratedSprint[];
  } | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [createSprint, setCreateSprint] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: AttachedFile[] = [];
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 20MB`);
        continue;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const attached: AttachedFile = { file, id };

      if (IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachedFiles(prev => prev.map(f => f.id === id ? { ...f, preview: e.target?.result as string } : f));
        };
        reader.readAsDataURL(file);
      }
      newFiles.push(attached);
    }

    setAttachedFiles(prev => [...prev, ...newFiles].slice(0, 5));
  }, []);

  const removeFile = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Handle paste (Ctrl+V / Cmd+V)
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pastedFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }

    if (pastedFiles.length > 0) {
      e.preventDefault();
      addFiles(pastedFiles);
    }
  }, [addFiles]);

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() && attachedFiles.length === 0) return;
    setGenerating(true);
    setError('');
    setPlan(null);

    try {
      const result = await api.generatePlan({
        prompt: prompt.trim() || 'Analyze the attached files and create a work plan based on their content.',
        proyecto_id: proyectoId,
        contexto_proyecto: `Proyecto: ${proyectoNombre}. ${proyectoDescripcion || ''}`,
        files: attachedFiles.length > 0 ? attachedFiles.map(f => f.file) : undefined,
      });

      if (result.plan) {
        result.plan.tareas = (result.plan.tareas || []).map((t: any) => ({ ...t, selected: true }));
        setPlan(result.plan);
        setExpandedTasks(new Set(result.plan.tareas.map((_: any, i: number) => i)));
      } else {
        setError(result.error || 'Could not generate a valid plan. Try with a more specific prompt.');
      }
    } catch (e: any) {
      setError(e.message);
    }
    setGenerating(false);
  };

  const toggleTaskSelection = (index: number) => {
    if (!plan) return;
    const updated = { ...plan };
    updated.tareas = [...updated.tareas];
    updated.tareas[index] = { ...updated.tareas[index], selected: !updated.tareas[index].selected };
    setPlan(updated);
  };

  const toggleExpand = (index: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const handleApply = async () => {
    if (!plan) return;
    setApplying(true);

    const selectedTasks = plan.tareas.filter(t => t.selected).map(t => ({
      nombre: t.nombre, descripcion: t.descripcion, prioridad: t.prioridad,
      duracion_dias: t.duracion_dias, subtareas: t.subtareas,
    }));

    if (selectedTasks.length === 0) {
      toast.error('Select at least one task');
      setApplying(false);
      return;
    }

    const sprintData = createSprint && plan.sprints_sugeridos?.[0] ? plan.sprints_sugeridos[0] : undefined;

    try {
      const result = await api.applyPlan({ proyecto_id: proyectoId, tareas: selectedTasks, sprint: sprintData });
      toast.success(result.message);
      onPlanApplied();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    }
    setApplying(false);
  };

  const PRIORITY_COLORS: Record<string, string> = {
    baja: 'bg-gray-200 text-gray-700',
    media: 'bg-yellow-100 text-yellow-800',
    alta: 'bg-orange-100 text-orange-800',
    critica: 'bg-red-100 text-red-800',
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="lg">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">AI Assistant</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Generate a work plan for &quot;{proyectoNombre}&quot;</p>
          </div>
        </div>

        {/* Input section */}
        {!plan && (
          <>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-lg transition-all ${dragOver ? 'ring-2 ring-purple-400 bg-purple-50 dark:bg-purple-900/20' : ''}`}
            >
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Describe the work plan you need
              </label>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onPaste={handlePaste}
                placeholder="E.g.: I need a plan to migrate our database from MySQL to PostgreSQL...&#10;&#10;You can paste images (Ctrl+V) or drag files here."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none bg-white dark:bg-gray-700 dark:text-white resize-none"
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleGenerate(); }}
              />

              {/* Drag overlay */}
              {dragOver && (
                <div className="absolute inset-0 flex items-center justify-center bg-purple-50/90 dark:bg-purple-900/80 rounded-lg border-2 border-dashed border-purple-400 pointer-events-none">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-purple-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Drop here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Attached files */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map(af => (
                  <div key={af.id} className="relative group flex items-center gap-2 px-2 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    {af.preview ? (
                      <img src={af.preview} alt={af.file.name} className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{af.file.name}</p>
                      <p className="text-[10px] text-gray-400">{formatFileSize(af.file.size)}</p>
                    </div>
                    <button
                      onClick={() => removeFile(af.id)}
                      className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-gray-400 hover:text-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* File actions + tips */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5" /> Attach file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.txt,.csv,.json,.md,.xml,.yaml,.yml,.html,.log"
                  onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
                  className="hidden"
                />
                <span className="text-[10px] text-gray-400">
                  Images, TXT, CSV, JSON, MD, XML (max 20MB, 5 files)
                </span>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={generating || (!prompt.trim() && attachedFiles.length === 0)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all"
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating plan...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Plan {attachedFiles.length > 0 ? `(${attachedFiles.length} file${attachedFiles.length > 1 ? 's' : ''})` : ''}</>
                )}
              </button>
            </div>
          </>
        )}

        {/* Plan Preview */}
        {plan && (
          <>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
              <h4 className="font-semibold text-purple-900 dark:text-purple-300 text-sm">{plan.plan_nombre}</h4>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{plan.descripcion}</p>
            </div>

            {plan.sprints_sugeridos && plan.sprints_sugeridos.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <input type="checkbox" checked={createSprint} onChange={e => setCreateSprint(e.target.checked)} className="rounded border-gray-300 accent-purple-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Create Sprint: {plan.sprints_sugeridos[0].nombre}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-400">{plan.sprints_sugeridos[0].objetivo} ({plan.sprints_sugeridos[0].duracion_dias} days)</p>
                </div>
              </div>
            )}

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
              {plan.tareas.map((tarea, idx) => (
                <div key={idx} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <input type="checkbox" checked={tarea.selected} onChange={() => toggleTaskSelection(idx)} className="rounded border-gray-300 accent-purple-500 flex-shrink-0" />
                    {tarea.subtareas && tarea.subtareas.length > 0 && (
                      <button onClick={() => toggleExpand(idx)} className="p-0.5 flex-shrink-0">
                        {expandedTasks.has(idx) ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{tarea.nombre}</span>
                      {tarea.descripcion && <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{tarea.descripcion}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORITY_COLORS[tarea.prioridad] || PRIORITY_COLORS.media}`}>{getPrioridadLabel(tarea.prioridad)}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{tarea.duracion_dias}d</span>
                  </div>
                  {tarea.subtareas && tarea.subtareas.length > 0 && expandedTasks.has(idx) && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                      {tarea.subtareas.map((sub, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 px-3 py-1.5 pl-12">
                          <div className="w-0.5 h-3 bg-gray-300 dark:bg-gray-600 rounded flex-shrink-0" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 flex-1">{sub.nombre}</span>
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[sub.prioridad] || PRIORITY_COLORS.media}`}>{getPrioridadLabel(sub.prioridad)}</span>
                          <span className="text-[10px] text-gray-400">{sub.duracion_dias}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button onClick={() => { setPlan(null); setPrompt(''); setAttachedFiles([]); }} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                Regenerate
              </button>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                <button onClick={handleApply} disabled={applying} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg text-sm font-medium hover:from-green-600 hover:to-emerald-600 disabled:opacity-50">
                  {applying ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Applying...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" /> Apply Plan ({plan.tareas.filter(t => t.selected).length} tasks)</>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
