import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import type { Tarea, Sprint, Responsable } from '../../types';
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, MessageCircle, GripVertical } from 'lucide-react';
import Avatar from '../shared/Avatar';
import { formatDate } from '../../utils/format';
import { calcularProgresoEfectivo } from '../../utils/progreso';

const GROUP_COLORS = ['#579bfc', '#a25ddc', '#fdab3d', '#e44258', '#00c875', '#0086c0', '#bb3354', '#ff158a'];

const STATUS_CONFIG: Record<string, { bg: string; label: string }> = {
  pendiente: { bg: 'bg-gray-400', label: 'Pending' },
  en_progreso: { bg: 'bg-blue-500', label: 'In Progress' },
  completada: { bg: 'bg-green-500', label: 'Completed' },
  bloqueada: { bg: 'bg-red-500', label: 'Blocked' },
};

const PRIORITY_CONFIG: Record<string, { bg: string; label: string }> = {
  baja: { bg: 'bg-gray-300 !text-gray-700', label: 'Low' },
  media: { bg: 'bg-yellow-400', label: 'Medium' },
  alta: { bg: 'bg-orange-500', label: 'High' },
  critica: { bg: 'bg-red-600', label: 'Critical' },
};

const SPRINT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planificacion: { label: 'Planning', color: 'text-gray-500' },
  activo: { label: 'Active', color: 'text-blue-600' },
  completado: { label: 'Completed', color: 'text-green-600' },
  cancelado: { label: 'Cancelled', color: 'text-red-500' },
};

interface MondayTableViewProps {
  tareas: Tarea[];
  sprints: Sprint[];
  responsables: Responsable[];
  onEditTarea: (tarea: Tarea) => void;
  onCreateTarea: (parentId?: number, sprintId?: number) => void;
  onDeleteTarea: (id: number) => void;
  onOpenUpdates: (tarea: Tarea) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: number) => void;
  onReorder?: (items: { id: number; orden: number }[]) => void;
  canEdit: boolean;
  isAdmin: boolean;
}

