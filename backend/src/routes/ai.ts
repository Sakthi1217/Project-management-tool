import { Router, Response } from 'express';
import { getOne, run, getAll } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';
import multer from 'multer';
import { readFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const uploadDir = join(process.cwd(), 'uploads', 'ai-temp');
if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // 20MB

const router = Router();
router.use(authMiddleware);

// ── Helpers for masking keys ──────────────────────────────────────────────────
function maskKey(key: string): string {
  return key.length > 8 ? key.substring(0, 4) + '****' + key.substring(key.length - 4) : '****';
}

function sanitizeConfig(config: any) {
  if (config.azure_api_key) { config.azure_api_key_masked = maskKey(config.azure_api_key); }
  else { config.azure_api_key_masked = ''; }
  delete config.azure_api_key;

  if (config.groq_api_key) { config.groq_api_key_masked = maskKey(config.groq_api_key); }
  else { config.groq_api_key_masked = ''; }
  delete config.groq_api_key;

  if (config.gemini_api_key) { config.gemini_api_key_masked = maskKey(config.gemini_api_key); }
  else { config.gemini_api_key_masked = ''; }
  delete config.gemini_api_key;
  return config;
}

// ── Build fetch params for a given provider ───────────────────────────────────
function buildProviderRequest(
  config: any,
  messages: any[],
  maxTokens: number,
  temperature: number
): { url: string; headers: Record<string, string>; body: Record<string, any> } {
  if (config.provider === 'groq') {
    return {
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.groq_api_key as string}`,
      },
      body: { model: (config.groq_model as string) || 'llama-3.3-70b-versatile', messages, max_tokens: maxTokens, temperature },
    };
  }
  if (config.provider === 'gemini') {
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.gemini_api_key as string}`,
      },
      body: { model: (config.gemini_model as string) || 'gemini-2.5-flash', messages, max_tokens: maxTokens, temperature },
    };
  }
  // Default: azure_openai
  return {
    url: `${config.azure_endpoint}/openai/deployments/${config.azure_deployment}/chat/completions?api-version=${config.azure_api_version}`,
    headers: {
      'Content-Type': 'application/json',
      'api-key': config.azure_api_key as string,
    },
    body: { messages, max_tokens: maxTokens, temperature },
  };
}

// Get AI config (admin only — hide api keys)
router.get('/config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  let config = await getOne('SELECT * FROM ai_config ORDER BY id LIMIT 1');
  if (!config) {
    config = await getOne("INSERT INTO ai_config (provider) VALUES ('azure_openai') RETURNING *");
  }
  res.json(sanitizeConfig(config));
});

// Update AI config (admin only)
router.put('/config', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const {
    provider, enabled, max_tokens, temperature,
    // Azure fields
    azure_endpoint, azure_api_key, azure_deployment, azure_api_version,
    // Groq fields
    groq_api_key, groq_model,
    // Gemini fields
    gemini_api_key, gemini_model,
  } = req.body;

  let config = await getOne('SELECT * FROM ai_config ORDER BY id LIMIT 1');

  if (!config) {
    config = await getOne(
      `INSERT INTO ai_config (provider, azure_endpoint, azure_api_key, azure_deployment, azure_api_version,
        groq_api_key, groq_model, gemini_api_key, gemini_model, max_tokens, temperature, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [provider || 'azure_openai', azure_endpoint, azure_api_key, azure_deployment,
       azure_api_version || '2024-02-01', groq_api_key, groq_model || 'llama-3.3-70b-versatile',
       gemini_api_key, gemini_model || 'gemini-2.5-flash',
       max_tokens || 4000, temperature || 0.7, enabled ?? false]
    );
  } else {
    // Keep existing keys if not provided
    const finalAzureKey = azure_api_key || config.azure_api_key;
    const finalGroqKey  = groq_api_key  || config.groq_api_key;
    const finalGeminiKey  = gemini_api_key  || config.gemini_api_key;
    config = await getOne(
      `UPDATE ai_config SET
        provider=$1, azure_endpoint=$2, azure_api_key=$3, azure_deployment=$4, azure_api_version=$5,
        groq_api_key=$6, groq_model=$7, gemini_api_key=$8, gemini_model=$9, max_tokens=$10, temperature=$11, enabled=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [provider || config.provider, azure_endpoint, finalAzureKey, azure_deployment,
       azure_api_version || '2024-02-01', finalGroqKey, groq_model || config.groq_model || 'llama-3.3-70b-versatile',
       finalGeminiKey, gemini_model || config.gemini_model || 'gemini-2.5-flash',
       max_tokens || 4000, temperature || 0.7, enabled ?? false, config.id]
    );
  }

  res.json(sanitizeConfig(config));
});

