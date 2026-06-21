// ══════════════════════════════════════════════
//  KORE APP 2.0 — Proceso de backup de SQLite
//  Ejecutado por PM2 vía cron (03:00 diario)
//  También puede correrse manualmente:
//    node backup.js
// ══════════════════════════════════════════════

'use strict';

require('dotenv').config();

const fs       = require('fs');
const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH    = process.env.DB_PATH    || path.join(__dirname, 'db', 'database.sqlite');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, 'db', 'backups');
const MAX_BACKUPS = 7;

async function runBackup() {
  const inicio = Date.now();
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[Kore Backup] ✕ Base de datos no encontrada: ${DB_PATH}`);
    process.exit(1);
  }
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const fecha   = new Date().toISOString().slice(0, 10);
  const destino = path.join(BACKUP_DIR, `database-${fecha}.sqlite`);

  let db;
  try {
    db = new Database(DB_PATH, { readonly: true });
    await db.backup(destino);
    console.log(`[Kore Backup] ✓ ${path.basename(destino)} — ${Date.now() - inicio}ms`);
  } catch (err) {
    console.error(`[Kore Backup] ✕ ${err.message}`);
    process.exit(1);
  } finally {
    if (db) db.close();
  }

  try {
    const archivos = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
      .sort();
    const sobrantes = archivos.length - MAX_BACKUPS;
    if (sobrantes > 0) {
      archivos.slice(0, sobrantes).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f));
        console.log(`[Kore Backup] Eliminado: ${f}`);
      });
    }
  } catch (err) {
    console.error(`[Kore Backup] ✕ Error limpiando backups: ${err.message}`);
  }
}

runBackup();