export default function MondayTableView({
  tareas,
  sprints,
  responsables,
  onEditTarea,
  onCreateTarea,
  onDeleteTarea,
  onOpenUpdates,
  onEditSprint,
  onDeleteSprint,
  onReorder,
  canEdit,
  isAdmin,
}: MondayTableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(() => {
    const withChildren = new Set<number>();
    tareas.forEach(t => {
      if (t.tarea_padre_id) withChildren.add(t.tarea_padre_id);
    });
    return withChildren;
  });

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleTask = (id: number) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const rootTareas = tareas.filter(t => !t.tarea_padre_id);
  const getChildren = (parentId: number) =>
    tareas.filter(t => t.tarea_padre_id === parentId).sort((a, b) => a.orden - b.orden);

  // Group tasks by sprint
  const sprintGroups: { key: string; sprint: Sprint | null; tasks: Tarea[]; color: string }[] = [];

  sprints.forEach((sprint, idx) => {
    const tasks = rootTareas
      .filter(t => t.sprint_id === sprint.id)
      .sort((a, b) => a.orden - b.orden);
    sprintGroups.push({ key: `sprint-${sprint.id}`, sprint, tasks, color: GROUP_COLORS[idx % GROUP_COLORS.length] });
  });

  const unassigned = rootTareas.filter(t => !t.sprint_id).sort((a, b) => a.orden - b.orden);
  if (unassigned.length > 0 || sprints.length === 0) {
    sprintGroups.push({ key: 'no-sprint', sprint: null, tasks: unassigned, color: '#797e93' });
  }

  const handleGroupDragEnd = (result: DropResult, groupTasks: Tarea[]) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(groupTasks);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onReorder?.(reordered.map((t, idx) => ({ id: t.id, orden: idx })));
  };

  const handleSubtaskDragEnd = (result: DropResult, children: Tarea[]) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(children);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    onReorder?.(reordered.map((t, idx) => ({ id: t.id, orden: idx })));
  };

  const StatusCell = ({ estado }: { estado: string }) => {
    const config = STATUS_CONFIG[estado] || STATUS_CONFIG.pendiente;
    return <div className={`monday-status-cell ${config.bg}`}>{config.label}</div>;
  };

  const PriorityCell = ({ prioridad }: { prioridad?: string }) => {
    if (!prioridad) return <div className="monday-status-cell bg-gray-200 !text-gray-400">--</div>;
    const config = PRIORITY_CONFIG[prioridad] || PRIORITY_CONFIG.media;
    return <div className={`monday-status-cell ${config.bg}`}>{config.label}</div>;
  };

  const OwnerCell = ({ tarea }: { tarea: Tarea }) => {
    if (!tarea.responsable_nombre) {
      return <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"><span className="text-gray-400 text-xs">?</span></div>;
    }
    return <Avatar nombre={tarea.responsable_nombre} color={tarea.responsable_color} size="sm" />;
  };

  const renderTaskRow = (tarea: Tarea, groupColor: string, index: number) => {
    const children = getChildren(tarea.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedTasks.has(tarea.id);

    return (
      <Draggable key={tarea.id} draggableId={`task-${tarea.id}`} index={index} isDragDisabled={!canEdit || !onReorder}>
        {(provided, snapshot) => (
          <div ref={provided.innerRef} {...provided.draggableProps}>
            {/* Main task row */}
            <div className={`monday-task-row group flex items-center border-b border-gray-100 transition-colors ${snapshot.isDragging ? 'shadow-lg bg-blue-50 opacity-90' : 'hover:bg-blue-50/40'}`}>
              {/* Drag handle */}
              <div
                {...provided.dragHandleProps}
                className={`w-6 flex items-center justify-center flex-shrink-0 ${canEdit && onReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
              >
                {canEdit && onReorder && (
                  <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>

              {/* Left color accent */}
              <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: groupColor }} />

              {/* Expand toggle */}
              <div className="w-8 flex items-center justify-center flex-shrink-0">
                {hasChildren ? (
                  <button onClick={() => toggleTask(tarea.id)} className="p-0.5 hover:bg-gray-200 rounded">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                  </button>
                ) : null}
              </div>

              {/* Task name */}
              <div className="flex-1 min-w-0 px-3 py-2.5 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">{tarea.nombre}</span>
                {hasChildren && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
                    {children.length}
                  </span>
                )}
              </div>

              <div className="w-16 flex items-center justify-center flex-shrink-0 py-1.5"><OwnerCell tarea={tarea} /></div>
              <div className="w-32 flex-shrink-0 px-1 py-1.5"><StatusCell estado={tarea.estado} /></div>
              <div className="w-28 flex-shrink-0 px-1 py-1.5"><PriorityCell prioridad={(tarea as any).prioridad} /></div>
              <div className="w-40 flex-shrink-0 px-2 py-1.5">
                <span className="text-xs text-gray-500">
                  {tarea.fecha_inicio || tarea.fecha_fin ? `${formatDate(tarea.fecha_inicio)} - ${formatDate(tarea.fecha_fin)}` : '--'}
                </span>
              </div>
              <div className="w-20 flex-shrink-0 px-1 py-1.5">
                {tarea.story_points != null ? (
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{tarea.story_points}</span>
                ) : <span className="text-xs text-gray-300">-</span>}
              </div>
              <div className="w-24 flex-shrink-0 px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    {(() => { const pct = calcularProgresoEfectivo(tarea.id, tareas); return (
                      <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b' }} />
                    ); })()}
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{calcularProgresoEfectivo(tarea.id, tareas)}%</span>
                </div>
              </div>
              <div className="w-28 flex-shrink-0 px-2 py-1.5">
                <span className="text-xs text-gray-400 truncate block">{tarea.sprint_nombre || '--'}</span>
              </div>
              <div className="w-28 flex items-center justify-end gap-0.5 pr-2 flex-shrink-0">
                <button onClick={() => onOpenUpdates(tarea)} className="p-1 hover:bg-blue-100 rounded" title="Updates">
                  <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                </button>
                {canEdit && (
                  <>
                    <button onClick={() => onCreateTarea(tarea.id, tarea.sprint_id ?? undefined)} className="p-1.5 hover:bg-green-100 rounded" title="Add subtask">
                      <Plus className="w-4 h-4 text-green-600" />
                    </button>
                    <button onClick={() => onEditTarea(tarea)} className="p-1 hover:bg-gray-200 rounded" title="Edit">
                      <Pencil className="w-3.5 h-3.5 text-gray-400" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => onDeleteTarea(tarea.id)} className="p-1 hover:bg-red-100 rounded" title="Delete">
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Subtasks section */}
            {hasChildren && isExpanded && (
              <DragDropContext onDragEnd={(result) => handleSubtaskDragEnd(result, children)}>
                <div className="monday-subtask-section bg-slate-50/80">
                  {/* Subitem column headers */}
                  <div className="flex items-center border-b border-gray-100">
                    <div className="w-6 flex-shrink-0" />
                    <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: groupColor, opacity: 0.4 }} />
                    <div className="w-8 flex-shrink-0" />
                    <div className="w-8 flex-shrink-0" />
                    <div className="flex-1 min-w-0 px-3 py-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Subtask</span>
                    </div>
                    <div className="w-16 flex-shrink-0 text-center"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Resp.</span></div>
                    <div className="w-32 flex-shrink-0 px-1"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span></div>
                    <div className="w-28 flex-shrink-0 px-1"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Priority</span></div>
                    <div className="w-40 flex-shrink-0 px-2"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dates</span></div>
                    <div className="w-20 flex-shrink-0 px-1"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">SP</span></div>
                    <div className="w-24 flex-shrink-0 px-2"><span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Progress</span></div>
                    <div className="w-28 flex-shrink-0" />
                    <div className="w-28 flex-shrink-0" />
                  </div>

                  <Droppable droppableId={`subtasks-${tarea.id}`}>
                    {(subProvided) => (
                      <div ref={subProvided.innerRef} {...subProvided.droppableProps}>
                        {children.map((child, childIdx) => (
                          <Draggable key={child.id} draggableId={`subtask-${child.id}`} index={childIdx} isDragDisabled={!canEdit || !onReorder}>
                            {(childProvided, childSnapshot) => (
                              <div ref={childProvided.innerRef} {...childProvided.draggableProps}>
                                <div className={`monday-task-row group flex items-center border-b border-gray-100/60 transition-colors ${childSnapshot.isDragging ? 'shadow-md bg-indigo-50 opacity-90' : 'hover:bg-indigo-50/40'}`}>
                                  {/* Drag handle */}
                                  <div
                                    {...childProvided.dragHandleProps}
                                    className={`w-6 flex items-center justify-center flex-shrink-0 ${canEdit && onReorder ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
                                  >
                                    {canEdit && onReorder && (
                                      <GripVertical className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                  </div>
                                  <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: groupColor, opacity: 0.4 }} />
                                  <div className="w-8 flex-shrink-0" />
                                  <div className="w-8 flex items-center justify-center flex-shrink-0">
                                    <div className="w-0.5 h-4 rounded bg-gray-300" />
                                  </div>
                                  <div className="flex-1 min-w-0 px-3 py-2 flex items-center gap-2">
                                    <span className="text-sm text-gray-700 truncate">{child.nombre}</span>
                                  </div>
                                  <div className="w-16 flex items-center justify-center flex-shrink-0 py-1"><OwnerCell tarea={child} /></div>
                                  <div className="w-32 flex-shrink-0 px-1 py-1"><StatusCell estado={child.estado} /></div>
                                  <div className="w-28 flex-shrink-0 px-1 py-1"><PriorityCell prioridad={(child as any).prioridad} /></div>
                                  <div className="w-40 flex-shrink-0 px-2 py-1">
                                    <span className="text-xs text-gray-500">
                                      {child.fecha_inicio || child.fecha_fin ? `${formatDate(child.fecha_inicio)} - ${formatDate(child.fecha_fin)}` : '--'}
                                    </span>
                                  </div>
                                  <div className="w-20 flex-shrink-0 px-1 py-1">
                                    {child.story_points != null ? (
                                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">{child.story_points}</span>
                                    ) : <span className="text-xs text-gray-300">-</span>}
                                  </div>
                                  <div className="w-24 flex-shrink-0 px-2 py-1">
                                    <div className="flex items-center gap-1">
                                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                        {(() => { const pct = calcularProgresoEfectivo(child.id, tareas); return (
                                          <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b' }} />
                                        ); })()}
                                      </div>
                                      <span className="text-[10px] text-gray-400 flex-shrink-0">{calcularProgresoEfectivo(child.id, tareas)}%</span>
                                    </div>
                                  </div>
                                  <div className="w-28 flex-shrink-0" />
                                  <div className="w-28 flex items-center justify-end gap-0.5 pr-2 flex-shrink-0">
                                    <button onClick={() => onOpenUpdates(child)} className="p-1 hover:bg-blue-100 rounded" title="Updates">
                                      <MessageCircle className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                    {canEdit && (
                                      <>
                                        <button onClick={() => onEditTarea(child)} className="p-1 hover:bg-gray-200 rounded" title="Edit">
                                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                        {isAdmin && (
                                          <button onClick={() => onDeleteTarea(child.id)} className="p-1 hover:bg-red-100 rounded" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {subProvided.placeholder}
                      </div>
                    )}
                  </Droppable>

                  {canEdit && (
                    <div className="flex items-center border-b border-gray-100/60">
                      <div className="w-6 flex-shrink-0" />
                      <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: groupColor, opacity: 0.4 }} />
                      <div className="w-8 flex-shrink-0" />
                      <div className="w-8 flex-shrink-0" />
                      <button onClick={() => onCreateTarea(tarea.id, tarea.sprint_id ?? undefined)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Add subtask
                      </button>
                    </div>
                  )}
                </div>
              </DragDropContext>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  const renderGroup = (group: typeof sprintGroups[number]) => {
    const isCollapsed = collapsedGroups.has(group.key);
    const sprint = group.sprint;
    const taskCount = group.tasks.length;
    const completedCount = group.tasks.filter(t => t.estado === 'completada').length;
    const sprintStatus = sprint ? SPRINT_STATUS_LABELS[sprint.estado] : null;

    return (
      <div key={group.key} className="mb-4">
        {/* Group Header */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-t-lg cursor-pointer select-none"
          style={{ backgroundColor: `${group.color}12`, borderLeft: `4px solid ${group.color}` }}
          onClick={() => toggleGroup(group.key)}
        >
          <button className="p-0.5">
            {isCollapsed ? <ChevronRight className="w-4 h-4" style={{ color: group.color }} /> : <ChevronDown className="w-4 h-4" style={{ color: group.color }} />}
          </button>
          <span className="text-sm font-bold" style={{ color: group.color }}>{sprint ? sprint.nombre : 'No Sprint'}</span>
          <span className="text-xs text-gray-400 font-medium">{taskCount} {taskCount === 1 ? 'task' : 'tasks'}</span>
          {sprint && sprint.fecha_inicio && sprint.fecha_fin && (
            <span className="text-xs text-gray-400">{formatDate(sprint.fecha_inicio)} - {formatDate(sprint.fecha_fin)}</span>
          )}
          {sprintStatus && <span className={`text-xs font-semibold ${sprintStatus.color} ml-1`}>{sprintStatus.label}</span>}
          {taskCount > 0 && (
            <span className="text-xs text-gray-400 ml-auto mr-2">
              {completedCount}/{taskCount} completed · {group.tasks.reduce((sum, t) => sum + (t.story_points || 0), 0)} SP
            </span>
          )}
          {sprint && canEdit && (
            <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
              <button onClick={() => onEditSprint(sprint)} className="p-1 hover:bg-white/60 rounded" title="Edit Sprint">
                <Pencil className="w-3.5 h-3.5" style={{ color: group.color }} />
              </button>
              {isAdmin && (
                <button onClick={() => onDeleteSprint(sprint.id)} className="p-1 hover:bg-red-100/60 rounded" title="Delete Sprint">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>
          )}
        </div>

        {!isCollapsed && (
          <div className="bg-white border border-gray-200 border-t-0 rounded-b-lg overflow-hidden">
            {/* Column headers */}
            <div className="flex items-center bg-gray-50 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <div className="w-6 flex-shrink-0" />
              <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: group.color }} />
              <div className="w-8 flex-shrink-0" />
              <div className="flex-1 min-w-0 px-3 py-2">Task</div>
              <div className="w-16 flex-shrink-0 text-center">Resp.</div>
              <div className="w-32 flex-shrink-0 px-1">Status</div>
              <div className="w-28 flex-shrink-0 px-1">Priority</div>
              <div className="w-40 flex-shrink-0 px-2">Dates</div>
              <div className="w-20 flex-shrink-0 px-1">SP</div>
              <div className="w-24 flex-shrink-0 px-2">Progress</div>
              <div className="w-28 flex-shrink-0 px-2">Sprint</div>
              <div className="w-28 flex-shrink-0" />
            </div>

            {group.tasks.length === 0 ? (
              <div className="flex items-center">
                <div className="w-6 flex-shrink-0" />
                <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: group.color, opacity: 0.3 }} />
                <div className="flex-1 py-6 text-center text-sm text-gray-400">No tasks in this group</div>
              </div>
            ) : (
              <DragDropContext onDragEnd={(result) => handleGroupDragEnd(result, group.tasks)}>
                <Droppable droppableId={group.key}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {group.tasks.map((t, index) => renderTaskRow(t, group.color, index))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            {canEdit && (
              <div className="flex items-center border-t border-gray-100">
                <div className="w-6 flex-shrink-0" />
                <div className="w-1.5 self-stretch flex-shrink-0" style={{ backgroundColor: group.color, opacity: 0.3 }} />
                <button onClick={() => onCreateTarea(undefined, sprint?.id)} className="px-4 py-2 text-xs text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add task
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="monday-board">
      {sprintGroups.map(group => renderGroup(group))}
    </div>
  );
}