// Test connection (tests the currently active provider)
router.post('/test', requireRole('admin'), async (req: AuthRequest, res: Response) => {
  const config = await getOne('SELECT * FROM ai_config ORDER BY id LIMIT 1');
  if (!config || !config.enabled) {
    res.status(400).json({ error: 'AI integration is not enabled' });
    return;
  }

  // Validate required fields per provider
  if (config.provider === 'groq') {
    if (!config.groq_api_key) {
      res.status(400).json({ error: 'Groq API Key is missing' });
      return;
    }
  } else if (config.provider === 'gemini') {
    if (!config.gemini_api_key) {
      res.status(400).json({ error: 'Gemini API Key is missing' });
      return;
    }
  } else {
    if (!config.azure_endpoint || !config.azure_api_key || !config.azure_deployment) {
      res.status(400).json({ error: 'Azure OpenAI configuration is incomplete' });
      return;
    }
  }

  try {
    const { url, headers, body } = buildProviderRequest(
      config,
      [{ role: 'user', content: 'Responde solo con: OK' }],
      10, 0
    );
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      res.status(400).json({ error: `Error ${response.status}: ${JSON.stringify(errData).substring(0, 300)}` });
      return;
    }

    const data = await response.json() as any;
    const modelUsed = data.model || body.model || config.azure_deployment || '—';
    res.json({ success: true, message: 'Connection successful', model: modelUsed });
  } catch (err: any) {
    res.status(500).json({ error: `Connection error: ${err.message}` });
  }
});

const SYSTEM_PROMPT = `You are a project management assistant. Your job is to help create structured work plans.
IMPORTANT: You must only respond to topics related to project management, task planning, sprints, and teamwork. If the user asks about unrelated topics, indicate that you can only help with project planning.

If you receive an image, analyze it and extract all relevant information to create a work plan (diagrams, lists, tables, texts).
If you receive a text file, analyze its content to create the plan.

You must ALWAYS respond in valid JSON format with this exact structure:
{
  "plan_nombre": "Plan name",
  "descripcion": "Brief description of the plan",
  "tareas": [
    {
      "nombre": "Parent task name",
      "descripcion": "Task description",
      "prioridad": "alta|media|baja|critica",
      "duracion_dias": 5,
      "subtareas": [
        {
          "nombre": "Subtask name",
          "descripcion": "Description",
          "prioridad": "media",
          "duracion_dias": 2
        }
      ]
    }
  ],
  "sprints_sugeridos": [
    {
      "nombre": "Sprint 1",
      "objetivo": "Sprint goal",
      "duracion_dias": 14,
      "tareas_incluidas": ["Task name 1", "Task name 2"]
    }
  ]
}

Do not include text outside the JSON. Do not use markdown. Pure JSON only.`;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
const TEXT_EXTENSIONS = ['.txt', '.csv', '.json', '.md', '.xml', '.yaml', '.yml', '.html', '.log'];

function isImageFile(filename: string): boolean {
  return IMAGE_EXTENSIONS.includes(extname(filename).toLowerCase());
}

function getFileMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
  };
  return mimeMap[ext] || 'image/png';
}

