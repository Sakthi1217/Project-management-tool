import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { Tarea, Hito } from '../../types';
import { getEstadoLabel } from '../../utils/format';

interface CalendarViewProps {
  tareas: Tarea[];
  hitos: Hito[];
  onTareaClick: (tarea: Tarea) => void;
}

const ESTADO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pendiente: { bg: '#f3f4f6', border: '#9ca3af', text: '#374151' },
  en_progreso: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  completada: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  bloqueada: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
};

export default function CalendarView({ tareas, hitos, onTareaClick }: CalendarViewProps) {
  const tareaEvents = tareas
    .filter(t => t.fecha_inicio || t.fecha_fin)
    .map(t => {
      const colors = ESTADO_COLORS[t.estado] || ESTADO_COLORS.pendiente;
      return {
        id: `tarea-${t.id}`,
        title: t.nombre,
        start: t.fecha_inicio || t.fecha_fin!,
        end: t.fecha_fin ? new Date(new Date(t.fecha_fin).getTime() + 86400000).toISOString().split('T')[0] : undefined,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: colors.text,
        extendedProps: { type: 'tarea', tarea: t },
      };
    });

  const hitoEvents = hitos.map(h => ({
    id: `hito-${h.id}`,
    title: `\u{1F3AF} ${h.nombre}`,
    start: h.fecha,
    allDay: true,
    backgroundColor: h.completado ? '#dcfce7' : '#fef9c3',
    borderColor: h.completado ? '#22c55e' : '#eab308',
    textColor: h.completado ? '#166534' : '#854d0e',
    extendedProps: { type: 'hito', hito: h },
  }));

  const events = [...tareaEvents, ...hitoEvents];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        locale="es"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek',
        }}
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
        }}
        height="auto"
        eventClick={(info) => {
          const props = info.event.extendedProps;
          if (props.type === 'tarea') {
            onTareaClick(props.tarea as Tarea);
          }
        }}
        eventContent={(arg) => {
          const props = arg.event.extendedProps;
          return (
            <div className="px-1.5 py-0.5 text-xs truncate cursor-pointer" title={arg.event.title}>
              {props.type === 'tarea' && (
                <span className="font-medium">{arg.event.title}</span>
              )}
              {props.type === 'hito' && (
                <span className="font-semibold">{arg.event.title}</span>
              )}
            </div>
          );
        }}
        dayMaxEvents={3}
        moreLinkText={(n) => `+${n} mas`}
      />
    </div>
  );
}
