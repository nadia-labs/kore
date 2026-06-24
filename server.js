// ══════════════════════════════════════════════
//  KORE APP — Motor Express principal
//  Stack: Node.js 20 · Express 4 · better-sqlite3
// ══════════════════════════════════════════════

'use strict';

require('dotenv').config({ override: true });

// ── Dependencias
const express       = require('express');
const path          = require('path');
const fs            = require('fs');
const os            = require('os');
const bcrypt        = require('bcrypt');
const cookieSession = require('cookie-session');
const Database      = require('better-sqlite3');
const multer        = require('multer');
const sharp         = require('sharp');
const AdmZip        = require('adm-zip');

// ── Configuración desde .env
const PORT            = parseInt(process.env.PORT)    || 3001;
const PROJECT_NAME    = process.env.PROJECT_NAME      || 'Kore App';
const PROJECT_URL     = process.env.PROJECT_URL       || '';
const DB_PATH         = process.env.DB_PATH           || path.join(__dirname, 'db', 'database.sqlite');
const SESSION_SECRET  = process.env.SESSION_SECRET;
const KAPITAN_USER    = process.env.KAPITAN_USER;
const KAPITAN_PASS    = process.env.KAPITAN_PASS;
const CLAUDE_API_KEY  = process.env.CLAUDE_API_KEY    || '';
const CLAUDE_MODEL    = process.env.CLAUDE_MODEL      || 'claude-haiku-4-5-20251001';
const KORE_INSTALLED  = process.env.KORE_INSTALLED    === 'true';

// ── Validar variables críticas
if (!SESSION_SECRET) { console.error('[Kore] ✕ SESSION_SECRET no definido en .env'); process.exit(1); }
// KAPITAN_USER/PASS solo requeridos si la instalación ya está completa
if (KORE_INSTALLED && (!KAPITAN_USER || !KAPITAN_PASS)) {
  console.error('[Kore] ✕ KAPITAN_USER o KAPITAN_PASS no definidos en .env');
  process.exit(1);
}
if (!KORE_INSTALLED) {
  console.log('[Kore] ⚙  Modo configuración activo → visita /setup para completar la instalación');
}

