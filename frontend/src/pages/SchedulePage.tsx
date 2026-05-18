import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { Programa, Proyecto, Tarea, Dependencia, Hito } from '../types';
import Header from '../components/shared/Header';
import GanttView from '../components/gantt/GanttView';
import { GanttChart } from 'lucide-react';

export default function SchedulePage() {
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [selectedPrograma, setSelectedPrograma] = useState<string>('');
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [allTareas, setAllTareas] = useState<Tarea[]>([]);
  const [allDeps, setAllDeps] = useState<Dependencia[]>([]);
  const [allHitos, setAllHitos] = useState<Hito[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getProgramas().then(p => { setProgramas(p); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedPrograma) { setProyectos([]); setAllTareas([]); setAllDeps([]); setAllHitos([]); return; }
    setLoading(true);
    api.getProyectos({ programa_id: selectedPrograma }).then(async (proys) => {
      setProyectos(proys);
      const tareasPromises = proys.map((p: Proyecto) => api.getTareasByProyecto(p.id));
      const depsPromises = proys.map((p: Proyecto) => api.getDependenciasByProyecto(p.id));
      const hitosPromises = proys.map((p: Proyecto) => api.getHitosByProyecto(p.id));
      const [tareasArrays, depsArrays, hitosArrays] = await Promise.all([
        Promise.all(tareasPromises), Promise.all(depsPromises), Promise.all(hitosPromises),
      ]);
      setAllTareas(tareasArrays.flat());
      setAllDeps(depsArrays.flat());
      setAllHitos(hitosArrays.flat());
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedPrograma]);

  const reload = () => {
    if (selectedPrograma) {
      const prev = selectedPrograma;
      setSelectedPrograma('');
      setTimeout(() => setSelectedPrograma(prev), 0);
    }
  };

  return (
    <div>
      <Header breadcrumbs={[{ label: 'Global Schedule' }]} />
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <GanttChart className="w-5 h-5 text-primary-500" />
          <select
            value={selectedPrograma}
            onChange={e => setSelectedPrograma(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Select a program</option>
            {programas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          {selectedPrograma && !loading && (
            <span className="text-sm text-gray-500">{proyectos.length} projects | {allTareas.length} tasks</span>
          )}
        </div>

        {!selectedPrograma ? (
          <div className="text-center py-16 text-gray-400">
            <GanttChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a program to view its global schedule</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>
        ) : (
          <GanttView tareas={allTareas} dependencias={allDeps} hitos={allHitos} onUpdate={reload} />
        )}
      </div>
    </div>
  );
}