// Generate work plan from prompt (supports file/image uploads)
router.post('/generate-plan', requireRole('admin', 'editor'), upload.array('files', 5), async (req: AuthRequest, res: Response) => {
  const { prompt, proyecto_id, contexto_proyecto } = req.body;
  const files = (req as any).files as Express.Multer.File[] | undefined;

  if (!prompt && (!files || files.length === 0)) {
    res.status(400).json({ error: 'A prompt or at least one file is required' });
    return;
  }

  const config = await getOne('SELECT * FROM ai_config ORDER BY id LIMIT 1');
  const isConfigured = config?.enabled && (
    config.provider === 'groq'
      ? !!config.groq_api_key
      : config.provider === 'gemini'
        ? !!config.gemini_api_key
        : !!(config.azure_endpoint && config.azure_api_key && config.azure_deployment)
  );
  if (!isConfigured) {
    files?.forEach(f => { try { unlinkSync(f.path); } catch {} });
    res.status(400).json({ error: 'AI integration is not configured or enabled' });
    return;
  }

  try {
    // Build user message content (can be string or array for vision)
    const userContent: any[] = [];

    // Add text prompt
    let textPart = prompt || '';
    if (contexto_proyecto) {
      textPart = `Contexto del proyecto: ${contexto_proyecto}\n\nSolicitud: ${textPart}`;
    }

    // Process uploaded files
    if (files && files.length > 0) {
      const fileDescriptions: string[] = [];

      for (const file of files) {
        const filePath = file.path;

        if (isImageFile(file.originalname)) {
          // Image: convert to base64 for vision API
          const imageData = readFileSync(filePath);
          const base64 = imageData.toString('base64');
          const mimeType = getFileMimeType(file.originalname);

          userContent.push({
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
          });
          fileDescriptions.push(`[Imagen adjunta: ${file.originalname}]`);
        } else {
          // Text-based file: read content and include as text
          try {
            const content = readFileSync(filePath, 'utf-8');
            const truncated = content.length > 10000 ? content.substring(0, 10000) + '\n...(contenido truncado)' : content;
            fileDescriptions.push(`\n--- Contenido del archivo "${file.originalname}" ---\n${truncated}\n--- Fin del archivo ---`);
          } catch {
            fileDescriptions.push(`[No se pudo leer el archivo: ${file.originalname}]`);
          }
        }

        // Delete temp file
        try { unlinkSync(filePath); } catch {}
      }

      if (fileDescriptions.length > 0) {
        textPart += '\n\n' + fileDescriptions.join('\n');
      }
    }

    // Add text content
    if (textPart.trim()) {
      userContent.unshift({ type: 'text', text: textPart.trim() });
    }

    // If no images were attached, send as simple string for compatibility
    const finalUserContent = userContent.some((c: any) => c.type === 'image_url')
      ? userContent
      : textPart.trim();

    const { url, headers, body: reqBody } = buildProviderRequest(
      config,
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: finalUserContent },
      ],
      config.max_tokens || 4000,
      parseFloat(config.temperature) || 0.7
    );
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      res.status(400).json({ error: `Error de Azure OpenAI: ${response.status}` });
      return;
    }

    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const plan = JSON.parse(cleaned);
      res.json({ plan, raw: content, usage: data.usage });
    } catch {
      res.json({ plan: null, raw: content, usage: data.usage, error: 'Response is not valid JSON' });
    }
  } catch (err: any) {
    // Cleanup temp files on error
    files?.forEach(f => { try { unlinkSync(f.path); } catch {} });
    res.status(500).json({ error: `Error connecting to Azure OpenAI: ${err.message}` });
  }
});