// ══════════════════════════════════════════════
//  BASE DE DATOS
// ══════════════════════════════════════════════

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tiers (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, precio INTEGER DEFAULT 0,
      descripcion TEXT, color TEXT DEFAULT '#55556a', orden INTEGER DEFAULT 0, activo INTEGER DEFAULT 1
    );
    INSERT OR IGNORE INTO tiers (id, nombre, descripcion, color, orden) VALUES
      ('basico',    'Básico',    'Listado gratuito, sin destacado',              '#55556a', 1),
      ('visible',   'Visible',   'Prioridad en listados, borde de color',        '#A78BFA', 2),
      ('destacado', 'Destacado', 'Logo + descripción + posición preferente',     '#00C8FF', 3),
      ('vip',       'VIP',       'Máxima visibilidad, prioridad absoluta en IA', '#FFD700', 4);

    CREATE TABLE IF NOT EXISTS agenda (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, fecha TEXT NOT NULL,
      hora_inicio TEXT, hora_fin TEXT, duracion TEXT, tipo TEXT, lugar TEXT,
      descripcion TEXT, imagen_url TEXT, destacado INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1, orden INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now')), actualizado TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS noticias (
      id TEXT PRIMARY KEY, titulo TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
      bajada TEXT, contenido TEXT, imagen_url TEXT, alt_imagen TEXT,
      categoria TEXT, autor TEXT, youtube_id TEXT,
      meta_descripcion TEXT, palabras_clave TEXT,
      publicado INTEGER DEFAULT 0, fecha_pub TEXT DEFAULT (datetime('now')),
      is_portada INTEGER DEFAULT 0, orden INTEGER, es_recomendado INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now')), actualizado TEXT DEFAULT (datetime('now'))
    );


    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, imagen_url TEXT, link TEXT,
      posicion TEXT DEFAULT 'header', activo INTEGER DEFAULT 1,
      fecha_inicio TEXT, fecha_fin TEXT, orden INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS popup (
      id TEXT PRIMARY KEY DEFAULT 'popup', titulo TEXT, mensaje TEXT,
      tipo TEXT DEFAULT 'info', imagen_url TEXT, boton_texto TEXT, boton_link TEXT,
      activo INTEGER DEFAULT 0, frecuencia TEXT DEFAULT 'sesion',
      actualizado TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO popup (id, activo) VALUES ('popup', 0);

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, usuario TEXT UNIQUE NOT NULL,
      clave_hash TEXT NOT NULL, rol TEXT NOT NULL CHECK(rol IN ('admin','editor')),
      activo INTEGER DEFAULT 1, creado_en TEXT DEFAULT (datetime('now')), ultimo_login TEXT
    );

    CREATE TABLE IF NOT EXISTS kits_instalados (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, version TEXT, icono TEXT,
      descripcion TEXT, activo INTEGER DEFAULT 1, instalado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
    INSERT OR IGNORE INTO config (clave, valor) VALUES
      ('kit_agenda','1'),('kit_noticias','1'),('kit_banners','1'),
      ('kit_popup','1'),('kit_notificaciones','0'),('kit_telegram','0');

    CREATE TABLE IF NOT EXISTS kconfig (clave TEXT PRIMARY KEY, valor TEXT);

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      texto TEXT NOT NULL,
      actualizado TEXT DEFAULT (datetime('now'))
    );
    INSERT OR IGNORE INTO prompts (id, texto) VALUES ('comunicado_prensa',
'Eres un editor periodístico experto en SEO para medios digitales chilenos.
A partir del comunicado de prensa que recibirás, genera una noticia completamente optimizada.

REGLAS OBLIGATORIAS:
- Título: máximo 70 caracteres, periodístico y directo, la keyword principal al inicio
- Bajada: exactamente 2 oraciones que responden quién, qué, cuándo y dónde
- Cuerpo HTML: mínimo 500 palabras, usa etiquetas <p> para párrafos
- Subtítulos <h2>: uno cada 2 o 3 párrafos, con keywords secundarias naturales (no genéricos)
- El primer párrafo debe resumir toda la noticia (pirámide invertida)
- Meta descripción: máximo 155 caracteres, incluye la keyword principal
- Palabras clave: entre 5 y 8 términos, separados por coma, orden descendente de importancia
- Slug URL: desde el título, solo minúsculas, sin tildes, espacios reemplazados por guiones
- Tono: informativo, directo, sin lenguaje institucional ni corporativo
- No inventes datos que no estén en el comunicado

Devuelve ÚNICAMENTE JSON válido (sin texto antes ni después, sin bloques de código) con estas claves:
{
  "titulo": "...",
  "bajada": "...",
  "contenido": "...HTML completo...",
  "meta_descripcion": "...",
  "palabras_clave": "...",
  "slug": "..."
}

COMUNICADO DE PRENSA:
{{texto}}');

    CREATE TABLE IF NOT EXISTS push_subs (
      id TEXT PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      keys TEXT,
      creado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS analytics (
      id TEXT PRIMARY KEY,
      path TEXT,
      referrer TEXT,
      ts TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      fuente TEXT PRIMARY KEY, ultima_sync TEXT, status TEXT DEFAULT 'ok', mensaje TEXT
    );

    CREATE TABLE IF NOT EXISTS contactos (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL,
      telefono TEXT, asunto TEXT, mensaje TEXT NOT NULL,
      ip TEXT, leido INTEGER DEFAULT 0, creado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kore_migrations (
      version INTEGER PRIMARY KEY,
      nombre  TEXT NOT NULL,
      aplicado_en TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kustomizations (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      css_overrides TEXT,
      explanation TEXT,
      status TEXT DEFAULT 'preview',
      activo INTEGER DEFAULT 0,
      creado_en TEXT DEFAULT (datetime('now')),
      aplicado_en TEXT
    );
  `);
  console.log(`[Kore] ✓ Base de datos lista`);
}

// ── Sistema de migraciones versionado ──────────────────────────────────────
// Cada migración es idempotente y se ejecuta exactamente una vez por instancia.
// Para agregar una migración: añadir un nuevo bloque if (!aplicada(N)) { ... }
// ────────────────────────────────────────────────────────────────────────────
function runMigrations() {
  const aplicada  = v => !!db.prepare('SELECT 1 FROM kore_migrations WHERE version=?').get(v);
  const registrar = (v, nombre) => {
    db.prepare('INSERT OR IGNORE INTO kore_migrations (version, nombre) VALUES (?,?)').run(v, nombre);
    console.log(`[Kore] ✓ Migración v${v} aplicada: ${nombre}`);
  };

  // ── v1: columnas adicionales en noticias + tabla prompts (pre-1.2)
  if (!aplicada(1)) {
    const cols = db.prepare('PRAGMA table_info(noticias)').all().map(r => r.name);
    for (const [col, tipo] of [
      ['alt_imagen',       'TEXT'],
      ['autor',            'TEXT'],
      ['youtube_id',       'TEXT'],
      ['meta_descripcion', 'TEXT'],
      ['palabras_clave',   'TEXT'],
      ['is_portada',       'INTEGER DEFAULT 0'],
      ['orden',            'INTEGER'],
      ['es_recomendado',   'INTEGER DEFAULT 0'],
    ]) {
      if (!cols.includes(col)) db.exec(`ALTER TABLE noticias ADD COLUMN ${col} ${tipo}`);
    }
    const tieneProm = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prompts'").get();
    if (!tieneProm) {
      db.exec(`CREATE TABLE prompts (id TEXT PRIMARY KEY, texto TEXT NOT NULL, actualizado TEXT DEFAULT (datetime('now')))`);
    }
    registrar(1, 'columnas noticias + tabla prompts');
  }

  // ── v2: columna vistas en noticias (analíticas por artículo)
  if (!aplicada(2)) {
    const cols = db.prepare('PRAGMA table_info(noticias)').all().map(r => r.name);
    if (!cols.includes('vistas')) db.exec('ALTER TABLE noticias ADD COLUMN vistas INTEGER DEFAULT 0');
    registrar(2, 'noticias.vistas — conteo de lecturas por artículo');
  }

  // ── v3: tabla contactos — formulario de contacto Motor
  if (!aplicada(3)) {
    db.exec(`CREATE TABLE IF NOT EXISTS contactos (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL, email TEXT NOT NULL,
      telefono TEXT, asunto TEXT, mensaje TEXT NOT NULL,
      ip TEXT, leido INTEGER DEFAULT 0, creado_en TEXT DEFAULT (datetime('now'))
    )`);
    registrar(3, 'tabla contactos — formulario de contacto Motor');
  }
}

// ══════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════

const loginAttempts = new Map();
function loginPermitido(ip) {
  const e = loginAttempts.get(ip);
  if (!e) return true;
  if (Date.now() - e.ts > 15 * 60 * 1000) { loginAttempts.delete(ip); return true; }
  return e.count < 5;
}
function registrarFallo(ip) {
  const e = loginAttempts.get(ip);
  if (!e || Date.now() - e.ts > 15 * 60 * 1000) loginAttempts.set(ip, { count: 1, ts: Date.now() });
  else e.count++;
}

function requireAuth(req, res, next) {
  if (req.session?.usuario) return next();
  if (req.path.includes('/api/') || req.xhr || req.headers.accept?.includes('application/json'))
    return res.status(401).json({ error: 'No autorizado' });
  res.redirect('/admin/login');
}
function requireKapitan(req, res, next) {
  if (req.session?.rol === 'superadmin') return next();
  res.status(403).json({ error: 'Acceso restringido al Kapitán' });
}
function requireAdmin(req, res, next) {
  if (['superadmin','admin'].includes(req.session?.rol)) return next();
  res.status(403).json({ error: 'Acceso restringido' });
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slugify(t) { return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s-]/g,'').trim().replace(/[\s_-]+/g,'-'); }
function kitActivo(id) { return db.prepare('SELECT valor FROM config WHERE clave=?').get(`kit_${id}`)?.valor === '1'; }

// ── Multer + Sharp
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10*1024*1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype))
});
async function procesarImagen(buf, dest, ancho=1200) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).webp({ quality: 82 }).resize(ancho, null, { withoutEnlargement: true }).toFile(dest);
}
async function procesarThumb(buf, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(buf).webp({ quality: 70 }).resize(400, 300, { fit:'cover' }).toFile(dest);
}

// ── Purga de imágenes huérfanas ──────────────────────────────────────────
// Elimina el archivo original y su thumbnail cuando se borra un registro.
// Solo actúa sobre rutas /uploads/ propias; ignora URLs externas.
function purgarImagen(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  try {
    const abs   = path.join(__dirname, url);
    const thumb = abs.replace(/(\.\w+)$/, '-thumb$1');
    if (fs.existsSync(abs))   fs.unlinkSync(abs);
    if (fs.existsSync(thumb)) fs.unlinkSync(thumb);
  } catch(e) { console.warn(`[Kore] purgarImagen: ${e.message}`); }
}

// ── Multer para archivos .zip (instalación de Kits y Kliks)
const uploadZip = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.zip') || name.endsWith('.kit.json') || name.endsWith('.json')) return cb(null, true);
    const ok = ['application/zip','application/x-zip-compressed','application/octet-stream','application/json','text/plain'].includes(file.mimetype);
    cb(null, ok);
  }
});

// ── Claude API (IA nativa — texto)
async function claudeCompletar(prompt) {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY no configurado');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 2500, messages: [{ role:'user', content: prompt }] })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ── Claude API (IA nativa — visión: imagen + texto)
async function claudeVision(imageBuffer, prompt) {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY no configurado');
  const resized = await sharp(imageBuffer)
    .resize(1200, null, { withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const b64 = resized.toString('base64');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

// ══════════════════════════════════════════════
//  EXPRESS + MIDDLEWARE
// ══════════════════════════════════════════════

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: 'ks', secret: SESSION_SECRET,
  maxAge: 8 * 60 * 60 * 1000,
  httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict'
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ══════════════════════════════════════════════
//  SETUP / INSTALACIÓN WEB (Kore 2.0)
//  Solo activo cuando KORE_INSTALLED !== 'true'
// ══════════════════════════════════════════════

// Rutas del instalador — siempre disponibles para no quedar bloqueado
app.get('/setup', (req, res) => {
  if (KORE_INSTALLED) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin', 'install.html'));
});

// Lista de Kliks disponibles (para el formulario del instalador)
app.get('/admin/api/setup/kliks', (req, res) => {
  if (KORE_INSTALLED) return res.status(403).json({ error: 'Ya instalado' });
  const kliksDir = path.join(__dirname, 'kliks');
  if (!fs.existsSync(kliksDir)) return res.json({ kliks: [] });
  const EXCLUIR = new Set(['historial']);
  const kliks = fs.readdirSync(kliksDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !EXCLUIR.has(d.name))
    .map(d => {
      try {
        const kj = JSON.parse(fs.readFileSync(path.join(kliksDir, d.name, 'klik.json'), 'utf8'));
        return { id: kj.id, nombre: kj.nombre, descripcion: kj.descripcion || '' };
      } catch { return null; }
    })
    .filter(Boolean);
  res.json({ kliks });
});

// Endpoint de instalación: recibe config, escribe .env, reinicia
app.post('/admin/api/setup', async (req, res) => {
  if (KORE_INSTALLED) return res.status(403).json({ error: 'Kore ya está instalado' });

  const { proyecto_nombre, proyecto_url, puerto,
          kapitan_usuario, kapitan_clave,
          claude_api_key, claude_modelo, klik_id } = req.body;

  // Validaciones básicas
  if (!proyecto_nombre?.trim())  return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
  if (!proyecto_url?.trim())     return res.status(400).json({ error: 'La URL pública es obligatoria' });
  if (!kapitan_usuario?.trim())  return res.status(400).json({ error: 'El usuario Kapitán es obligatorio' });
  if (!kapitan_clave || kapitan_clave.length < 8)
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });

  try {
    // Hash bcrypt del password
    const kapitan_hash = await bcrypt.hash(kapitan_clave, 10);

    // Leer .env actual para preservar SESSION_SECRET y otras variables
    const envPath    = path.join(__dirname, '.env');
    let   envActual  = '';
    try { envActual = fs.readFileSync(envPath, 'utf8'); } catch {}

    // Parsear variables existentes (preservar SESSION_SECRET si ya existe)
    const envLines = envActual.split('\n').filter(l => !l.startsWith('#') && l.includes('='));
    const envMap   = {};
    envLines.forEach(l => {
      const idx = l.indexOf('=');
      if (idx > 0) envMap[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
    });

    // Construir nuevo .env
    const nuevoEnv = [
      `# ── Generado por kInstall 2.0 — ${new Date().toISOString().slice(0,10)} ──`,
      ``,
      `KORE_INSTALLED=true`,
      ``,
      `PROJECT_NAME=${proyecto_nombre.trim()}`,
      `PROJECT_URL=${proyecto_url.trim().replace(/\/$/, '')}`,
      `PORT=${parseInt(puerto) || PORT}`,
      ``,
      `KAPITAN_USER=${kapitan_usuario.trim()}`,
      `KAPITAN_PASS=${kapitan_hash}`,
      ``,
      `SESSION_SECRET=${envMap.SESSION_SECRET || SESSION_SECRET}`,
      ``,
      `CLAUDE_API_KEY=${claude_api_key || ''}`,
      `CLAUDE_MODEL=${claude_modelo || 'claude-haiku-4-5-20251001'}`,
      ``,
      `DB_PATH=./db/database.sqlite`,
      `BACKUP_DIR=./db/backups`,
      ``,
      `VAPID_PUBLIC=${envMap.VAPID_PUBLIC || ''}`,
      `VAPID_PRIVATE=${envMap.VAPID_PRIVATE || ''}`,
      `TELEGRAM_TOKEN=${envMap.TELEGRAM_TOKEN || ''}`,
      `TELEGRAM_CHAT_ID=${envMap.TELEGRAM_CHAT_ID || ''}`,
      `GOOGLE_MAPS_KEY=${envMap.GOOGLE_MAPS_KEY || ''}`,
    ].join('\n');

    fs.writeFileSync(envPath, nuevoEnv, 'utf8');
    fs.chmodSync(envPath, 0o600);
    console.log('[Kore Setup] ✓ .env escrito con KORE_INSTALLED=true');

    // Activar Klik si se seleccionó uno
    if (klik_id) {
      try {
        const klikSrc  = path.join(__dirname, 'kliks', klik_id, 'index.html');
        const klikJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'kliks', klik_id, 'klik.json'), 'utf8'));
        const publicDir = path.join(__dirname, 'public');
        fs.mkdirSync(publicDir, { recursive: true });
        fs.copyFileSync(klikSrc, path.join(publicDir, 'index.html'));
        fs.writeFileSync(path.join(__dirname, 'kliks', 'aktivo.json'), JSON.stringify({
          id: klik_id, nombre: klikJson.nombre,
          version: klikJson.version || '1.0',
          activado_en: new Date().toISOString()
        }, null, 2), 'utf8');
        console.log(`[Kore Setup] ✓ Klik activado: ${klik_id}`);
      } catch(e) { console.warn(`[Kore Setup] ⚠ No se pudo activar el Klik: ${e.message}`); }
    }

    // Responder éxito y reiniciar el proceso (PM2 lo levanta de nuevo)
    res.json({ ok: true, mensaje: 'Instalación completada. El Motor se reiniciará.' });
    console.log('[Kore Setup] ✓ Instalación completada — reiniciando Motor…');
    setTimeout(() => process.exit(0), 800);

  } catch(e) {
    console.error(`[Kore Setup] ✕ ${e.message}`);
    res.status(500).json({ error: `Error interno: ${e.message}` });
  }
});

