import { useState, useRef, useEffect } from 'react';
import type { Responsable } from '../../types';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  onMentionsChange: (ids: number[]) => void;
  responsables: Responsable[];
  placeholder?: string;
}

export default function MentionInput({ value, onChange, onMentionsChange, responsables, placeholder }: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const filtered = responsables.filter(r =>
    r.nombre.toLowerCase().includes(filter.toLowerCase())
  ).slice(0, 6);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);
    setCursorPos(pos);

    // Check if we're in an @mention context
    const textBeforeCursor = val.substring(0, pos);
    const atIndex = textBeforeCursor.lastIndexOf('@');

    if (atIndex !== -1 && (atIndex === 0 || textBeforeCursor[atIndex - 1] === ' ' || textBeforeCursor[atIndex - 1] === '\n')) {
      const query = textBeforeCursor.substring(atIndex + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setFilter(query);
        setShowSuggestions(true);
        return;
      }
    }
    setShowSuggestions(false);
  };

  const insertMention = (responsable: Responsable) => {
    const textBeforeCursor = value.substring(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const before = value.substring(0, atIndex);
    const after = value.substring(cursorPos);
    const newValue = `${before}@${responsable.nombre} ${after}`;
    onChange(newValue);
    setShowSuggestions(false);

    // Extract all mentions from the text
    const mentionIds: number[] = [];
    responsables.forEach(r => {
      if (newValue.includes(`@${r.nombre}`)) {
        mentionIds.push(r.id);
      }
    });
    onMentionsChange(mentionIds);

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = atIndex + responsable.nombre.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
    if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
      e.preventDefault();
      // Let parent handle submit via button
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
      />
      {showSuggestions && filtered.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full mb-1 left-0 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-10"
        >
          {filtered.map(r => (
            <button
              key={r.id}
              onClick={() => insertMention(r)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: r.color }}
              >
                {r.nombre.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{r.nombre}</p>
                {r.rol && <p className="text-xs text-gray-400">{r.rol}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