// Apply plan — bulk create tasks from AI-generated plan
router.post('/apply-plan', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { proyecto_id, tareas, sprint } = req.body;

  if (!proyecto_id || !tareas || !Array.isArray(tareas)) {
    res.status(400).json({ error: 'proyecto_id and tareas are required' });
    return;
  }

  try {
    let sprintId: number | null = null;

    // Create sprint if provided
    if (sprint && sprint.nombre) {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + (sprint.duracion_dias || 14));

      const createdSprint = await getOne(
        'INSERT INTO sprints (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [proyecto_id, sprint.nombre, sprint.objetivo || null, 'planificacion',
         today.toISOString().split('T')[0], endDate.toISOString().split('T')[0],
         sprint.objetivo || null, 0]
      );
      sprintId = createdSprint.id;
    }

    const createdTasks: any[] = [];
    let orden = 0;

    for (const tarea of tareas) {
      // Calculate dates
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + (tarea.duracion_dias || 7));

      const parent = await getOne(
        'INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, duracion_dias, sprint_id, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
        [proyecto_id, tarea.nombre, tarea.descripcion || null, 'pendiente', tarea.prioridad || 'media',
         today.toISOString().split('T')[0], endDate.toISOString().split('T')[0],
         tarea.duracion_dias || null, sprintId, orden++]
      );
      createdTasks.push(parent);

      // Create subtasks
      if (tarea.subtareas && Array.isArray(tarea.subtareas)) {
        let subOrden = 0;
        for (const sub of tarea.subtareas) {
          const subEnd = new Date(today);
          subEnd.setDate(subEnd.getDate() + (sub.duracion_dias || 3));

          const child = await getOne(
            'INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, duracion_dias, tarea_padre_id, sprint_id, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
            [proyecto_id, sub.nombre, sub.descripcion || null, 'pendiente', sub.prioridad || 'media',
             today.toISOString().split('T')[0], subEnd.toISOString().split('T')[0],
             sub.duracion_dias || null, parent.id, sprintId, subOrden++]
          );
          createdTasks.push(child);
        }
      }
    }

    res.status(201).json({ message: `Plan applied: ${createdTasks.length} tasks created`, tasks: createdTasks, sprint_id: sprintId });
  } catch (err: any) {
    res.status(500).json({ error: `Error applying plan: ${err.message}` });
  }
});