// Middleware: bloquear todo si no está instalado
app.use((req, res, next) => {
  if (!KORE_INSTALLED) {
    // Permitir solo rutas de setup
    if (req.path === '/setup' || req.path.startsWith('/admin/api/setup')) return next();
    return res.redirect('/setup');
  }
  next();
});

// ══════════════════════════════════════════════
//  AUTENTICACIÓN
// ══════════════════════════════════════════════

app.post('/admin/login', async (req, res) => {
  const ip = req.ip;
  if (!loginPermitido(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
  const { usuario, clave } = req.body;
  if (!usuario || !clave) return res.status(400).json({ error: 'Datos incompletos' });

  if (usuario === KAPITAN_USER) {
    if (await bcrypt.compare(clave, KAPITAN_PASS)) {
      loginAttempts.delete(ip);
      Object.assign(req.session, { usuario, nombre: 'Kapitán', rol: 'superadmin' });
      return res.json({ ok: true, rol: 'superadmin' });
    }
    registrarFallo(ip);
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const u = db.prepare('SELECT * FROM usuarios WHERE usuario=? AND activo=1').get(usuario);
  if (u && await bcrypt.compare(clave, u.clave_hash)) {
    loginAttempts.delete(ip);
    db.prepare("UPDATE usuarios SET ultimo_login=datetime('now') WHERE id=?").run(u.id);
    Object.assign(req.session, { usuario: u.usuario, nombre: u.nombre, rol: u.rol, uid: u.id });
    return res.json({ ok: true, rol: u.rol });
  }
  registrarFallo(ip);
  res.status(401).json({ error: 'Credenciales inválidas' });
});

app.post('/admin/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/admin/session', requireAuth, (req, res) => res.json({ usuario: req.session.usuario, nombre: req.session.nombre, rol: req.session.rol }));
app.get('/admin', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'admin', 'index.html')));
app.get('/admin/login', (req, res) => {
  if (req.session?.usuario) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// ══════════════════════════════════════════════
//  API — KITS NATIVOS
// ══════════════════════════════════════════════

// ── Tiers (siempre activo — sin toggle)
app.get('/api/tiers', (req, res) => res.json(db.prepare('SELECT * FROM tiers WHERE activo=1 ORDER BY orden').all()));
app.get('/admin/api/tiers', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM tiers ORDER BY orden').all()));
app.put('/admin/api/tiers/:id', requireKapitan, (req, res) => {
  const { nombre, precio, descripcion, color, activo } = req.body;
  db.prepare('UPDATE tiers SET nombre=?,precio=?,descripcion=?,color=?,activo=? WHERE id=?')
    .run(nombre, precio||0, descripcion, color, activo?1:0, req.params.id);
  res.json({ ok: true });
});

// ── Agenda
app.get('/api/agenda', (req, res) => {
  if (!kitActivo('agenda')) return res.status(404).json({ error: 'Kit inactivo' });
  res.json(db.prepare('SELECT * FROM agenda WHERE activo=1 ORDER BY fecha,hora_inicio').all());
});
app.get('/admin/api/agenda', requireAuth, (req, res) => {
  if (!kitActivo('agenda')) return res.status(404).end();
  const { fecha } = req.query;
  const q = fecha ? db.prepare('SELECT * FROM agenda WHERE fecha=? ORDER BY hora_inicio').all(fecha)
                  : db.prepare('SELECT * FROM agenda ORDER BY fecha,hora_inicio').all();
  res.json(q);
});
app.post('/admin/api/agenda', requireAdmin, (req, res) => {
  if (!kitActivo('agenda')) return res.status(404).end();
  const id = uid();
  const { titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado,activo,orden } = req.body;
  db.prepare('INSERT INTO agenda (id,titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado,activo,orden) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado?1:0,activo?1:0,orden||0);
  res.json({ ok:true, id });
});
app.patch('/admin/api/agenda/:id', requireAdmin, (req, res) => {
  const { titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado,activo,orden } = req.body;
  db.prepare("UPDATE agenda SET titulo=?,fecha=?,hora_inicio=?,hora_fin=?,duracion=?,tipo=?,lugar=?,descripcion=?,imagen_url=?,destacado=?,activo=?,orden=?,actualizado=datetime('now') WHERE id=?")
    .run(titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado?1:0,activo?1:0,orden||0,req.params.id);
  res.json({ ok:true });
});
app.put('/admin/api/agenda/:id', requireAdmin, (req, res) => {
  const { titulo,fecha,hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url,destacado,activo,orden } = req.body;
  db.prepare("UPDATE agenda SET titulo=?,fecha=?,hora_inicio=?,hora_fin=?,duracion=?,tipo=?,lugar=?,descripcion=?,imagen_url=?,destacado=?,activo=?,orden=?,actualizado=datetime('now') WHERE id=?")
    .run(titulo,fecha||'',hora_inicio,hora_fin,duracion,tipo,lugar,descripcion,imagen_url||null,destacado?1:0,activo?1:0,orden||0,req.params.id);
  res.json({ ok:true });
});
app.patch('/admin/api/agenda/:id/toggle', requireAdmin, (req, res) => {
  db.prepare("UPDATE agenda SET activo=((activo+1)%2),actualizado=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});
app.delete('/admin/api/agenda/:id', requireAdmin, (req, res) => { db.prepare('DELETE FROM agenda WHERE id=?').run(req.params.id); res.json({ ok:true }); });

// ── IA: Extraer datos de afiche → pre-rellenar formulario de agenda
app.post('/admin/api/agenda/extract-afiche', requireAdmin, upload.single('afiche'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  try {
    const prompt = `Analiza este afiche o imagen de evento y extrae todos los datos que puedas identificar.
Devuelve ÚNICAMENTE JSON válido (sin texto antes ni después, sin bloques de código) con estas claves exactas:
{
  "titulo": "nombre del evento (obligatorio)",
  "fecha": "fecha en formato YYYY-MM-DD. Si no ves el año, usa 2026",
  "hora_inicio": "hora de inicio en formato HH:MM (24h), o vacío si no aparece",
  "hora_fin": "hora de término en formato HH:MM (24h), o vacío si no aparece",
  "lugar": "nombre del lugar o dirección donde se realiza el evento, o vacío",
  "tipo": "una sola palabra de esta lista: ceremonia, seminario, charla, concierto, feria, teatro, deportes, otro",
  "descripcion": "descripción breve del evento en máximo 2 oraciones, o vacío"
}
Si un dato no aparece claramente en el afiche, deja ese campo como cadena vacía "".
No inventes datos que no estén visibles en la imagen.`;
    const respuesta = await claudeVision(req.file.buffer, prompt);
    const limpio = respuesta.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let datos;
    try { datos = JSON.parse(limpio); }
    catch { return res.status(500).json({ error: 'La IA no pudo leer el afiche. Intenta con una imagen más nítida.', raw: limpio.slice(0,300) }); }
    res.json({ ok: true, datos });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Noticias
app.get('/api/noticias', (req, res) => {
  if (!kitActivo('noticias')) return res.status(404).json({ error: 'Kit inactivo' });
  const { categoria } = req.query;
  const q = categoria ? db.prepare('SELECT * FROM noticias WHERE publicado=1 AND categoria=? ORDER BY CASE WHEN orden IS NULL THEN 1 ELSE 0 END, orden ASC, fecha_pub DESC').all(categoria)
                      : db.prepare('SELECT * FROM noticias WHERE publicado=1 ORDER BY CASE WHEN orden IS NULL THEN 1 ELSE 0 END, orden ASC, fecha_pub DESC').all();
  res.json(q);
});
app.get('/api/noticias/:slug', (req, res) => {
  if (!kitActivo('noticias')) return res.status(404).end();
  const n = db.prepare('SELECT * FROM noticias WHERE slug=? AND publicado=1').get(req.params.slug);
  if (!n) return res.status(404).json({ error: 'No encontrada' });
  // Incrementar vistas de forma atómica (no bloquea la respuesta)
  try { db.prepare('UPDATE noticias SET vistas=vistas+1 WHERE slug=?').run(req.params.slug); } catch {}
  res.json(n);
});
app.get('/admin/api/noticias', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM noticias ORDER BY CASE WHEN orden IS NULL THEN 1 ELSE 0 END, orden ASC, fecha_pub DESC').all()));
app.post('/admin/api/noticias', requireAdmin, (req, res) => {
  const id = uid();
  const { titulo, bajada, contenido, imagen_url, alt_imagen, categoria,
          autor, youtube_id, meta_descripcion, palabras_clave, publicado, fecha_pub,
          is_portada, orden, es_recomendado } = req.body;
  // El slug puede venir del body (generado por IA) o se genera desde el título
  const slugBase = req.body.slug ? req.body.slug : slugify(titulo);
  const slug = slugBase + '-' + id.slice(-4);
  if (is_portada == 1 || is_portada === '1') db.prepare('UPDATE noticias SET is_portada=0').run();
  db.prepare(`INSERT INTO noticias
    (id,titulo,slug,bajada,contenido,imagen_url,alt_imagen,categoria,autor,youtube_id,meta_descripcion,palabras_clave,publicado,fecha_pub,is_portada,orden,es_recomendado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, titulo, slug, bajada||null, contenido||null, imagen_url||null, alt_imagen||null,
         categoria||null, autor||null, youtube_id||null, meta_descripcion||null, palabras_clave||null,
         publicado?1:0, fecha_pub||null, is_portada?1:0, orden!=null?Number(orden):null,
         es_recomendado?1:0);
  res.json({ ok:true, id, slug });
});
app.patch('/admin/api/noticias/:id', requireAdmin, (req, res) => {
  const { titulo, bajada, contenido, imagen_url, alt_imagen, categoria,
          autor, youtube_id, meta_descripcion, palabras_clave, publicado, fecha_pub,
          is_portada, orden, es_recomendado } = req.body;
  if (is_portada == 1 || is_portada === '1') db.prepare('UPDATE noticias SET is_portada=0').run();
  db.prepare(`UPDATE noticias SET
    titulo=?,bajada=?,contenido=?,imagen_url=?,alt_imagen=?,categoria=?,
    autor=?,youtube_id=?,meta_descripcion=?,palabras_clave=?,
    publicado=?,fecha_pub=?,is_portada=?,orden=?,es_recomendado=?,actualizado=datetime('now') WHERE id=?`)
    .run(titulo, bajada||null, contenido||null, imagen_url||null, alt_imagen||null,
         categoria||null, autor||null, youtube_id||null, meta_descripcion||null, palabras_clave||null,
         publicado?1:0, fecha_pub||null, is_portada?1:0, orden!=null?Number(orden):null,
         es_recomendado?1:0, req.params.id);
  res.json({ ok:true });
});
app.put('/admin/api/noticias/:id', requireAdmin, (req, res) => {
  const { titulo, bajada, contenido, imagen_url, alt_imagen, categoria,
          autor, youtube_id, meta_descripcion, palabras_clave, publicado, fecha_pub,
          is_portada, orden, es_recomendado } = req.body;
  if (is_portada == 1 || is_portada === '1') db.prepare('UPDATE noticias SET is_portada=0').run();
  db.prepare(`UPDATE noticias SET
    titulo=?,bajada=?,contenido=?,imagen_url=?,alt_imagen=?,categoria=?,
    autor=?,youtube_id=?,meta_descripcion=?,palabras_clave=?,
    publicado=?,fecha_pub=?,is_portada=?,orden=?,es_recomendado=?,actualizado=datetime('now') WHERE id=?`)
    .run(titulo, bajada||null, contenido||null, imagen_url||null, alt_imagen||null,
         categoria||null, autor||null, youtube_id||null, meta_descripcion||null, palabras_clave||null,
         publicado?1:0, fecha_pub||null, is_portada?1:0, orden!=null?Number(orden):null,
         es_recomendado?1:0, req.params.id);
  res.json({ ok:true });
});
app.patch('/admin/api/noticias/:id/portada', requireAdmin, (req, res) => {
  const valor = parseInt(req.body.valor) || 0;
  if (valor === 1) db.prepare('UPDATE noticias SET is_portada=0').run();
  db.prepare("UPDATE noticias SET is_portada=?,actualizado=datetime('now') WHERE id=?").run(valor, req.params.id);
  res.json({ ok: true });
});
app.patch('/admin/api/noticias/:id/recomendado', requireAdmin, (req, res) => {
  const valor = parseInt(req.body.valor) || 0;
  db.prepare("UPDATE noticias SET es_recomendado=?,actualizado=datetime('now') WHERE id=?").run(valor, req.params.id);
  res.json({ ok: true });
});
app.patch('/admin/api/noticias/:id/orden', requireAdmin, (req, res) => {
  const orden = req.body.orden != null ? Number(req.body.orden) : null;
  db.prepare("UPDATE noticias SET orden=?,actualizado=datetime('now') WHERE id=?").run(orden, req.params.id);
  res.json({ ok: true });
});
app.patch('/admin/api/noticias/:id/toggle', requireAdmin, (req, res) => {
  db.prepare("UPDATE noticias SET publicado=((publicado+1)%2),actualizado=datetime('now') WHERE id=?").run(req.params.id);
  res.json({ ok:true });
});
app.delete('/admin/api/noticias/:id', requireAdmin, (req, res) => {
  const n = db.prepare('SELECT imagen_url FROM noticias WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM noticias WHERE id=?').run(req.params.id);
  if (n?.imagen_url) purgarImagen(n.imagen_url);
  res.json({ ok:true });
});

// ── Analíticas: top noticias por vistas (Kapitán y admin)
app.get('/admin/api/analytics/noticias', requireAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const top = db.prepare(`
    SELECT id, titulo, slug, categoria, vistas, fecha_pub, publicado
    FROM   noticias
    WHERE  publicado = 1
    ORDER  BY vistas DESC
    LIMIT  ?
  `).all(limit);
  const totalVistas = db.prepare('SELECT COALESCE(SUM(vistas),0) AS total FROM noticias WHERE publicado=1').get()?.total || 0;
  res.json({ top, totalVistas });
});
// ── Push Notifications
app.get('/api/push/vapid-public', (req, res) => {
  const key = process.env.VAPID_PUBLIC;
  if (!key) return res.status(404).json({ error: 'Push no configurado' });
  res.json({ publicKey: key });
});
app.post('/api/push/suscribir', (req, res) => {
  const sub = req.body;
  if (!sub?.endpoint) return res.status(400).json({ error: 'Suscripción inválida' });
  db.prepare('INSERT OR REPLACE INTO push_subs (id,endpoint,keys) VALUES (?,?,?)')
    .run(uid(), sub.endpoint, JSON.stringify(sub.keys || {}));
  res.json({ ok: true });
});

// ── Analytics (pageviews sin PII)
app.post('/api/analytics/pageview', (req, res) => {
  try {
    const { path: ruta, referrer } = req.body;
    if (ruta) db.prepare('INSERT INTO analytics (id,path,referrer) VALUES (?,?,?)')
      .run(uid(), String(ruta).slice(0,200), referrer ? String(referrer).slice(0,200) : null);
  } catch { /* silencioso */ }
  res.json({ ok: true });
});

// ── IA: sugerencias inline en formulario de noticias (bajada/titulo_seo)
app.post('/admin/api/noticias/ia', requireAdmin, async (req, res) => {
  try {
    const { titulo, contenido, tipo } = req.body;
    const prompts = {
      bajada: `Genera una bajada periodística de máximo 2 líneas para este artículo. Solo la bajada, sin comillas.\nTítulo: ${titulo}\nContenido: ${contenido?.slice(0,500)}`,
      titulo_seo: `Sugiere un título SEO optimizado (máximo 60 caracteres) para este artículo. Solo el título, sin comillas.\nTítulo original: ${titulo}`
    };
    const texto = await claudeCompletar(prompts[tipo] || prompts.bajada);
    res.json({ ok:true, texto });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── IA: Comunicados de prensa → noticia SEO-optimizada
// GET  /admin/api/prompts/comunicado  → devuelve el prompt actual (solo Kapitán)
// PUT  /admin/api/prompts/comunicado  → guarda prompt editado  (solo Kapitán)
// POST /admin/api/ai/comunicado       → procesa comunicado con el prompt activo
app.get('/admin/api/prompts/comunicado', requireKapitan, (req, res) => {
  const row = db.prepare("SELECT texto, actualizado FROM prompts WHERE id='comunicado_prensa'").get();
  if (!row) return res.status(404).json({ error: 'Prompt no encontrado' });
  res.json({ texto: row.texto, actualizado: row.actualizado });
});

app.put('/admin/api/prompts/comunicado', requireKapitan, (req, res) => {
  const { texto } = req.body;
  if (!texto || texto.trim().length < 50)
    return res.status(400).json({ error: 'El prompt es demasiado corto' });
  if (!texto.includes('{{texto}}'))
    return res.status(400).json({ error: 'El prompt debe incluir la variable {{texto}}' });
  db.prepare("INSERT INTO prompts (id,texto,actualizado) VALUES ('comunicado_prensa',?,datetime('now')) ON CONFLICT(id) DO UPDATE SET texto=excluded.texto, actualizado=excluded.actualizado")
    .run(texto.trim());
  res.json({ ok: true });
});

app.post('/admin/api/ai/comunicado', requireAdmin, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || texto.trim().length < 80)
      return res.status(400).json({ error: 'El comunicado parece muy corto' });

    // Leer prompt activo desde BD
    const row = db.prepare("SELECT texto FROM prompts WHERE id='comunicado_prensa'").get();
    if (!row) return res.status(500).json({ error: 'Prompt no configurado' });

    const prompt = row.texto.replace('{{texto}}', texto.trim());
    const respuesta = await claudeCompletar(prompt);

    // Limpiar respuesta: quitar bloques ```json ... ``` si Haiku los agrega
    const limpio = respuesta.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    let resultado;
    try {
      resultado = JSON.parse(limpio);
    } catch {
      return res.status(500).json({ error: 'La IA no devolvió JSON válido. Intenta de nuevo.', raw: limpio.slice(0,300) });
    }

    // Validar claves mínimas
    if (!resultado.titulo || !resultado.contenido)
      return res.status(500).json({ error: 'El JSON de la IA está incompleto', raw: limpio.slice(0,300) });

    res.json(resultado);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Banners
app.get('/api/banners', (req, res) => {
  if (!kitActivo('banners')) return res.status(404).json({ error: 'Kit inactivo' });
  const hoy = new Date().toISOString().slice(0,10);
  const { posicion } = req.query;
  let sql = 'SELECT * FROM banners WHERE activo=1 AND (fecha_inicio IS NULL OR fecha_inicio<=?) AND (fecha_fin IS NULL OR fecha_fin>=?) ORDER BY orden';
  const rows = db.prepare(sql).all(hoy,hoy);
  res.json(posicion ? rows.filter(b => b.posicion === posicion) : rows);
});
app.get('/admin/api/banners', requireAuth, (req, res) => res.json(db.prepare('SELECT * FROM banners ORDER BY orden').all()));
app.post('/admin/api/banners', requireAdmin, (req, res) => {
  const id = uid();
  const { nombre,imagen_url,link,posicion,activo,fecha_inicio,fecha_fin,orden } = req.body;
  db.prepare('INSERT INTO banners (id,nombre,imagen_url,link,posicion,activo,fecha_inicio,fecha_fin,orden) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id,nombre,imagen_url,link,posicion||'header',activo?1:0,fecha_inicio||null,fecha_fin||null,orden||0);
  res.json({ ok:true, id });
});
app.patch('/admin/api/banners/:id', requireAdmin, (req, res) => {
  const { nombre,imagen_url,link,posicion,activo,fecha_inicio,fecha_fin,orden } = req.body;
  db.prepare('UPDATE banners SET nombre=?,imagen_url=?,link=?,posicion=?,activo=?,fecha_inicio=?,fecha_fin=?,orden=? WHERE id=?')
    .run(nombre,imagen_url,link,posicion,activo?1:0,fecha_inicio||null,fecha_fin||null,orden||0,req.params.id);
  res.json({ ok:true });
});
app.patch('/admin/api/banners/:id/toggle', requireAdmin, (req, res) => {
  db.prepare('UPDATE banners SET activo=((activo+1)%2) WHERE id=?').run(req.params.id);
  res.json({ ok:true });
});
app.delete('/admin/api/banners/:id', requireAdmin, (req, res) => {
  const b = db.prepare('SELECT imagen_url FROM banners WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM banners WHERE id=?').run(req.params.id);
  if (b?.imagen_url) purgarImagen(b.imagen_url);
  res.json({ ok:true });
});

// ── Locales (ruta pública para el Klik Direktorio — requiere Kit 'locales' instalado y activo)
function kitLocalesActivo() {
  const instalado = db.prepare("SELECT activo FROM kits_instalados WHERE id='locales'").get();
  if (!instalado || !instalado.activo) return false;
  // Verificar que la tabla existe (por si el Motor aún no la creó)
  const existe = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='kit_locales'").get();
  return !!existe;
}
app.get('/api/locales', (req, res) => {
  if (!kitLocalesActivo()) return res.status(404).json({ error: 'Kit Locales no instalado o inactivo' });
  const { q, categoria, tier } = req.query;
  let filas = db.prepare('SELECT * FROM kit_locales WHERE activo=1 ORDER BY tier_id DESC, creado_en DESC').all();
  if (q) {
    const ql = q.toLowerCase();
    filas = filas.filter(f => ['titulo','descripcion','categoria'].some(c => String(f[c]||'').toLowerCase().includes(ql)));
  }
  if (categoria) filas = filas.filter(f => f.categoria === categoria);
  if (tier)      filas = filas.filter(f => f.tier_id === tier);
  res.json(filas);
});
app.get('/api/locales/:slug', (req, res) => {
  if (!kitLocalesActivo()) return res.status(404).json({ error: 'Kit Locales no instalado o inactivo' });
  const n = db.prepare('SELECT * FROM kit_locales WHERE slug=? AND activo=1').get(req.params.slug);
  n ? res.json(n) : res.status(404).json({ error: 'No encontrado' });
});

// ── Popup
app.get('/api/popup', (req, res) => {
  if (!kitActivo('popup')) return res.status(404).json({ error: 'Kit inactivo' });
  const p = db.prepare("SELECT * FROM popup WHERE id='popup' AND activo=1").get();
  p ? res.json(p) : res.json(null);
});
app.get('/admin/api/popup', requireAuth, (req, res) => res.json(db.prepare("SELECT * FROM popup WHERE id='popup'").get()));
app.put('/admin/api/popup', requireAdmin, (req, res) => {
  const { titulo,mensaje,tipo,imagen_url,boton_texto,boton_link,activo,frecuencia } = req.body;
  db.prepare("UPDATE popup SET titulo=?,mensaje=?,tipo=?,imagen_url=?,boton_texto=?,boton_link=?,activo=?,frecuencia=?,actualizado=datetime('now') WHERE id='popup'")
    .run(titulo,mensaje,tipo,imagen_url,boton_texto,boton_link,activo?1:0,frecuencia);
  res.json({ ok:true });
});

// ── Contactos — formulario público + gestión admin
const _contactRate = new Map();
function contactPermitido(ip) {
  const e = _contactRate.get(ip);
  const ahora = Date.now();
  if (!e || ahora - e.ts > 60 * 60 * 1000) { _contactRate.set(ip, { count: 1, ts: ahora }); return true; }
  if (e.count >= 5) return false;
  e.count++;
  return true;
}

app.post('/api/contacto', (req, res) => {
  const ip = req.ip;
  if (!contactPermitido(ip)) return res.status(429).json({ error: 'Demasiados envíos. Intenta más tarde.' });
  const { nombre, email, telefono, asunto, mensaje, website } = req.body;
  if (website) return res.json({ ok: true }); // honeypot — bot silenciado
  if (!nombre?.trim() || !email?.trim() || !mensaje?.trim())
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return res.status(400).json({ error: 'Email inválido' });
  const id = uid();
  db.prepare('INSERT INTO contactos (id,nombre,email,telefono,asunto,mensaje,ip) VALUES (?,?,?,?,?,?,?)')
    .run(id, nombre.trim(), email.trim(), telefono?.trim()||null, asunto?.trim()||null, mensaje.trim(), ip);
  res.json({ ok: true });
});

app.get('/admin/api/contactos', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM contactos ORDER BY creado_en DESC').all());
});
app.patch('/admin/api/contactos/:id/leido', requireAdmin, (req, res) => {
  db.prepare('UPDATE contactos SET leido=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
app.delete('/admin/api/contactos/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM contactos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Usuarios (solo Kapitán)
app.get('/admin/api/usuarios', requireKapitan, (req, res) => res.json(db.prepare('SELECT id,nombre,usuario,rol,activo,creado_en,ultimo_login FROM usuarios').all()));
app.post('/admin/api/usuarios', requireKapitan, async (req, res) => {
  const { nombre,usuario,clave,rol } = req.body;
  if (!['admin','editor'].includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
  const existe = db.prepare('SELECT id FROM usuarios WHERE usuario=?').get(usuario);
  if (existe) return res.status(409).json({ error: 'Usuario ya existe' });
  const id = uid();
  const clave_hash = await bcrypt.hash(clave, 10);
  db.prepare('INSERT INTO usuarios (id,nombre,usuario,clave_hash,rol) VALUES (?,?,?,?,?)').run(id,nombre,usuario,clave_hash,rol);
  res.json({ ok:true, id });
});
app.patch('/admin/api/usuarios/:id', requireKapitan, async (req, res) => {
  const { nombre,rol,activo,clave } = req.body;
  if (clave) {
    const h = await bcrypt.hash(clave, 10);
    db.prepare('UPDATE usuarios SET nombre=?,rol=?,activo=?,clave_hash=? WHERE id=?').run(nombre,rol,activo?1:0,h,req.params.id);
  } else {
    db.prepare('UPDATE usuarios SET nombre=?,rol=?,activo=? WHERE id=?').run(nombre,rol,activo?1:0,req.params.id);
  }
  res.json({ ok:true });
});
app.delete('/admin/api/usuarios/:id', requireKapitan, (req, res) => { db.prepare('DELETE FROM usuarios WHERE id=?').run(req.params.id); res.json({ ok:true }); });

// ── Config sistema (solo Kapitán)
app.get('/admin/api/config', requireKapitan, (req, res) => {
  const rows = db.prepare('SELECT * FROM config').all();
  const cfg  = Object.fromEntries(rows.map(r => [r.clave, r.valor]));
  // proyecto_nombre y proyecto_url: prioridad tabla config → fallback .env
  res.json({
    ...cfg,
    project_name:     cfg.proyecto_nombre || PROJECT_NAME,
    project_url:      cfg.proyecto_url    || PROJECT_URL,
    proyecto_nombre:  cfg.proyecto_nombre || PROJECT_NAME,
    proyecto_url:     cfg.proyecto_url    || PROJECT_URL,
  });
});
app.put('/admin/api/config', requireKapitan, (req, res) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO config (clave,valor) VALUES (?,?)');
  const tx = db.transaction(updates => { for (const [k,v] of updates) stmt.run(k,v); });

  const updates = [];

  // Toggles de Kits nativos → se guardan como '1' / '0'
  const togglesKit = ['kit_agenda','kit_noticias','kit_banners','kit_popup','kit_notificaciones','kit_telegram'];
  for (const k of togglesKit) {
    if (req.body[k] !== undefined) updates.push([k, req.body[k] ? '1' : '0']);
  }

  // Datos generales del proyecto → se guardan como texto plano
  const camposGenerales = ['proyecto_nombre','proyecto_url'];
  for (const k of camposGenerales) {
    if (req.body[k] !== undefined) updates.push([k, String(req.body[k]).trim()]);
  }

  tx(updates);
  res.json({ ok:true });
});

// ── kconfig (Kliks → Identidad)
app.get('/api/config/klik', (req, res) => {
  const rows = db.prepare('SELECT * FROM kconfig').all();
  if (!rows.length) return res.json({});
  try { res.json(JSON.parse(rows.find(r=>r.clave==='json')?.valor || '{}')); }
  catch(e) { res.json(Object.fromEntries(rows.map(r=>[r.clave,r.valor]))); }
});
app.put('/admin/api/kconfig', requireKapitan, async (req, res) => {
  const data = { ...req.body };

  // ── Resolver títulos de YouTube server-side (una sola vez al guardar) ──
  // El cliente recibe youtube_titles junto con youtube_ids en /api/config/klik
  // y nunca necesita contactar a noembed.com ni ningún tercero.
  if (Array.isArray(data.youtube_ids) && data.youtube_ids.length) {
    const extractId = url => {
      const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?\n]+)/);
      return m ? m[1] : url.trim();
    };
    const cleanIds = data.youtube_ids.map(extractId).filter(Boolean);
    try {
      data.youtube_titles = await Promise.all(cleanIds.map(async id => {
        try {
          const r = await fetch(
            `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (!r.ok) return '';
          const d = await r.json();
          return d.title || '';
        } catch { return ''; }
      }));
    } catch { data.youtube_titles = cleanIds.map(() => ''); }
  }

  db.prepare('INSERT OR REPLACE INTO kconfig (clave,valor) VALUES (?,?)').run('json', JSON.stringify(data));
  res.json({ ok:true });
});

// GET /admin/api/kconfig/schema → kconfig_schema del Klik activo (leído desde klik.json)
app.get('/admin/api/kconfig/schema', requireKapitan, (req, res) => {
  const kliksDir = path.join(__dirname, 'kliks');
  try {
    const aktivo  = JSON.parse(fs.readFileSync(path.join(kliksDir, 'aktivo.json'), 'utf8'));
    const klikJson = JSON.parse(fs.readFileSync(path.join(kliksDir, aktivo.id, 'klik.json'), 'utf8'));
    res.json({ schema: klikJson.kconfig_schema || [], klik: { id: aktivo.id, nombre: aktivo.nombre, version: aktivo.version } });
  } catch(e) {
    res.json({ schema: [], klik: null });
  }
});

// ── Upload de imágenes
app.post('/admin/api/upload', requireAdmin, upload.single('imagen'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió imagen' });
  const { tipo = 'misc', id = uid() } = req.body;
  const nombre   = `${id}.webp`;
  const thumbNom = `${id}-thumb.webp`;
  const destDir  = path.join(__dirname, 'uploads', tipo);
  try {
    fs.mkdirSync(destDir, { recursive: true });
    await procesarImagen(req.file.buffer, path.join(destDir, nombre));
    await procesarThumb(req.file.buffer,  path.join(destDir, thumbNom));
    res.json({ ok:true, url: `/uploads/${tipo}/${nombre}`, thumb: `/uploads/${tipo}/${thumbNom}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════
//  OG PROXY — Noticias compartibles en redes sociales
// ══════════════════════════════════════════════

const BOT_UA = /facebookexternalhit|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Discordbot/i;

app.get('/noticia/:slug', (req, res) => {
  if (!BOT_UA.test(req.headers['user-agent'] || '')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  const n = db.prepare('SELECT * FROM noticias WHERE slug=? AND publicado=1').get(req.params.slug);
  if (!n) return res.status(404).send('No encontrado');
  res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>${esc(n.titulo)}</title>
<meta name="description" content="${esc(n.bajada)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(n.titulo)}">
<meta property="og:description" content="${esc(n.bajada)}">
<meta property="og:image" content="${esc(n.imagen_url)}">
<meta property="og:url" content="${PROJECT_URL}/noticia/${n.slug}">
<meta property="og:site_name" content="${esc(PROJECT_NAME)}">
<meta property="og:locale" content="es_CL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(n.titulo)}">
<meta name="twitter:description" content="${esc(n.bajada)}">
<meta name="twitter:image" content="${esc(n.imagen_url)}">
</head><body></body></html>`);
});

// ══════════════════════════════════════════════
//  INSTALACIÓN DE KITS — desde kAdmin (zip o .kit.json)
// ══════════════════════════════════════════════

// GET  /admin/api/kits               → lista Kits instalados
// POST /admin/api/kits/install       → instala Kit desde .zip o .kit.json
// PATCH /admin/api/kits/:id/toggle   → activa / desactiva un Kit instalado

app.get('/admin/api/kits', requireAuth, (req, res) => {
  const kits = db.prepare('SELECT * FROM kits_instalados ORDER BY instalado_en DESC').all();
  const kitsDir = path.join(__dirname, 'kits');
  const enriched = kits.map(k => {
    try {
      const kitJson = JSON.parse(fs.readFileSync(path.join(kitsDir, `${k.id}.kit.json`), 'utf8'));
      return { ...k, campos: kitJson.campos || [], titulo: kitJson.nombre || k.nombre };
    } catch { return { ...k, titulo: k.nombre }; }
  });
  res.json(enriched);
});

app.post('/admin/api/kits/install', requireKapitan, uploadZip.single('archivo'), (req, res) => {
  console.log('[Kore DEBUG] Kit upload - file:', !!req.file, '- content-type:', req.headers['content-type'], '- body keys:', Object.keys(req.body||{}));
  if (!req.file) {
    console.log('[Kore DEBUG] req.file es null/undefined. Posible causa: multer no procesó el archivo.');
    return res.status(400).json({ error: 'No se recibió archivo. Verifica logs del Motor.' });
  }
  const kitsDir = path.join(__dirname, 'kits');
  fs.mkdirSync(kitsDir, { recursive: true });

  let kitJson;
  try {
    const ext = req.file.originalname.toLowerCase();
    if (ext.endsWith('.kit.json') || ext.endsWith('.json')) {
      // Subida directa de .kit.json
      kitJson = JSON.parse(req.file.buffer.toString('utf8'));
    } else {
      // Extraer del .zip
      const zip = new AdmZip(req.file.buffer);
      const entry = zip.getEntries().find(e => e.entryName.endsWith('.kit.json'));
      if (!entry) return res.status(400).json({ error: 'El zip no contiene ningún archivo .kit.json' });
      kitJson = JSON.parse(entry.getData().toString('utf8'));
    }
  } catch(e) {
    return res.status(400).json({ error: `JSON inválido: ${e.message}` });
  }

  if (!kitJson.id || !kitJson.nombre || !Array.isArray(kitJson.campos)) {
    return res.status(400).json({ error: 'Kit inválido: faltan id, nombre o campos' });
  }

  // Guardar en /kits/
  const destKit = path.join(kitsDir, `${kitJson.id}.kit.json`);
  fs.writeFileSync(destKit, JSON.stringify(kitJson, null, 2), 'utf8');

  // Registrar en BD
  db.prepare(`
    INSERT INTO kits_instalados (id, nombre, version, icono, descripcion, activo)
    VALUES (?, ?, ?, ?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      nombre=excluded.nombre, version=excluded.version,
      icono=excluded.icono, descripcion=excluded.descripcion,
      instalado_en=datetime('now')
  `).run(kitJson.id, kitJson.nombre, kitJson.version || '1.0',
         kitJson.icono || null, kitJson.descripcion || null);

  console.log(`[Kore] \u2713 Kit instalado: ${kitJson.nombre} (${kitJson.id})`);
  res.json({ ok: true, id: kitJson.id, nombre: kitJson.nombre,
             mensaje: 'Kit instalado. Reinicia el Motor para activar.' });
});

app.patch('/admin/api/kits/:id/toggle', requireKapitan, (req, res) => {
  db.prepare('UPDATE kits_instalados SET activo=((activo+1)%2) WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/admin/api/kits/:id', requireKapitan, (req, res) => {
  db.prepare('DELETE FROM kits_instalados WHERE id=?').run(req.params.id);
  // Opcional: eliminar el .kit.json del disco
  try {
    const f = path.join(__dirname, 'kits', `${req.params.id}.kit.json`);
    if (fs.existsSync(f)) fs.unlinkSync(f);
  } catch {}
  res.json({ ok: true });
});

// ══════════════════════════════════════════════
//  INSTALACIÓN DE KLIKS — desde kAdmin (.zip)
// ══════════════════════════════════════════════

// GET  /admin/api/kliks              → lista Kliks en historial
// POST /admin/api/kliks/install      → instala Klik desde .zip
// POST /admin/api/kliks/:id/activar  → activa un Klik instalado

app.get('/admin/api/kliks', requireKapitan, (req, res) => {
  const kliksDir  = path.join(__dirname, 'kliks');
  const EXCLUIR   = new Set(['historial']);
  if (!fs.existsSync(kliksDir)) return res.json({ kliks: [], aktivo: null, sin_registro: false });

  // Leer aktivo.json — fuente de verdad única
  let aktivoId     = null;
  let sin_registro = false;
  try {
    const ak = JSON.parse(fs.readFileSync(path.join(kliksDir, 'aktivo.json'), 'utf8'));
    aktivoId = ak.id || null;
  } catch {
    // aktivo.json no existe: instalación manual o primera vez
    sin_registro = true;
  }

  const kliks = fs.readdirSync(kliksDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !EXCLUIR.has(d.name))
    .map(d => {
      try {
        const kj = JSON.parse(fs.readFileSync(path.join(kliksDir, d.name, 'klik.json'), 'utf8'));
        return { ...kj, _folder: d.name, aktivo: kj.id === aktivoId };
      } catch { return null; }
    })
    .filter(Boolean);

  res.json({ kliks, aktivo: aktivoId, sin_registro });
});

// Marcar un Klik como activo sin reemplazar /public/index.html
// Útil cuando el Klik ya está desplegado manualmente y solo falta registrarlo
app.post('/admin/api/kliks/:id/marcar-activo', requireKapitan, (req, res) => {
  const id      = req.params.id;
  const kliksDir = path.join(__dirname, 'kliks');
  const srcJson  = path.join(kliksDir, id, 'klik.json');
  if (!fs.existsSync(srcJson)) return res.status(404).json({ error: `Klik "${id}" no encontrado` });

  const klikJson = JSON.parse(fs.readFileSync(srcJson, 'utf8'));
  fs.writeFileSync(path.join(kliksDir, 'aktivo.json'), JSON.stringify({
    id:          klikJson.id,
    nombre:      klikJson.nombre,
    version:     klikJson.version || '1.0',
    activado_en: new Date().toISOString()
  }, null, 2), 'utf8');

  console.log(`[Kore] ✓ Klik marcado como activo: ${klikJson.nombre} (${klikJson.id})`);
  res.json({ ok: true, id: klikJson.id, nombre: klikJson.nombre });
});

app.post('/admin/api/kliks/install', requireKapitan, uploadZip.single('archivo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  let klikJson, indexHtml;
  try {
    const zip = new AdmZip(req.file.buffer);
    const jsonEntry  = zip.getEntries().find(e => path.basename(e.entryName) === 'klik.json' && !e.isDirectory);
    const indexEntry = zip.getEntries().find(e => path.basename(e.entryName) === 'index.html' && !e.isDirectory);
    if (!jsonEntry)  return res.status(400).json({ error: 'El zip no contiene klik.json' });
    if (!indexEntry) return res.status(400).json({ error: 'El zip no contiene index.html' });
    klikJson  = JSON.parse(jsonEntry.getData().toString('utf8'));
    indexHtml = indexEntry.getData().toString('utf8');
  } catch(e) {
    return res.status(400).json({ error: `Error leyendo zip: ${e.message}` });
  }

  if (!klikJson.id || !klikJson.nombre) {
    return res.status(400).json({ error: 'klik.json debe tener id y nombre' });
  }

  // Guardar directamente en /kliks/[id]/
  const destDir = path.join(__dirname, 'kliks', klikJson.id);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, 'klik.json'),  JSON.stringify(klikJson, null, 2), 'utf8');
  fs.writeFileSync(path.join(destDir, 'index.html'), indexHtml, 'utf8');

  console.log(`[Kore] ✓ Klik instalado: ${klikJson.nombre} (${klikJson.id})`);
  res.json({ ok: true, id: klikJson.id, nombre: klikJson.nombre });
});

app.post('/admin/api/kliks/:id/activar', requireKapitan, (req, res) => {
  const id      = req.params.id;
  const srcDir  = path.join(__dirname, 'kliks', id);
  const srcJson = path.join(srcDir, 'klik.json');
  const srcHtml = path.join(srcDir, 'index.html');

  if (!fs.existsSync(srcJson) || !fs.existsSync(srcHtml)) {
    return res.status(404).json({ error: `Klik "${id}" no encontrado en /kliks/` });
  }

  const klikJson = JSON.parse(fs.readFileSync(srcJson, 'utf8'));

  // Copiar index.html al public (el Klik activo)
  const publicDir = path.join(__dirname, 'public');
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(srcHtml, path.join(publicDir, 'index.html'));

  // Actualizar aktivo.json
  const aktivoPath = path.join(__dirname, 'kliks', 'aktivo.json');
  fs.writeFileSync(aktivoPath, JSON.stringify({
    id:          klikJson.id,
    nombre:      klikJson.nombre,
    version:     klikJson.version || '1.0',
    activado_en: new Date().toISOString()
  }, null, 2), 'utf8');

  // Invalidar caché del Klik en memoria
  _klik.mtime = 0;

  console.log(`[Kore] ✓ Klik activado: ${klikJson.nombre} (${klikJson.id})`);
  res.json({ ok: true, id: klikJson.id, nombre: klikJson.nombre });
});

// ══════════════════════════════════════════════
//  MOTOR DE KITS — Rutas dinámicas desde .kit.json
// ══════════════════════════════════════════════

const TIPO_SQL = { texto:'TEXT', textarea:'TEXT', url:'TEXT', richtext:'TEXT', numero:'INTEGER',
  precio:'INTEGER', toggle:'INTEGER DEFAULT 0', date:'TEXT', datetime:'TEXT', select:'TEXT',
  select_dinamico:'TEXT', color:'TEXT', coordenadas:'TEXT', imagen_upload:'TEXT', tags:'TEXT' };

function cargarKits() {
  const kitsDir = path.join(__dirname, 'kits');
  if (!fs.existsSync(kitsDir)) return;

  const archivos = fs.readdirSync(kitsDir).filter(f => f.endsWith('.kit.json'));
  for (const archivo of archivos) {
    try {
      const kit = JSON.parse(fs.readFileSync(path.join(kitsDir, archivo), 'utf8'));
      if (!kit.id || !kit.campos) continue;

      const instalado = db.prepare('SELECT activo FROM kits_instalados WHERE id=?').get(kit.id);
      if (!instalado || !instalado.activo) continue;

      // ── Migraciones ──
      if (Array.isArray(kit.migraciones)) {
        const versionActual = db.prepare(
          `SELECT valor FROM kconfig WHERE clave=?`
        ).get(`kit_${kit.id}_version`)?.valor || '0';
        for (const mig of kit.migraciones) {
          if (String(mig.version) > String(versionActual)) {
            try {
              db.exec(mig.sql);
              db.prepare('INSERT OR REPLACE INTO kconfig (clave, valor) VALUES (?, ?)').run(
                `kit_${kit.id}_version`, String(mig.version));
              console.log(`[Kore]   \u21b3 Migraci\u00f3n aplicada: ${kit.id} v${mig.version}`);
            } catch (e) { console.error(`[Kore]   \u2715 Error migraci\u00f3n ${kit.id} v${mig.version}: ${e.message}`); }
          }
        }
      }

      // ── Tabla ──
      const cols = kit.campos.filter(c => (c.nombre||c.id) !== 'id').map(c => `${c.nombre||c.id} ${TIPO_SQL[c.tipo] || 'TEXT'}`).join(', ');
      db.exec(`CREATE TABLE IF NOT EXISTS kit_${kit.id} (id TEXT PRIMARY KEY, ${cols}, creado_en TEXT DEFAULT (datetime('now')), actualizado TEXT DEFAULT (datetime('now')))`);

      const base = `/api/kit/${kit.id}`;

      // ── Rutas CRUD ──
      app.get(base, (req, res) => {
        const { q } = req.query;
        let filas = db.prepare(`SELECT * FROM kit_${kit.id} ORDER BY ${kit.ordenar_por || 'creado_en'} DESC`).all();
        if (q && kit.busqueda_en?.length) {
          const ql = q.toLowerCase();
          filas = filas.filter(f => kit.busqueda_en.some(campo => String(f[campo]||'').toLowerCase().includes(ql)));
        }
        res.json(filas);
      });

      app.get(`${base}/:id`, (req, res) => {
        const f = db.prepare(`SELECT * FROM kit_${kit.id} WHERE id=?`).get(req.params.id);
        f ? res.json(f) : res.status(404).json({ error: 'No encontrado' });
      });

      app.post(base, requireAdmin, (req, res) => {
        const id = uid();
        const campos = kit.campos.map(c => c.nombre||c.id);
        const vals   = campos.map(c => req.body[c] ?? null);
        db.prepare(`INSERT INTO kit_${kit.id} (id,${campos.join(',')}) VALUES (?,${campos.map(()=>'?').join(',')})`).run(id, ...vals);
        res.json({ ok:true, id });
      });

      app.patch(`${base}/:id`, requireAdmin, (req, res) => {
        const campos = kit.campos.map(c => c.nombre||c.id);
        const sets   = campos.map(c => `${c}=?`).join(',');
        const vals   = campos.map(c => req.body[c] ?? null);
        db.prepare(`UPDATE kit_${kit.id} SET ${sets},actualizado=datetime('now') WHERE id=?`).run(...vals, req.params.id);
        res.json({ ok:true });
      });

      app.patch(`${base}/:id/toggle`, requireAdmin, (req, res) => {
        db.prepare(`UPDATE kit_${kit.id} SET activo=((activo+1)%2),actualizado=datetime('now') WHERE id=?`).run(req.params.id);
        res.json({ ok:true });
      });

      app.delete(`${base}/:id`, requireKapitan, (req, res) => {
        db.prepare(`DELETE FROM kit_${kit.id} WHERE id=?`).run(req.params.id);
        res.json({ ok:true });
      });

      console.log(`[Kore] Kit cargado: ${kit.nombre} (${kit.id})`);
    } catch(e) {
      console.error(`[Kore] Error cargando kit ${archivo}: ${e.message}`);
    }
  }
}


// ══════════════════════════════════════════════
//  ARCHIVOS ESTÁTICOS + SPA catch-all
// ══════════════════════════════════════════════

// KUSTOMIZER IA - Customizacion de diseño con IA

function sanitizeCSS(css) {
  if (!css) return '';
  let clean = String(css);
  clean = clean.replace(/@import\s+[^;]+;?/gi, '');
  clean = clean.replace(/@charset\s+[^;]+;?/gi, '');
  clean = clean.replace(/expression\s*\(/gi, '(');
  clean = clean.replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(');
  clean = clean.replace(/(body|html)\s*\{[^}]*position\s*:\s*fixed[^}]*\}/gi, (m) =>
    m.replace(/position\s*:\s*fixed/gi, 'position: relative'));
  if (clean.length > 51200) clean = clean.slice(0, 51200) + '\n/* CSS truncado por limite de tamano */';
  return clean.trim();
}

function extractKlikCSS(html) {
  if (!html) return '';
  const styles = [];
  const regex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) { styles.push(match[1]); }
  return styles.join('\n\n');
}

function extractKlikStructure(html) {
  if (!html) return { classes: [], ids: [] };
  const classes = new Set();
  const ids = new Set();
  const classRegex = /class\s*=\s*['"]([^'"]+)['"]/gi;
  let m;
  while ((m = classRegex.exec(html)) !== null) {
    m[1].split(/\s+/).forEach(c => { if (c.length > 2) classes.add(c); });
  }
  const idRegex = /id\s*=\s*['"]([^'"]+)['"]/gi;
  while ((m = idRegex.exec(html)) !== null) {
    if (m[1].length > 2) ids.add(m[1]);
  }
  return { classes: Array.from(classes).slice(0, 100), ids: Array.from(ids).slice(0, 30) };
}

app.get('/admin/api/kustomizations', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM kustomizations ORDER BY creado_en DESC').all());
});

app.get('/api/kustomizations/css', (req, res) => {
  const rows = db.prepare('SELECT css_overrides FROM kustomizations WHERE activo=1 ORDER BY creado_en DESC').all();
  const css = rows.map(r => r.css_overrides || '').filter(Boolean).join('\n\n');
  res.type('text/css').send(css || '/* Sin kustomizaciones activas */');
});

app.post('/admin/api/ai/kustomize', requireAdmin, async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || prompt.trim().length < 5)
      return res.status(400).json({ error: 'Describe que cambio quieres hacer' });

    const klikHtmlContent = klikHtml();
    if (!klikHtmlContent)
      return res.status(400).json({ error: 'No hay Klik activo. Activa un Klik primero.' });

    const currentCSS = extractKlikCSS(klikHtmlContent);
    const structure = extractKlikStructure(klikHtmlContent);

    const kconfigRows = db.prepare('SELECT * FROM kconfig').all();
    let kconfig = {};
    try { kconfig = JSON.parse(kconfigRows.find(r => r.clave === 'json')?.valor || '{}'); }
    catch { kconfig = Object.fromEntries(kconfigRows.map(r => [r.clave, r.valor])); }

    const activeOverrides = db.prepare('SELECT css_overrides FROM kustomizations WHERE activo=1 ORDER BY creado_en DESC').all();
    const currentOverrides = activeOverrides.map(r => r.css_overrides || '').filter(Boolean).join('\n\n');

    const iaPrompt = `Eres un diseniador web experto en CSS. El usuario quiere personalizar el diseno de su sitio web (un Klik de Kore Framework).

SOLICITUD DEL USUARIO:
${prompt.trim()}

CONTEXTO DEL SITIO:
- Clases CSS disponibles: ${structure.classes.join(', ')}
- IDs principales: ${structure.ids.join(', ')}
- Colores actuales: accent=${kconfig.accent || '#00BFFF'}, accent2=${kconfig.accent2 || '#0099CC'}
- Nombre del sitio: ${kconfig.nombre || PROJECT_NAME}

CSS ACTUAL DEL KLIK (referencia, no lo repitas, solo crea overrides):
${currentCSS.slice(0, 3000)}

${currentOverrides ? `KUSTOMIZACIONES CSS ACTIVAS (respeta estos cambios y construye sobre ellos):\n${currentOverrides.slice(0, 3000)}\n` : ''}

REGLAS:
1. Genera UNICAMENTE CSS valido (sin HTML, sin JavaScript, sin explicaciones)
2. Usa selectores especificos basados en las clases e IDs del sitio
3. No uses !important a menos que sea estrictamente necesario
4. Manten el CSS limpio y organizado con comentarios breves
5. Respeta la accesibilidad (contraste, tamanos minimos)
6. No rompas la estructura responsive del sitio
7. Si el usuario pide algo que requiere cambios estructurales (no solo CSS), explica brevemente al final en un comentario /* NOTA: ... */

Devuelve UNICAMENTE el codigo CSS, sin texto antes ni despues, sin bloques de codigo markdown:`;

    const respuesta = await claudeCompletar(iaPrompt);
    const cssLimpio = sanitizeCSS(respuesta.trim().replace(/^```(?:css)?\s*/i, '').replace(/\s*```$/, ''));

    if (!cssLimpio || cssLimpio.length < 10)
      return res.status(500).json({ error: 'La IA no genero CSS valido. Intenta con una descripcion mas especifica.' });

    let explanation = '';
    const notaMatch = cssLimpio.match(/\/\*\s*NOTA:\s*([\s\S]*?)\*\//i);
    if (notaMatch) explanation = notaMatch[1].trim();

    const id = uid();
    db.prepare('INSERT INTO kustomizations (id, prompt, css_overrides, explanation, status, activo) VALUES (?,?,?,?,?,0)')
      .run(id, prompt.trim(), cssLimpio, explanation, 'preview');

    console.log(`[Kore] Kustomizacion generada: ${id} (${prompt.trim().slice(0, 50)}...)`);
    res.json({ ok: true, id, css: cssLimpio, explanation });
  } catch (e) {
    console.error(`[Kore] Error kustomize: ${e.message}`);
    res.status(500).json({ error: e.message });
  }
});

app.patch('/admin/api/kustomizations/:id/apply', requireKapitan, (req, res) => {
  const row = db.prepare('SELECT id FROM kustomizations WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Kustomizacion no encontrada' });
  db.prepare("UPDATE kustomizations SET activo=1, status='applied', aplicado_en=datetime('now') WHERE id=?")
    .run(req.params.id);
  _klik.mtime = 0;
  console.log(`[Kore] Kustomizacion aplicada: ${req.params.id}`);
  res.json({ ok: true });
});

app.patch('/admin/api/kustomizations/:id/revert', requireKapitan, (req, res) => {
  const row = db.prepare('SELECT id FROM kustomizations WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Kustomizacion no encontrada' });
  db.prepare("UPDATE kustomizations SET activo=0, status='reverted' WHERE id=?")
    .run(req.params.id);
  _klik.mtime = 0;
  console.log(`[Kore] Kustomizacion revertida: ${req.params.id}`);
  res.json({ ok: true });
});

app.delete('/admin/api/kustomizations/:id', requireKapitan, (req, res) => {
  db.prepare('DELETE FROM kustomizations WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

// -- Cache del Klik HTML en memoria (se invalida si cambia el archivo) --
const _klik = { html: null, mtime: 0, path: path.join(__dirname, 'public', 'index.html') };
function klikHtml() {
  try {
    const mtime = fs.statSync(_klik.path).mtimeMs;
    if (mtime !== _klik.mtime) {
      _klik.html  = fs.readFileSync(_klik.path, 'utf8');
      _klik.mtime = mtime;
    }
    return _klik.html;
  } catch { return null; }
}

// ── Escaper HTML seguro para SSR ──
function eh(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// SPA routing: todas las rutas no-API sirven el Klik
// En la ruta raíz (/): inyecta el hero server-side para mejorar LCP → score PageSpeed 80+
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin')) {
    return res.status(404).json({ error: 'No encontrado' });
  }

  let html = klikHtml();
  if (!html) return res.status(404).send('Klik no instalado');

  // Inyectar CSS de kustomizaciones activas (kustomizer IA)
  try {
    const kRows = db.prepare('SELECT css_overrides FROM kustomizations WHERE activo=1 ORDER BY creado_en DESC').all();
    if (kRows.length) {
      const kustomCSS = kRows.map(r => r.css_overrides || '').filter(Boolean).join('\n\n');
      if (kustomCSS) {
        html = html.replace('</head>', `<style id="kore-kustomizations">\n${kustomCSS}\n</style>\n</head>`);
      }
    }
  } catch { /* sin kustomizaciones */ }

  // SSR parcial del hero — solo en la portada (/)
  if (req.path === '/') {
    try {
      const portada = db.prepare(`
        SELECT titulo, slug, bajada, imagen_url, categoria
        FROM   noticias
        WHERE  publicado = 1
        ORDER  BY CASE WHEN is_portada = 1 THEN 0 ELSE 1 END, fecha_pub DESC
        LIMIT  1
      `).get();

      if (portada?.imagen_url) {
        // HTML del hero — usa <a href> para funcionar antes de que JS cargue (progressive enhancement)
        // Cuando JS hidrata y llama renderizarHero(), reemplaza este contenido automáticamente
        const heroHtml = `<a class="hero-full-wrap" href="/noticia/${eh(portada.slug)}" ` +
               `style="text-decoration:none;display:block">` +
          `<img class="hero-full-img" src="${eh(portada.imagen_url)}" alt="${eh(portada.titulo)}" ` +
               `loading="eager" fetchpriority="high" decoding="async">` +
          `<div class="hero-full-gradient"></div>` +
          `<div class="hero-full-content">` +
            `<div class="hero-full-badge">${eh(portada.categoria || 'Noticia')}</div>` +
            `<h2 class="hero-full-titulo">${eh(portada.titulo)}</h2>` +
            `<p class="hero-full-bajada">${eh(portada.bajada || '')}</p>` +
          `</div>` +
        `</a>`;

        // Preload de la imagen hero: el browser la descarga con el HTML, no después del JS
        const preload = `<link rel="preload" as="image" href="${eh(portada.imagen_url)}" fetchpriority="high">`;

        const out = html
          .replace('</head>', `${preload}\n</head>`)
          .replace('<div id="hero-principal"></div>', `<div id="hero-principal">${heroHtml}</div>`);

        return res.type('html').send(out);
      }
    } catch (_) { /* Si falla el SSR, cae al sendFile normal */ }
  }

  res.type('html').send(html);
});

// ══════════════════════════════════════════════
//  ARRANQUE
// ══════════════════════════════════════════════

initDB();
runMigrations();
cargarKits();

const server = app.listen(PORT, () => {
  console.log(`[Kore] ✓ ${PROJECT_NAME} corriendo en puerto ${PORT}`);
  console.log(`[Kore]   kAdmin → http://localhost:${PORT}/admin`);
});

// Graceful shutdown (señales PM2)
function shutdown(signal) {
  console.log(`[Kore] ${signal} recibido — cerrando servidor...`);
  server.close(() => { db.close(); console.log('[Kore] Servidor cerrado.'); process.exit(0); });
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
