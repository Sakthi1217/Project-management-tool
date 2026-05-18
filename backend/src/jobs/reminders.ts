import cron from 'node-cron';
import { getAll } from '../db/database.js';
import { sendReminderEmail } from '../services/mail.js';

export function startReminderJobs(): void {
  // Run daily at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Checking for tasks due in the next 3 days...');

    try {
      const today = new Date().toISOString().split('T')[0];
      const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const tasks = await getAll(`
        SELECT t.nombre, t.fecha_fin, p.nombre as proyecto, r.email
        FROM tareas t
        JOIN proyectos p ON t.proyecto_id = p.id
        LEFT JOIN responsables r ON t.responsable_id = r.id
        WHERE t.estado NOT IN ('completada')
          AND t.fecha_fin >= $1
          AND t.fecha_fin <= $2
          AND r.email IS NOT NULL
      `, [today, threeDaysLater]) as Array<{ nombre: string; fecha_fin: string; proyecto: string; email: string }>;

      // Group by email
      const grouped = new Map<string, Array<{ nombre: string; fecha_fin: string; proyecto: string }>>();
      for (const task of tasks) {
        if (!grouped.has(task.email)) grouped.set(task.email, []);
        grouped.get(task.email)!.push({ nombre: task.nombre, fecha_fin: task.fecha_fin, proyecto: task.proyecto });
      }

      for (const [email, taskList] of grouped) {
        await sendReminderEmail(email, taskList);
      }

      console.log(`[CRON] Sent reminders for ${tasks.length} tasks to ${grouped.size} people`);
    } catch (error) {
      console.error('[CRON] Error in reminder job:', error);
    }
  });

  console.log('📧 Reminder cron job scheduled (daily at 8:00 AM)');
}