// ─── Execute an AI-requested action against the DB ───────────────────────────
async function ejecutarAccion(
  accion: any,
  proyecto_id: number,
  user: { id: number; nombre: string }
): Promise<string> {
  switch (accion.tipo) {
    case 'update_tarea': {
      const campos = accion.campos || accion; // AI sometimes puts fields directly on accion
      // Normalize estado: AI may send "completado" but tareas requires "completada"
      if (campos.estado === 'completado') campos.estado = 'completada';
      const allowed = ['nombre', 'descripcion', 'estado', 'prioridad', 'fecha_inicio', 'fecha_fin',
        'duracion_dias', 'responsable_id', 'sprint_id', 'porcentaje_avance', 'story_points', 'tarea_padre_id'];
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in campos) { sets.push(`${key} = $${idx++}`); vals.push(campos[key] === '' ? null : campos[key]); }
      }
      if (sets.length === 0) return 'Sin cambios';
      vals.push(accion.id, proyecto_id);
      await run(`UPDATE tareas SET ${sets.join(', ')} WHERE id = $${idx++} AND proyecto_id = $${idx}`, vals);
      return `Tarea ${accion.id} actualizada`;
    }
    case 'create_tarea': {
      const today = new Date().toISOString().split('T')[0];
      const endDate = accion.fecha_fin || (accion.duracion_dias
        ? new Date(Date.now() + accion.duracion_dias * 86400000).toISOString().split('T')[0]
        : today);
      // Normalize estado: AI may send "completado" but tareas requires "completada"
      const estadoTarea = accion.estado === 'completado' ? 'completada' : (accion.estado || 'pendiente');
      const created = await getOne(
        `INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin,
          duracion_dias, responsable_id, tarea_padre_id, sprint_id, orden, porcentaje_avance, story_points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [proyecto_id, accion.nombre, accion.descripcion || null, estadoTarea,
          accion.prioridad || 'media', accion.fecha_inicio || today, endDate,
          accion.duracion_dias || null, accion.responsable_id || null,
          accion.tarea_padre_id || null, accion.sprint_id || null, 999,
          accion.porcentaje_avance || 0, accion.story_points || null]
      );
      return `Tarea "${accion.nombre}" creada (id: ${created?.id})`;
    }
    case 'delete_tarea': {
      await run('DELETE FROM tareas WHERE id = $1 AND proyecto_id = $2', [accion.id, proyecto_id]);
      return `Tarea ${accion.id} eliminada`;
    }
    case 'update_sprint': {
      const campos = accion.campos || accion; // AI sometimes puts fields directly on accion
      const allowed = ['nombre', 'descripcion', 'estado', 'fecha_inicio', 'fecha_fin', 'objetivo'];
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in campos) { sets.push(`${key} = $${idx++}`); vals.push(campos[key]); }
      }
      if (sets.length === 0) return 'Sin cambios';
      vals.push(accion.id, proyecto_id);
      await run(`UPDATE sprints SET ${sets.join(', ')} WHERE id = $${idx++} AND proyecto_id = $${idx}`, vals);
      return `Sprint ${accion.id} actualizado`;
    }
    case 'create_sprint': {
      const today = new Date().toISOString().split('T')[0];
      const endDate = accion.fecha_fin || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
      const created = await getOne(
        `INSERT INTO sprints (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, objetivo, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [proyecto_id, accion.nombre, accion.descripcion || null, 'planificacion',
          accion.fecha_inicio || today, endDate, accion.objetivo || null, 999]
      );
      return `Sprint "${accion.nombre}" creado (id: ${created?.id})`;
    }
    case 'add_comentario': {
      await getOne(
        `INSERT INTO tarea_comentarios (tarea_id, contenido, usuario_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [accion.tarea_id, `🤖 [IA] ${accion.contenido}`, user.id]
      );
      return `Comentario agregado a tarea ${accion.tarea_id}`;
    }
    case 'update_proyecto': {
      const campos = accion.campos || accion; // AI sometimes puts fields directly on accion
      const allowed = ['nombre', 'descripcion', 'estado', 'prioridad', 'fecha_inicio', 'fecha_fin', 'porcentaje_avance'];
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in campos) { sets.push(`${key} = $${idx++}`); vals.push(campos[key]); }
      }
      if (sets.length === 0) return 'Sin cambios';
      vals.push(proyecto_id);
      await run(`UPDATE proyectos SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
      return 'Proyecto actualizado';
    }
    case 'create_hito': {
      const created = await getOne(
        'INSERT INTO hitos (proyecto_id, nombre, fecha, completado) VALUES ($1,$2,$3,$4) RETURNING id',
        [proyecto_id, accion.nombre, accion.fecha, false]
      );
      return `Hito "${accion.nombre}" creado (id: ${created?.id})`;
    }
    case 'update_hito': {
      const campos = accion.campos || accion; // AI sometimes puts fields directly on accion
      const allowed = ['nombre', 'fecha', 'completado'];
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;
      for (const key of allowed) {
        if (key in campos) { sets.push(`${key} = $${idx++}`); vals.push(campos[key]); }
      }
      if (sets.length === 0) return 'Sin cambios';
      vals.push(accion.id, proyecto_id);
      await run(`UPDATE hitos SET ${sets.join(', ')} WHERE id = $${idx++} AND proyecto_id = $${idx}`, vals);
      return `Hito ${accion.id} actualizado`;
    }
    default:
      throw new Error(`Tipo de acción desconocido: ${accion.tipo}`);
  }
}

