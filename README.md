# KORE — Web App Framework

> Framework ligero para construir web apps y PWAs con IA integrada. Node.js + Express + SQLite. Sin WordPress, sin bloat.

[![Kore](https://img.shields.io/badge/Kore-2.0-00C8FF?style=flat-square)](https://github.com/nadia-labs/kore)
[![Node](https://img.shields.io/badge/Node.js-≥20-339933?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-UNLICENSED-red?style=flat-square)]()

---

## ¿Qué es Kore?

Kore es un framework CMS/PWA que combina la liviandad de un stack minimalista (Node + Express + SQLite) con la potencia de la IA (Claude/Anthropic) para generar contenido y personalizar el diseño.

### Características principales

- **Motor ultraligero**: Node.js 20 + Express 4 + SQLite WAL. Sin MySQL, sin PHP, sin Redis.
- **IA nativa**: Claude API integrada para procesamiento de comunicados de prensa, extracción de datos de imágenes y customización de diseño.
- **Sistema de Kliks**: Plantillas de frontend intercambiables (Mediatiko, Direktorio, Korporativo).
- **Sistema de Kits**: Extensiones de datos con CRUD automático desde JSON schema.
- **kAdmin responsive**: Panel de administración mobile-first con bottom nav.
- **PWA-ready**: Push notifications, OG proxy para redes sociales, SSR parcial del hero.
- **Instalación en 1 comando**: `kinstall.sh` configura Node, PM2, Nginx y SSL.
- **kustomizer IA**: Customización del diseño mediante lenguaje natural.

## Stack tecnológico

| Componente | Tecnología |
|------------|-----------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 4 |
| Base de datos | SQLite (better-sqlite3, modo WAL) |
| Process manager | PM2 |
| Reverse proxy | Nginx |
| IA | Claude API (Anthropic) |
| Imágenes | Sharp (WebP automático) |
| Auth | bcrypt + cookie-session |
| Uploads | Multer (memory storage) |

## Instalación rápida

### Opción 1: Script automático (recomendado para producción)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/nadia-labs/kore/main/kinstall.sh)
```

El script instala Node.js 20, PM2, Nginx, descarga el Motor y configura todo. Luego visita:

```
https://tu-dominio.cl/setup
```

### Opción 2: Manual (desarrollo)

```bash
git clone https://github.com/nadia-labs/kore.git
cd kore
npm install
cp .env.example .env  # editar variables
npm run dev
```

Visita `http://localhost:3001/setup` para completar la instalación web.

## Estructura del proyecto

```
kore/
├── server.js              # Entry point del Motor
├── admin/                 # kAdmin (panel de administración)
│   ├── index.html         # kAdmin 2.0
│   ├── install.html       # Instalador web (4 pasos)
│   └── login.html         # Login
├── kliks/                 # Plantillas de frontend
│   ├── mediatiko/         # Klik para medios de noticias
│   ├── direktorio/        # Klik para directorios
│   └── korporativo/       # Klik para sitios corporativos
├── kits/                  # Definiciones de Kits (.kit.json)
├── scripts/
│   ├── kinstall.sh        # Instalador de servidor
│   └── deploy-timeline.sh # Deploy script
├── ecosystem.config.js    # Configuración PM2
├── backup.js              # Backup automático de DB
├── nginx.conf.template    # Template de configuración Nginx
└── package.json
```

## Conceptos clave

### Klik
Plantilla de frontend (HTML + CSS + JS) que define la apariencia del sitio público. Se activa una a la vez. Cada Klik incluye un `klik.json` con su configuración, endpoints y schema de personalización.

### Kit
Extensión de datos con CRUD automático. Se define mediante un archivo `.kit.json` que especifica campos, tipos y migraciones. El Motor genera las rutas API y la tabla automáticamente.

### Kapitán
Superadministrador único de la instalación. Se configura durante la instalación y tiene acceso a todas las funciones del sistema.

## Variables de entorno

| Variable | Descripción | Requerido |
|----------|-------------|-----------|
| `KORE_INSTALLED` | `true` cuando la instalación está completa | Sí |
| `PROJECT_NAME` | Nombre del proyecto | Sí |
| `PROJECT_URL` | URL pública del sitio | Sí |
| `PORT` | Puerto del Motor (default: 3001) | Sí |
| `KAPITAN_USER` | Usuario superadmin | Sí (post-install) |
| `KAPITAN_PASS` | Hash bcrypt del password | Sí (post-install) |
| `SESSION_SECRET` | Secreto de sesión | Sí |
| `CLAUDE_API_KEY` | API key de Anthropic | No |
| `CLAUDE_MODEL` | Modelo de Claude a usar | No |
| `DB_PATH` | Ruta de la base de datos SQLite | No |
| `VAPID_PUBLIC` | Llave pública para push notifications | No |
| `VAPID_PRIVATE` | Llave privada para push notifications | No |

## Scripts disponibles

```bash
npm start          # Iniciar Motor en producción
npm run dev        # Desarrollo con auto-reload (--watch)
npm run backup     # Backup manual de la base de datos
```

## API

### Endpoints públicos
- `GET /api/noticias` — Listar noticias publicadas
- `GET /api/noticias/:slug` — Noticia por slug
- `GET /api/agenda` — Eventos activos
- `GET /api/banners` — Banners activos
- `GET /api/popup` — Popup activo
- `GET /api/tiers` — Tiers/planes
- `GET /api/config/klik` — Configuración del Klik activo
- `POST /api/contacto` — Formulario de contacto
- `POST /api/analytics/pageview` — Analytics

### Endpoints de administración
- `POST /admin/login` — Autenticación
- `GET/POST/PUT/PATCH/DELETE /admin/api/*` — CRUD de cada módulo
- `POST /admin/api/ai/comunicado` — Procesar comunicado con IA
- `POST /admin/api/agenda/extract-afiche` — Extraer datos de afiche con IA
- `POST /admin/api/upload` — Subir imágenes (WebP automático)
- `GET/POST /admin/api/kliks/*` — Gestión de Kliks
- `GET/POST /admin/api/kits/*` — Gestión de Kits

## Troubleshooting

### Error 429 "Too Many Requests" al abrir /admin

**Problema:** Al intentar acceder al panel de administración aparece el error 429.

**Causa:** Configuración restrictiva del rate limiting en Nginx (versión anterior: `rate=5r/m`).

**Solución:** Actualizar configuración de Nginx a `rate=10r/s` y `burst=20`. Ver detalles completos en [SOLUCION-429.md](./SOLUCION-429.md).

**Fix rápido en servidor activo:**
```bash
sudo nano /etc/nginx/sites-available/tu-app
# Cambiar: rate=5r/m → rate=10r/s
# Cambiar: burst=3 → burst=20
sudo nginx -t && sudo nginx -s reload
```

✅ **Resuelto en v2.1+** — Las nuevas instalaciones ya incluyen la configuración corregida.

---

## Licencia

UNLICENSED — Propiedad de nadIA Labs.

---

**Kore Framework** · [nadIA Labs](https://nadia.cl) · hola@nadia.cl
