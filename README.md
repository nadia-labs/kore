# KORE — Web App Framework

> **Kore: sitios y apps web livianos, seguros y autoadministrables, con IA integrada, para pequeños negocios, emprendedores y organizaciones.**
>
> Kore es un framework chileno de código abierto, ya desarrollado y en producción, para crear sitios y aplicaciones web que el propio dueño administra desde su teléfono, sin PHP, sin plugins que ejecutan código y con un consumo de servidor mínimo. · [kore.nadialabs.cl](https://kore.nadialabs.cl)

[![Kore](https://img.shields.io/badge/Kore-2.0-00C8FF?style=flat-square)](https://github.com/nadia-labs/kore)
[![Node](https://img.shields.io/badge/Node.js-≥20-339933?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue?style=flat-square)](./LICENSE)

**English:** Kore: lightweight, secure, self-managed websites and web apps with built-in AI, for small businesses, entrepreneurs and organizations. It's an open-source framework from Chile, already running in production, that owners manage from their phone — no PHP, no plugins running code, and under 110 MB of memory per app. Documentation is currently in Spanish; English docs are on the roadmap. Contributions welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Para quién es

- **Pequeños negocios y comercios:** una pastelería con su catálogo de tortas y un botón de WhatsApp para encargar.
- **Emprendedores:** un taller que publica sus servicios y precios, y los cambia desde el teléfono.
- **Clubes, asociaciones, juntas de vecinos y fundaciones:** horarios de entrenamiento, avisos o el registro de socios.
- **Medios locales y organizadores de eventos:** un medio digital de la ciudad, o la agenda y el mapa de una feria.
- **Desarrolladores y agencias** que hacen sitios para pymes y necesitan entregar algo que el cliente administre solo.

## Por qué Kore

**1. Los gestores de contenido tradicionales tienen un problema de arquitectura, no de edad.** WordPress (2003), Joomla (2005) y Drupal (2001) usan PHP, una base de datos MySQL aparte y plugins que ejecutan código con todos los permisos del sitio. El 21 de octubre de 2026, PHP publicó parches de emergencia para PHP2Shell (CVE-2026-109618 y CVE-2026-109619, CVSS 9,2): ejecución de código en el servidor sin autenticarse, en el propio PHP, incluso en un "Hola mundo"; actualizar WordPress no lo corrige. CybelAngel contó 2,24 millones de servidores PHP expuestos, el 59% en versiones que ya no reciben actualizaciones oficiales, y días después PHP avisó de una tercera vía (CVE-2026-115560), corregida el 19 de noviembre. Patchstack registró 11.334 vulnerabilidades en el ecosistema WordPress en 2025. El dueño de una panadería no puede defenderse de una falla en el lenguaje de programación; lo único que puede hacer es no depender de él. ([The Hacker News](https://thehackernews.com/2026/10/php-issues-emergency-patches-for-two.html) · [CybelAngel](https://cybelangel.com/blog/critical-php-rce-vulnerabilities-cve-2026-109618-and-cve-2026-109619/) · [php.net](https://www.php.net/archive/2026.php) · [Patchstack](https://patchstack.com/whitepaper/state-of-wordpress-security-in-2026/))

**2. "Hoy cualquiera hace una web con IA": cierto, y ese es el punto.** Lovable, Bolt, v0, Replit o Base44 generan sitios a partir de una descripción. Si cualquiera puede crear un sitio, la pregunta es quién lo mantiene seguro y al día: lo que la IA genera desde cero es código nuevo en cada proyecto, que nadie revisa, rara vez trae un panel para el dueño y no se actualiza solo. Con Kore, el sitio o la app se hace con IA, pero con un marco seguro y autogestionable: la IA arma Kits (configuración, no código) sobre un núcleo probado que se actualiza para todos.

**3. Un negocio pequeño no necesita un WordPress completo. Necesita cuatro cosas:**

| Lo que necesita | Cómo lo resuelve Kore |
|---|---|
| Administrarlo solo | kAdmin desde el teléfono |
| Que no lo hackeen | Sin PHP, Kits sin código: superficie de ataque mínima |
| Gastar poco en servidor | Menos de 110 MB de memoria por app |
| Crecer cuando lo necesite | Agregar un Kit, no rehacer el sitio |

## Prueba en producción

Diez sitios y apps reales funcionan en tres servidores gratuitos de 1 GB. Medición del 22 de noviembre de 2026, en servidores gratuitos de Oracle Cloud de 1 GB (956 MB). Cada app de Kore usa menos de 110 MB de memoria.

| Servidor | Sitios y apps de Kore | Memoria disponible |
|---|---|---|
| Servidor 1 | RadarBencina, Transfiereme, nadialabs.cl, kore.nadialabs.cl | 372 MB de 956 MB |
| Servidor 2 | RadarFarma, ExpoNav, MentorIA | 351 MB de 956 MB |
| Servidor 3 | RadarNocturno, Timeline, CP Comunicaciones | 364 MB de 956 MB |

## Hecho con Kore

[RadarNocturno](https://radarnocturno.cl) · [RadarBencina](https://radarbencina.cl) · [RadarFarma](https://radarfarma.cl) · [Transfiereme](https://transfiereme.cl) · [ExpoNav](https://exponav.nadialabs.cl) · [Timeline](https://timeline.nadialabs.cl) · [MentorIA](https://mentoria.nadialabs.cl) · [nadialabs.cl](https://nadialabs.cl) · [CP Comunicaciones](https://cpcomunicaciones.nadialabs.cl)

## Hoja de ruta

Planificado, todavía no disponible: Kore Cloud (crear un sitio en minutos sin servidor propio) · instalador gráfico · kAdmin 3.0 · generador de apps con IA a partir de una descripción · auditoría de seguridad externa · medición pública de rendimiento frente a un CMS tradicional.

---

## ¿Qué es Kore?

Kore combina un stack minimalista (Node + Express + SQLite) con IA integrada (Claude, de Anthropic) para generar contenido y personalizar el diseño, y un panel que el dueño usa desde el teléfono.

### Características principales

- **Motor liviano**: Node.js 20 + Express 4 + SQLite WAL. Sin MySQL, sin PHP, sin Redis. Menos de 110 MB de memoria por app.
- **IA integrada**: Claude convierte comunicados en artículos, extrae datos de imágenes y ajusta el diseño en lenguaje natural.
- **Sistema de Kliks**: Plantillas de frontend intercambiables (Mediatiko, Direktorio, Korporativo).
- **Sistema de Kits**: Extensiones de datos con CRUD automático desde JSON, sin código ejecutable.
- **kAdmin responsive**: Panel de administración mobile-first con bottom nav.
- **PWA-ready**: Push notifications, OG proxy para redes sociales, SSR parcial del hero.
- **Instalación en 1 comando**: `kinstall.sh` configura Node, PM2, Nginx y SSL.
- **kustomizer IA**: Personalización del diseño mediante lenguaje natural.

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

## 📚 Instalación

### 🚀 **[Ver Guía de Instalación Definitiva →](./docs/guia-de-instalacion.md)**

**Instalación en 3 pasos (3-5 minutos):**

```bash
# 1. Conectar al servidor VPS
ssh usuario@tu-servidor

# 2. Ejecutar instalador automático
bash <(curl -fsSL https://raw.githubusercontent.com/nadia-labs/kore/main/kinstall.sh)

# 3. Abrir en navegador (usa TU DOMINIO, no localhost)
https://tudominio.com/setup
```

**⚠️ Problemas comunes ya solucionados en v2.1:**
- ✅ Error 429 "Too Many Requests" → Corregido
- ✅ Confusión localhost vs servidor remoto → Documentado
- ✅ Rate limiting nginx → Optimizado

**📖 [Troubleshooting completo en la guía](./docs/guia-de-instalacion.md#-troubleshooting)**

---

### Instalación local (desarrollo)

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
│   └── korporativo/       # Klik para sitios de empresa
├── kits/                  # Definiciones de Kits (.kit.json)
├── docs/                  # Guía de instalación y troubleshooting
├── kinstall.sh            # Instalador de servidor
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

**Solución:** Actualizar configuración de Nginx a `rate=10r/s` y `burst=20`. Ver detalles completos en [docs/troubleshooting/error-429.md](./docs/troubleshooting/error-429.md).

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

Kore es software de código abierto bajo la [Licencia Apache 2.0](./LICENSE). Puedes usarlo, modificarlo y distribuirlo, también con fines comerciales, conservando los avisos de copyright y el archivo [NOTICE](./NOTICE).

La licencia no concede derechos sobre las marcas "Kore", "kAdmin", "Klik", "Kit" ni el logo K, que pertenecen a nadIA Comunicaciones SpA.

Para reportar vulnerabilidades, lee [SECURITY.md](./SECURITY.md). Para contribuir, lee [CONTRIBUTING.md](./CONTRIBUTING.md).

---

**Kore Framework** · [nadIA Labs](https://nadialabs.cl) · contacto@nadialabs.cl
