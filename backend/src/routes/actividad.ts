import { Router, Response } from 'express';
import { getAll } from '../db/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// Get activity for a project (last 100 events)
router.get('/proyecto/:proyectoId', async (req: AuthRequest, res: Response) => {
  const actividad = await getAll(
    `SELECT * FROM proyecto_actividad
     WHERE proyecto_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [req.params.proyectoId]
  );
  res.json(actividad);
});

export default router;
