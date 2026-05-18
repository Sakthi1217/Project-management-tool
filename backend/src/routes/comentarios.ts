import { Router, Response } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { join, extname } from 'path';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { getOne, getAll, run } from '../db/database.js';
import { authMiddleware, AuthRequest, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Multer config ──
const uploadsDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ── GET comentarios de una tarea ──
router.get('/tarea/:tareaId', async (req: AuthRequest, res: Response) => {
  const comentarios = await getAll(`
    SELECT c.*, u.nombre as usuario_nombre, u.email as usuario_email
    FROM tarea_comentarios c
    JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.tarea_id = $1
    ORDER BY c.created_at DESC
  `, [req.params.tareaId]);

  // Attach files and mentions to each comment
  for (const c of comentarios) {
    c.archivos = await getAll(
      'SELECT * FROM tarea_archivos WHERE comentario_id = $1 ORDER BY created_at ASC',
      [c.id]
    );
    c.menciones = await getAll(`
      SELECT m.responsable_id, r.nombre as responsable_nombre
      FROM tarea_menciones m
      JOIN responsables r ON m.responsable_id = r.id
      WHERE m.comentario_id = $1
    `, [c.id]);
  }

  res.json(comentarios);
});

// ── GET archivos sueltos de una tarea (sin comentario) ──
router.get('/archivos/tarea/:tareaId', async (req: AuthRequest, res: Response) => {
  const archivos = await getAll(
    'SELECT * FROM tarea_archivos WHERE tarea_id = $1 AND comentario_id IS NULL ORDER BY created_at DESC',
    [req.params.tareaId]
  );
  res.json(archivos);
});

// ── POST crear comentario ──
router.post('/', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { tarea_id, contenido, menciones } = req.body;
  if (!tarea_id || !contenido?.trim()) {
    res.status(400).json({ error: 'tarea_id y contenido son requeridos' });
    return;
  }

  const created = await getOne(
    'INSERT INTO tarea_comentarios (tarea_id, usuario_id, contenido) VALUES ($1, $2, $3) RETURNING *',
    [tarea_id, req.user!.id, contenido.trim()]
  );

  // Insert mentions
  if (menciones && Array.isArray(menciones)) {
    for (const responsableId of menciones) {
      await run(
        'INSERT INTO tarea_menciones (comentario_id, responsable_id) VALUES ($1, $2)',
        [created.id, responsableId]
      );
    }
  }

  // Fetch full comment with user info
  const full = await getOne(`
    SELECT c.*, u.nombre as usuario_nombre, u.email as usuario_email
    FROM tarea_comentarios c
    JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.id = $1
  `, [created.id]);

  full.archivos = [];
  full.menciones = menciones
    ? await getAll(`
        SELECT m.responsable_id, r.nombre as responsable_nombre
        FROM tarea_menciones m
        JOIN responsables r ON m.responsable_id = r.id
        WHERE m.comentario_id = $1
      `, [created.id])
    : [];

  res.status(201).json(full);
});

// ── PUT actualizar comentario ──
router.put('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const { contenido } = req.body;
  const comment = await getOne('SELECT * FROM tarea_comentarios WHERE id = $1', [req.params.id]);
  if (!comment) { res.status(404).json({ error: 'Comentario no encontrado' }); return; }

  // Only author or admin can edit
  if (comment.usuario_id !== req.user!.id && req.user!.rol !== 'admin') {
    res.status(403).json({ error: 'Solo puedes editar tus propios comentarios' });
    return;
  }

  const updated = await getOne(
    'UPDATE tarea_comentarios SET contenido = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [contenido, req.params.id]
  );
  res.json(updated);
});

// ── DELETE comentario ──
router.delete('/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const comment = await getOne('SELECT * FROM tarea_comentarios WHERE id = $1', [req.params.id]);
  if (!comment) { res.status(404).json({ error: 'Comentario no encontrado' }); return; }

  if (comment.usuario_id !== req.user!.id && req.user!.rol !== 'admin') {
    res.status(403).json({ error: 'Solo puedes eliminar tus propios comentarios' });
    return;
  }

  // Delete associated files from disk
  const archivos = await getAll('SELECT * FROM tarea_archivos WHERE comentario_id = $1', [req.params.id]);
  for (const a of archivos) {
    const filePath = join(uploadsDir, a.nombre_archivo);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  await run('DELETE FROM tarea_comentarios WHERE id = $1', [req.params.id]);
  res.json({ message: 'Comentario eliminado' });
});

// ── POST upload archivo ──
router.post('/upload', requireRole('admin', 'editor'), upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    return;
  }

  const { tarea_id, comentario_id } = req.body;
  if (!tarea_id) {
    res.status(400).json({ error: 'tarea_id es requerido' });
    return;
  }

  const created = await getOne(
    'INSERT INTO tarea_archivos (tarea_id, comentario_id, usuario_id, nombre_original, nombre_archivo, mime_type, tamano) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [
      tarea_id,
      comentario_id || null,
      req.user!.id,
      req.file.originalname,
      req.file.filename,
      req.file.mimetype,
      req.file.size,
    ]
  );

  res.status(201).json(created);
});

// ── DELETE archivo ──
router.delete('/archivo/:id', requireRole('admin', 'editor'), async (req: AuthRequest, res: Response) => {
  const archivo = await getOne('SELECT * FROM tarea_archivos WHERE id = $1', [req.params.id]);
  if (!archivo) { res.status(404).json({ error: 'Archivo no encontrado' }); return; }

  const filePath = join(uploadsDir, archivo.nombre_archivo);
  if (existsSync(filePath)) unlinkSync(filePath);

  await run('DELETE FROM tarea_archivos WHERE id = $1', [req.params.id]);
  res.json({ message: 'Archivo eliminado' });
});

export default router;
