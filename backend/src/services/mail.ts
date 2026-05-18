import nodemailer from 'nodemailer';

const isEnabled = process.env.ENABLE_EMAIL === 'true';

let transporter: nodemailer.Transporter | null = null;

if (isEnabled && process.env.SMTP_HOST) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter || !isEnabled) {
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error('Error enviando email:', error);
    return false;
  }
}

export async function sendTaskAssignedEmail(
  toEmail: string,
  taskName: string,
  projectName: string,
  dueDate: string
): Promise<boolean> {
  const html = `
    <h2>Nueva tarea asignada</h2>
    <p>Se te ha asignado la tarea <strong>${taskName}</strong> en el proyecto <strong>${projectName}</strong>.</p>
    <p><strong>Fecha límite:</strong> ${dueDate}</p>
  `;
  return sendEmail(toEmail, `Nueva tarea: ${taskName}`, html);
}

export async function sendReminderEmail(
  toEmail: string,
  tasks: Array<{ nombre: string; fecha_fin: string; proyecto: string }>
): Promise<boolean> {
  const taskList = tasks.map(t => `<li><strong>${t.nombre}</strong> (${t.proyecto}) - vence: ${t.fecha_fin}</li>`).join('');
  const html = `
    <h2>Recordatorio de tareas próximas a vencer</h2>
    <p>Las siguientes tareas vencen en los próximos 3 días:</p>
    <ul>${taskList}</ul>
  `;
  return sendEmail(toEmail, 'Recordatorio: Tareas próximas a vencer', html);
}
