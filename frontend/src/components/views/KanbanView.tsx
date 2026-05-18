import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { Tarea, Responsable } from '../../types';
import { api } from '../../services/api';
import Badge from '../shared/Badge';
import Avatar from '../shared/Avatar';
import { getEstadoColor, getEstadoLabel, formatDate, isOverdue, isDueSoon } from '../../utils/format';
import { Pencil, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface KanbanViewProps {
  tareas: Tarea[];
  responsables: Responsable[];
  onUpdate: () => void;
  onEditTarea: (tarea: Tarea) => void;
  onOpenUpdates: (tarea: Tarea) => void;
  readOnly?: boolean;
}

const COLUMNS: { key: Tarea['estado']; label: string; color: string; bgColor: string }[] = [
  { key: 'pendiente', label: 'Pendiente', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  { key: 'en_progreso', label: 'En Progreso', color: 'text-blue-700', bgColor: 'bg-blue-50' },
  { key: 'completada', label: 'Completada', color: 'text-green-700', bgColor: 'bg-green-50' },
  { key: 'bloqueada', label: 'Bloqueada', color: 'text-red-700', bgColor: 'bg-red-50' },
];

export default function KanbanView({ tareas, onUpdate, onEditTarea, onOpenUpdates, readOnly }: KanbanViewProps) {
  const [dragging, setDragging] = useState(false);

  const getTareasByEstado = (estado: Tarea['estado']) =>
    tareas.filter(t => t.estado === estado).sort((a, b) => a.orden - b.orden);

  const handleDragEnd = async (result: DropResult) => {
    setDragging(false);
    if (!result.destination || readOnly) return;

    const tareaId = parseInt(result.draggableId);
    const newEstado = result.destination.droppableId as Tarea['estado'];
    const tarea = tareas.find(t => t.id === tareaId);

    if (!tarea || tarea.estado === newEstado) return;

    try {
      await api.updateTarea(tareaId, { ...tarea, estado: newEstado });
      toast.success(`Tarea movida a ${getEstadoLabel(newEstado)}`);
      onUpdate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const columnTareas = getTareasByEstado(col.key);
          return (
            <div key={col.key} className="flex flex-col">
              {/* Column Header */}
              <div className={`${col.bgColor} rounded-t-xl px-4 py-3 border border-gray-200 border-b-0`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                  <span className={`text-xs font-medium ${col.color} bg-white/60 px-2 py-0.5 rounded-full`}>
                    {columnTareas.length}
                  </span>
                </div>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 min-h-[200px] p-2 space-y-2 border border-gray-200 rounded-b-xl transition-colors ${
                      snapshot.isDraggingOver ? 'bg-primary-50 border-primary-300' : 'bg-gray-50'
                    }`}
                  >
                    {columnTareas.map((tarea, index) => {
                      const overdue = isOverdue(tarea.fecha_fin) && tarea.estado !== 'completada';
                      const dueSoon = isDueSoon(tarea.fecha_fin) && tarea.estado !== 'completada';

                      return (
                        <Draggable
                          key={tarea.id}
                          draggableId={tarea.id.toString()}
                          index={index}
                          isDragDisabled={readOnly}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-white rounded-lg border p-3 shadow-sm transition-shadow ${
                                snapshot.isDragging ? 'shadow-lg border-primary-300' : 'border-gray-200 hover:shadow-md'
                              } ${overdue ? 'border-l-4 border-l-red-400' : dueSoon ? 'border-l-4 border-l-yellow-400' : ''}`}
                            >
                              <p className="text-sm font-medium text-gray-900 mb-2">{tarea.nombre}</p>

                              {tarea.fecha_fin && (
                                <p className={`text-xs mb-2 ${overdue ? 'text-red-600 font-semibold' : dueSoon ? 'text-yellow-600' : 'text-gray-400'}`}>
                                  {formatDate(tarea.fecha_inicio)} - {formatDate(tarea.fecha_fin)}
                                </p>
                              )}

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {tarea.responsable_nombre && (
                                    <Avatar nombre={tarea.responsable_nombre} color={tarea.responsable_color} size="sm" />
                                  )}
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); onOpenUpdates(tarea); }}
                                    className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-primary-500"
                                    title="Updates"
                                  >
                                    <MessageCircle className="w-3.5 h-3.5" />
                                  </button>
                                  {!readOnly && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onEditTarea(tarea); }}
                                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
