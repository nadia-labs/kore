// ══════════════════════════════════════════════
//  KORE APP 2.0 — Configuración PM2
//  Gestión de procesos: Motor + Backup
// ══════════════════════════════════════════════

require('dotenv').config();

const PROJECT = process.env.PROJECT_NAME || 'kore-app';
const PORT    = process.env.PORT          || 3001;

module.exports = {
  apps: [

    // ── Proceso 1: Motor principal
    {
      name:             PROJECT,
      script:           'server.js',
      instances:        1,
      exec_mode:        'fork',
      watch:            false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT:     PORT
      },
      error_file:  `./logs/${PROJECT}-error.log`,
      out_file:    `./logs/${PROJECT}-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      restart_delay:   3000,
      max_restarts:    10
    },

    // ── Proceso 2: Backup nocturno (03:00 hora Chile)
    {
      name:         `${PROJECT}-backup`,
      script:       'backup.js',
      cron_restart: '0 3 * * *',
      watch:        false,
      autorestart:  false,
      env: {
        NODE_ENV: 'production'
      },
      error_file: `./logs/${PROJECT}-backup-error.log`,
      out_file:   `./logs/${PROJECT}-backup-out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },

  ]
};
