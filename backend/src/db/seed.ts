import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new pg.Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'ppai',
  user:     process.env.DB_USER     || 'ppai',
  password: process.env.DB_PASSWORD,          // Required — set via .env or env var
});

async function seed() {
  const client = await pool.connect();

  try {
    // Run schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schema);

    // Clear existing data (respecting FK order)
    await client.query(`
      TRUNCATE dependencias, hitos, tareas, proyectos, programas, responsables, usuarios RESTART IDENTITY CASCADE
    `);

    // Create users
    const adminHash = bcrypt.hashSync('admin123', 10);
    const editorHash = bcrypt.hashSync('editor123', 10);
    const viewerHash = bcrypt.hashSync('viewer123', 10);

    await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
      ['Administrator', 'admin@app.com', adminHash, 'admin']
    );
    await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
      ['Editor Demo', 'editor@app.com', editorHash, 'editor']
    );
    await client.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4)',
      ['Viewer Demo', 'viewer@app.com', viewerHash, 'viewer']
    );

    // Create responsables
    const responsables = [
      { nombre: 'Carlos Méndez', email: 'carlos@empresa.com', rol: 'Program Director', color: '#2563eb' },
      { nombre: 'Ana García', email: 'ana@empresa.com', rol: 'Project Manager', color: '#dc2626' },
      { nombre: 'Luis Torres', email: 'luis@empresa.com', rol: 'Senior Developer', color: '#16a34a' },
      { nombre: 'María López', email: 'maria@empresa.com', rol: 'Analyst', color: '#9333ea' },
      { nombre: 'Pedro Ruiz', email: 'pedro@empresa.com', rol: 'UX Designer', color: '#ea580c' },
    ];

    for (const r of responsables) {
      await client.query(
        'INSERT INTO responsables (nombre, email, rol, color) VALUES ($1, $2, $3, $4)',
        [r.nombre, r.email, r.rol, r.color]
      );
    }

    // Create programas
    const programas = [
      ['Digital Transformation', 'Enterprise technological modernization program', 'activo', '2026-01-01', '2026-12-31', 500000, '#1e3a5f', 1],
      ['Commercial Expansion', 'Opening new markets and sales channels', 'activo', '2026-02-01', '2026-10-31', 300000, '#2563eb', 2],
      ['Operational Improvement', 'Internal process optimization', 'activo', '2026-03-01', '2026-09-30', 150000, '#16a34a', 1],
    ];
    for (const p of programas) {
      await client.query(
        'INSERT INTO programas (nombre, descripcion, estado, fecha_inicio, fecha_fin, presupuesto, color, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        p
      );
    }

    // Create proyectos
    const proyectos = [
      [1, 'New Web Portal', 'Complete redesign of the corporate portal', 'en_progreso', 'alta', '2026-01-15', '2026-06-30', 35, 2],
      [1, 'Mobile App', 'Mobile application development for customers', 'planificacion', 'alta', '2026-04-01', '2026-09-30', 0, 3],
      [1, 'Cloud Migration', 'Infrastructure migration to the cloud', 'en_progreso', 'critica', '2026-02-01', '2026-08-31', 20, 3],
      [2, 'B2B E-commerce', 'B2B sales platform', 'en_progreso', 'alta', '2026-02-15', '2026-07-31', 45, 2],
      [2, 'Integrated CRM', 'CRM implementation with ERP integration', 'planificacion', 'media', '2026-05-01', '2026-10-31', 0, 4],
      [3, 'HR Automation', 'Automate human resources processes', 'en_progreso', 'media', '2026-03-15', '2026-07-15', 60, 4],
    ];
    for (const p of proyectos) {
      await client.query(
        'INSERT INTO proyectos (programa_id, nombre, descripcion, estado, prioridad, fecha_inicio, fecha_fin, porcentaje_avance, responsable_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        p
      );
    }

    // Create tareas for "New Web Portal" (proyecto_id = 1)
    const tareas = [
      // Fase 1: Diseño
      [1, 'Phase 1: Design', 'Design and prototyping of the portal', 'completada', '2026-01-15', '2026-02-28', 45, 5, null, 1],
      [1, 'User Research', 'Interviews and surveys', 'completada', '2026-01-15', '2026-01-31', 17, 4, 1, 1],
      [1, 'Wireframes', 'Wireframe design of all pages', 'completada', '2026-02-01', '2026-02-14', 14, 5, 1, 2],
      [1, 'Interactive Prototype', 'Prototype in Figma', 'completada', '2026-02-15', '2026-02-28', 14, 5, 1, 3],
      // Fase 2: Desarrollo
      [1, 'Phase 2: Development', 'Frontend and backend development', 'en_progreso', '2026-03-01', '2026-05-31', 92, 3, null, 2],
      [1, 'Project Setup', 'Environment configuration', 'completada', '2026-03-01', '2026-03-07', 7, 3, 5, 1],
      [1, 'Frontend Development', 'Implementation of UI components', 'en_progreso', '2026-03-08', '2026-04-30', 54, 3, 5, 2],
      [1, 'Backend Development', 'APIs and services', 'en_progreso', '2026-03-08', '2026-04-30', 54, 3, 5, 3],
      [1, 'Integration', 'Frontend-backend integration', 'pendiente', '2026-05-01', '2026-05-31', 31, 3, 5, 4],
      // Fase 3: Testing y Lanzamiento
      [1, 'Phase 3: Testing and Launch', 'QA and deploy', 'pendiente', '2026-06-01', '2026-06-30', 30, 2, null, 3],
      [1, 'QA Testing', 'Functional and performance testing', 'pendiente', '2026-06-01', '2026-06-15', 15, 4, 10, 1],
      [1, 'Bug Fixing', 'Issue resolution', 'pendiente', '2026-06-16', '2026-06-25', 10, 3, 10, 2],
      [1, 'Production Deploy', 'Official launch', 'pendiente', '2026-06-26', '2026-06-30', 5, 3, 10, 3],
      // Tareas for "E-commerce B2B" (proyecto_id = 4)
      [4, 'Requirements Analysis', 'Define ecommerce features', 'completada', '2026-02-15', '2026-03-07', 21, 4, null, 1],
      [4, 'Platform Design', 'UI/UX design of ecommerce', 'completada', '2026-03-08', '2026-03-28', 21, 5, null, 2],
      [4, 'Product Catalog', 'Catalog module development', 'en_progreso', '2026-03-29', '2026-04-25', 28, 3, null, 3],
      [4, 'Cart and Checkout', 'Shopping system', 'pendiente', '2026-04-26', '2026-05-23', 28, 3, null, 4],
      [4, 'Payment Gateway', 'Integration with payment processor', 'pendiente', '2026-05-24', '2026-06-20', 28, 3, null, 5],
      [4, 'Testing and Launch', 'QA and ecommerce deploy', 'pendiente', '2026-06-21', '2026-07-31', 41, 2, null, 6],
      // Tareas for "Automatización RRHH" (proyecto_id = 6)
      [6, 'Process Mapping', 'Document current processes', 'completada', '2026-03-15', '2026-03-31', 17, 4, null, 1],
      [6, 'Tool Selection', 'Evaluate and select software', 'completada', '2026-04-01', '2026-04-15', 15, 4, null, 2],
      [6, 'System Configuration', 'Setup and parameterization', 'en_progreso', '2026-04-16', '2026-05-15', 30, 3, null, 3],
      [6, 'Data Migration', 'Transfer data to new system', 'pendiente', '2026-05-16', '2026-06-15', 31, 3, null, 4],
      [6, 'Training', 'Team training', 'pendiente', '2026-06-16', '2026-07-15', 30, 4, null, 5],
    ];

    for (const t of tareas) {
      await client.query(
        'INSERT INTO tareas (proyecto_id, nombre, descripcion, estado, fecha_inicio, fecha_fin, duracion_dias, responsable_id, tarea_padre_id, orden) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
        t
      );
    }

    // Dependencias
    const dependencias = [
      [3, 2, 'fin_a_inicio'], [4, 3, 'fin_a_inicio'], [5, 1, 'fin_a_inicio'],
      [9, 7, 'fin_a_inicio'], [9, 8, 'fin_a_inicio'], [10, 5, 'fin_a_inicio'],
      [12, 11, 'fin_a_inicio'], [13, 12, 'fin_a_inicio'], [15, 14, 'fin_a_inicio'],
      [16, 15, 'fin_a_inicio'], [17, 16, 'fin_a_inicio'], [18, 17, 'fin_a_inicio'],
      [19, 18, 'fin_a_inicio'],
    ];
    for (const d of dependencias) {
      await client.query(
        'INSERT INTO dependencias (tarea_id, tarea_dependiente_id, tipo) VALUES ($1, $2, $3)',
        d
      );
    }

    // Hitos
    const hitos = [
      [1, 'Design Approved', '2026-02-28', true],
      [1, 'MVP Ready', '2026-05-31', false],
      [1, 'Portal Launch', '2026-06-30', false],
      [4, 'Platform in Staging', '2026-06-20', false],
      [4, 'Ecommerce Go-Live', '2026-07-31', false],
      [6, 'System Configured', '2026-05-15', false],
      [6, 'HR Go-Live', '2026-07-15', false],
    ];
    for (const h of hitos) {
      await client.query(
        'INSERT INTO hitos (proyecto_id, nombre, fecha, completado) VALUES ($1, $2, $3, $4)',
        h
      );
    }

    console.log('✅ Base de datos poblada con datos de ejemplo');
    console.log('👤 Usuario admin: admin@app.com / admin123');
    console.log('👤 Usuario editor: editor@app.com / editor123');
    console.log('👤 Usuario viewer: viewer@app.com / viewer123');
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