// ─── AI Chat: conversational assistant with full project context + actions ────
router.post('/chat', requireRole('admin', 'editor'), upload.array('files', 5), async (req: AuthRequest, res: Response) => {
  const { proyecto_id, messages } = req.body;
  const files = (req as any).files as Express.Multer.File[] | undefined;
  const parsedMessages: { role: string; content: string }[] =
    typeof messages === 'string' ? JSON.parse(messages) : (messages || []);

  if (!proyecto_id) {
    res.status(400).json({ error: 'proyecto_id is required' });
    return;
  }

  const config = await getOne('SELECT * FROM ai_config ORDER BY id LIMIT 1');
  const chatConfigured = config?.enabled && (
    config.provider === 'groq'
      ? !!config.groq_api_key
      : config.provider === 'gemini'
        ? !!config.gemini_api_key
        : !!(config.azure_endpoint && config.azure_api_key && config.azure_deployment)
  );
  if (!chatConfigured) {
    files?.forEach(f => { try { unlinkSync(f.path); } catch {} });
    res.status(400).json({ error: 'AI integration is not configured or enabled' });
    return;
  }

  try {
    // Load full project context
    const proyecto = await getOne(
      `SELECT p.*, r.nombre as responsable_nombre
       FROM proyectos p LEFT JOIN responsables r ON p.responsable_id = r.id
       WHERE p.id = $1`, [proyecto_id]
    );
    if (!proyecto) { res.status(404).json({ error: 'Project not found' }); return; }

    const [tareasRows, sprintsRows, hitosRows, responsablesRows] = await Promise.all([
      getAll(`SELECT t.*, r.nombre as responsable_nombre
              FROM tareas t LEFT JOIN responsables r ON t.responsable_id = r.id
              WHERE t.proyecto_id = $1 ORDER BY t.orden`, [proyecto_id]),
      getAll('SELECT * FROM sprints WHERE proyecto_id = $1 ORDER BY created_at', [proyecto_id]),
      getAll('SELECT * FROM hitos WHERE proyecto_id = $1 ORDER BY fecha', [proyecto_id]),
      getAll('SELECT id, nombre, rol FROM responsables ORDER BY nombre', []),
    ]);

    const today = new Date().toISOString().split('T')[0];

    const context = {
      proyecto: {
        id: proyecto.id, nombre: proyecto.nombre, descripcion: proyecto.descripcion,
        estado: proyecto.estado, prioridad: proyecto.prioridad,
        fecha_inicio: proyecto.fecha_inicio, fecha_fin: proyecto.fecha_fin,
        porcentaje_avance: proyecto.porcentaje_avance, responsable: proyecto.responsable_nombre,
      },
      equipo: responsablesRows.map((r: any) => ({ id: r.id, nombre: r.nombre, rol: r.rol })),
      sprints: sprintsRows.map((s: any) => ({
        id: s.id, nombre: s.nombre, estado: s.estado, objetivo: s.objetivo,
        fecha_inicio: s.fecha_inicio, fecha_fin: s.fecha_fin,
      })),
      tareas: tareasRows.map((t: any) => ({
        id: t.id, nombre: t.nombre, estado: t.estado, prioridad: t.prioridad,
        fecha_inicio: t.fecha_inicio, fecha_fin: t.fecha_fin,
        responsable: t.responsable_nombre, responsable_id: t.responsable_id,
        tarea_padre_id: t.tarea_padre_id, sprint_id: t.sprint_id,
        porcentaje_avance: t.porcentaje_avance, story_points: t.story_points,
        duracion_dias: t.duracion_dias,
      })),
      hitos: hitosRows.map((h: any) => ({
        id: h.id, nombre: h.nombre, fecha: h.fecha, completado: h.completado,
      })),
    };

    const systemPrompt = `You are PP-AI, a specialized assistant exclusively for project management within this application. Today is ${today}.

═══════════════════════════════════════════════════════
STRICT SCOPE — READ THIS FIRST
═══════════════════════════════════════════════════════
You can ONLY help with topics directly related to:
  • The project "${proyecto.nombre}" and its data (tasks, sprints, milestones, team, dates, progress)
  • General project management, planning, and analysis
  • Agile methodologies (Scrum, Kanban), estimates, risks, schedules
  • Actions within this application: create, modify, or delete tasks/sprints/milestones

REJECT ANY OTHER TOPIC. If the user asks about something outside this scope
(general tech, code, math, general culture, news, entertainment,
personal questions, etc.), respond ONLY with:
{
  "mensaje": "I can only help you with the management of the project '${proyecto.nombre}' and project planning topics. In what aspect of the project can I assist you?",
  "acciones": []
}
Do not give any other explanation or partially answer out-of-scope topics.

═══════════════════════════════════════════════════════
CURRENT PROJECT CONTEXT
═══════════════════════════════════════════════════════
${JSON.stringify(context, null, 2)}

═══════════════════════════════════════════════════════
WHAT YOU CAN DO
═══════════════════════════════════════════════════════
ANALYSIS (without actions):
  • Overall project status: progress, risks, bottlenecks
  • Overdue, unassigned, blocked, or undated tasks
  • Workload per assignee
  • Plan consistency: dates, dependencies, durations
  • Recommendations for prioritization and next steps

MODIFICATIONS (with actions):
  • Create, edit, or delete tasks and subtasks
  • Move dates individually or in bulk
  • Assign or reassign responsible persons
  • Change statuses, priorities, and progress percentages
  • Create or update sprints
  • Add comments on tasks
  • Create or update milestones
  • Update project data

═══════════════════════════════════════════════════════
RESPONSE FORMAT — ALWAYS PURE JSON, NO MARKDOWN
═══════════════════════════════════════════════════════
{
  "mensaje": "Response in English, clear and project-oriented. If you executed actions, explain what you did and why.",
  "acciones": []
}

═══════════════════════════════════════════════════════
AVAILABLE ACTIONS
═══════════════════════════════════════════════════════
update_tarea:   {"tipo":"update_tarea","id":123,"campos":{"fecha_fin":"YYYY-MM-DD","responsable_id":5,"estado":"en_progreso","prioridad":"alta","porcentaje_avance":75,"story_points":8,"nombre":"...","descripcion":"..."}}
  → valid states for tasks: "pendiente" | "en_progreso" | "completada" | "bloqueada"  (NEVER "completado")
  → valid priorities: "baja" | "media" | "alta" | "critica"
create_tarea:   {"tipo":"create_tarea","nombre":"...","descripcion":"...","prioridad":"media","fecha_inicio":"YYYY-MM-DD","fecha_fin":"YYYY-MM-DD","duracion_dias":5,"responsable_id":null,"tarea_padre_id":null,"sprint_id":null,"story_points":null}
  → uses the same valid states and priorities as update_tarea
delete_tarea:   {"tipo":"delete_tarea","id":123}
update_sprint:  {"tipo":"update_sprint","id":456,"campos":{"nombre":"...","estado":"activo","fecha_inicio":"YYYY-MM-DD","fecha_fin":"YYYY-MM-DD","objetivo":"..."}}
create_sprint:  {"tipo":"create_sprint","nombre":"...","objetivo":"...","fecha_inicio":"YYYY-MM-DD","fecha_fin":"YYYY-MM-DD"}
add_comentario: {"tipo":"add_comentario","tarea_id":123,"contenido":"Comment text"}
update_proyecto:{"tipo":"update_proyecto","campos":{"estado":"en_progreso","fecha_fin":"YYYY-MM-DD"}}
create_hito:    {"tipo":"create_hito","nombre":"...","fecha":"YYYY-MM-DD"}
update_hito:    {"tipo":"update_hito","id":789,"campos":{"nombre":"...","fecha":"YYYY-MM-DD","completado":true}}

═══════════════════════════════════════════════════════
OPERATION RULES
═══════════════════════════════════════════════════════
- ALWAYS use the exact numeric IDs from the context (never invent IDs)
- Dates in YYYY-MM-DD format
- Analysis → acciones: [], detailed message
- Modifications → acciones with changes + message explaining what was done
- You can execute multiple actions in a single response
- Pure JSON only — no text, no markdown blocks outside JSON`;

    // Validate provider config
    if (config.provider === 'groq') {
      if (!config.groq_api_key) {
        res.status(400).json({ error: 'Groq API Key is missing. Configure it in Settings → AI.' });
        return;
      }
    } else if (config.provider === 'gemini') {
      if (!config.gemini_api_key) {
        res.status(400).json({ error: 'Gemini API Key is missing. Configure it in Settings → AI.' });
        return;
      }
    } else {
      if (!config.azure_endpoint || !config.azure_api_key || !config.azure_deployment) {
        res.status(400).json({ error: 'Azure OpenAI configuration is incomplete.' });
        return;
      }
    }

    // Build conversation
    const conversationMessages: any[] = [{ role: 'system', content: systemPrompt }];

    // Add previous messages (history, text only)
    for (let i = 0; i < parsedMessages.length - 1; i++) {
      conversationMessages.push({ role: parsedMessages[i].role, content: parsedMessages[i].content });
    }

    // Last user message — may include files
    const lastMsg = parsedMessages[parsedMessages.length - 1];
    let lastContent: any = lastMsg?.content || '';

    if (files && files.length > 0) {
      const contentParts: any[] = [];
      const textExtras: string[] = [];

      for (const file of files) {
        // Groq doesn't support vision yet — treat images as text note
        if (isImageFile(file.originalname) && config.provider !== 'groq') {
          const imageData = readFileSync(file.path);
          const base64 = imageData.toString('base64');
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${getFileMimeType(file.originalname)};base64,${base64}`, detail: 'high' },
          });
        } else if (TEXT_EXTENSIONS.includes(extname(file.originalname).toLowerCase()) || isImageFile(file.originalname)) {
          if (!isImageFile(file.originalname)) {
            try {
              const content = readFileSync(file.path, 'utf-8');
              const truncated = content.length > 8000 ? content.substring(0, 8000) + '\n...(truncado)' : content;
              textExtras.push(`\n--- Archivo: ${file.originalname} ---\n${truncated}\n---`);
            } catch {}
          } else {
            textExtras.push(`[Imagen adjunta: ${file.originalname} — análisis de imágenes no disponible con el proveedor actual]`);
          }
        }
        try { unlinkSync(file.path); } catch {}
      }

      const fullText = (lastMsg?.content || '') + (textExtras.length ? '\n' + textExtras.join('\n') : '');
      if (fullText.trim()) contentParts.unshift({ type: 'text', text: fullText.trim() });

      lastContent = contentParts.some((c: any) => c.type === 'image_url') ? contentParts : fullText.trim();
    }

    conversationMessages.push({ role: 'user', content: lastContent });

    // Call the active provider
    const maxTokens = config.max_tokens || 4000;
    const temperature = parseFloat(config.temperature) || 0.6;
    const { url, headers, body } = buildProviderRequest(config, conversationMessages, maxTokens, temperature);

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const providerName = config.provider === 'groq' ? 'Groq' : config.provider === 'gemini' ? 'Gemini' : 'Azure OpenAI';
      res.status(400).json({ error: `${providerName} Error: ${response.status} - ${JSON.stringify(errData).substring(0, 200)}` });
      return;
    }

    const data = await response.json() as any;
    const rawContent = data.choices?.[0]?.message?.content || '';

    // Parse AI response
    let aiResponse: { mensaje: string; acciones: any[] } = { mensaje: rawContent, acciones: [] };
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      aiResponse = JSON.parse(cleaned);
    } catch {
      // If not JSON, treat as plain text answer
      aiResponse = { mensaje: rawContent, acciones: [] };
    }

    // Execute actions
    const accionesEjecutadas: { tipo: string; descripcion: string; exito: boolean }[] = [];
    if (Array.isArray(aiResponse.acciones)) {
      for (const accion of aiResponse.acciones) {
        try {
          const descripcion = await ejecutarAccion(accion, parseInt(proyecto_id as string), {
            id: req.user!.id,
            nombre: req.user!.nombre,
          });
          accionesEjecutadas.push({ tipo: accion.tipo, descripcion, exito: true });
        } catch (e: any) {
          accionesEjecutadas.push({ tipo: accion.tipo, descripcion: e.message, exito: false });
        }
      }
    }

    res.json({
      mensaje: aiResponse.mensaje || 'Sin respuesta',
      acciones_ejecutadas: accionesEjecutadas,
      usage: data.usage,
    });

  } catch (err: any) {
    files?.forEach(f => { try { unlinkSync(f.path); } catch {} });
    res.status(500).json({ error: `Error processing request: ${err.message}` });
  }
});

export default router;
