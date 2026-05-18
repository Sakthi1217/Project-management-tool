import { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../../services/api';
import {
  Bot, X, Send, Paperclip, Loader2, Trash2, FileText,
  CheckCircle2, XCircle, ChevronDown, ChevronRight, Sparkles, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AiAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  proyectoId: number;
  proyectoNombre: string;
  onUpdate: () => void;
}

interface ExecutedAction {
  tipo: string;
  descripcion: string;
  exito: boolean;
}

interface AttachedFile {
  file: File;
  preview?: string;
  id: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentNames?: string[];
  acciones?: ExecutedAction[];
  loading?: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  update_tarea: 'Task updated',
  create_tarea: 'Task created',
  delete_tarea: 'Task deleted',
  update_sprint: 'Sprint updated',
  create_sprint: 'Sprint created',
  add_comentario: 'Comment added',
  update_proyecto: 'Project updated',
  create_hito: 'Milestone created',
  update_hito: 'Milestone updated',
};

const QUICK_ACTIONS = [
  'What is the overall project status?',
  'Analyze risks of the current plan',
  'Which tasks are overdue or due soon?',
  'How many story points does each sprint have?',
  'Generate an executive summary of the project',
];

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export default function AiAssistantPanel({ isOpen, onClose, proyectoId, proyectoNombre, onUpdate }: AiAssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `Hello! I'm your project management assistant for **${proyectoNombre}**.\n\nI can help you:\n• 📊 Analyze project status and detect risks\n• 📅 Move dates and adjust the schedule\n• 👤 Assign responsible persons to tasks\n• ✅ Update statuses and progress\n• 💬 Add comments on tasks\n• 🚀 Create sprints, milestones and new tasks\n\nHow can I help you today?`,
      }]);
    }
  }, [isOpen]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const newFiles: AttachedFile[] = [];
    for (const file of fileArray) {
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} exceeds 20MB`); continue; }
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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const pastedFiles: File[] = [];
    for (let i = 0; i < e.clipboardData.items.length; i++) {
      const item = e.clipboardData.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) { e.preventDefault(); addFiles(pastedFiles); }
  }, [addFiles]);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text && attachedFiles.length === 0) return;
    if (isThinking) return;

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `ai-${Date.now()}`;

    const userMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: text,
      attachmentNames: attachedFiles.map(f => f.file.name),
    };

    setMessages(prev => [
      ...prev,
      userMessage,
      { id: assistantMsgId, role: 'assistant', content: '', loading: true },
    ]);
    setInput('');

    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);
    setIsThinking(true);

    // Build history: all messages except welcome + the loading placeholder
    const history = messages
      .filter(m => m.id !== 'welcome' && !m.loading)
      .map(m => ({ role: m.role, content: m.content }));

    // Add current user message to history
    history.push({ role: 'user', content: text });

    try {
      const result = await api.chatWithAI({
        proyecto_id: proyectoId,
        messages: history,
        files: filesToSend.length > 0 ? filesToSend.map(f => f.file) : undefined,
      });

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: result.mensaje, acciones: result.acciones_ejecutadas, loading: false }
          : m
      ));

      // Refresh project data if any actions were executed
      if (result.acciones_ejecutadas && result.acciones_ejecutadas.some(a => a.exito)) {
        onUpdate();
      }
    } catch (e: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: `Error: ${e.message}`, loading: false }
          : m
      ));
    }

    setIsThinking(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-new',
      role: 'assistant',
      content: `Chat cleared. How can I help you with **${proyectoNombre}**?`,
    }]);
  };

  const toggleActions = (msgId: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  };

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/•/g, '•')
      .split('\n')
      .map((line, i) => `<span key="${i}">${line || '&nbsp;'}</span>`)
      .join('<br/>');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-[520px] max-w-full flex flex-col bg-white dark:bg-gray-900 shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex-shrink-0">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">AI Assistant</p>
            <p className="text-xs text-purple-200 truncate">{proyectoNombre}</p>
          </div>
          <button
            onClick={clearChat}
            title="Clear chat"
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick actions — shown only when there's just the welcome message */}
        {messages.length <= 1 && (
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 uppercase font-semibold tracking-wide">Quick Actions</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(qa)}
                  className="text-[11px] px-2 py-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                >
                  {qa}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar */}
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Message bubble */}
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white rounded-tr-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
                }`}>
                  {msg.loading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Analyzing project...</span>
                    </div>
                  ) : (
                    <div
                      className="whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                    />
                  )}
                </div>

                {/* Attached files (user) */}
                {msg.attachmentNames && msg.attachmentNames.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {msg.attachmentNames.map((name, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                        <FileText className="w-2.5 h-2.5" /> {name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Executed actions (assistant) */}
                {msg.acciones && msg.acciones.length > 0 && (
                  <div className="w-full">
                    <button
                      onClick={() => toggleActions(msg.id)}
                      className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                    >
                      {expandedActions.has(msg.id)
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronRight className="w-3 h-3" />}
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      {msg.acciones.length} action{msg.acciones.length > 1 ? 's' : ''} executed
                    </button>
                    {expandedActions.has(msg.id) && (
                      <div className="mt-1.5 space-y-1">
                        {msg.acciones.map((a, i) => (
                          <div key={i} className={`flex items-start gap-2 text-[11px] px-2.5 py-1.5 rounded-lg ${
                            a.exito
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                          }`}>
                            {a.exito
                              ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                              : <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
                            <div>
                              <span className="font-semibold">{ACTION_LABELS[a.tipo] || a.tipo}:</span>{' '}
                              {a.descripcion}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-shrink-0 bg-white dark:bg-gray-900">
          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {attachedFiles.map(af => (
                <div key={af.id} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
                  {af.preview
                    ? <img src={af.preview} alt="" className="w-6 h-6 object-cover rounded" />
                    : <FileText className="w-3.5 h-3.5 text-gray-400" />}
                  <span className="text-gray-600 dark:text-gray-400 max-w-[100px] truncate">{af.file.name}</span>
                  <button onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== af.id))} className="text-gray-400 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask something or request an action... (Enter to send, Shift+Enter for new line)"
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-purple-500 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <button
                onClick={() => sendMessage()}
                disabled={isThinking || (!input.trim() && attachedFiles.length === 0)}
                className="p-2 bg-gradient-to-br from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all"
              >
                {isThinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1 ml-1">
            Ctrl+V to paste images • You can ask for analysis, modify tasks, move dates and more
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.csv,.json,.md,.xml,.yaml,.yml"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          className="hidden"
        />
      </div>
    </div>
  );
}
