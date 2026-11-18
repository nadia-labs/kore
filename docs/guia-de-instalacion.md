# 🚀 Guía de Instalación Definitiva — Kore 2.1

## ⚠️ ANTES DE EMPEZAR — Lee esto completo

Esta guía te llevará paso a paso desde cero hasta tener Kore funcionando **sin errores**.

---

## 📋 Requisitos Previos

### 1. Servidor VPS/Cloud
- **Sistema operativo:** Ubuntu 22.04 LTS o superior
- **RAM mínima:** 1GB (recomendado 2GB)
- **Espacio:** 10GB libres
- **Acceso:** SSH con usuario sudo

### 2. Dominio Configurado
- ✅ **Tienes un dominio:** `tudominio.com`
- ✅ **DNS apuntando a tu servidor:** Registro A → IP del servidor
- ✅ **Tiempo de propagación:** Espera 5-30 minutos tras configurar DNS

**Verificar DNS desde tu Mac:**
```bash
ping tudominio.com
# Debe responder con la IP de tu servidor, NO 127.0.0.1
```

### 3. Permisos
- Usuario con acceso `sudo`
- Puerto 80 y 443 abiertos en el firewall

---

## 🎯 Instalación en 3 Pasos

### PASO 1: Conectar al Servidor

```bash
ssh usuario@tu-servidor-ip
# o
ssh usuario@tudominio.com
```

---

### PASO 2: Ejecutar kInstall

**Un solo comando:**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/nadia-labs/kore/main/kinstall.sh)
```

**El instalador te preguntará:**

1. **Dominio** (ej: `misitio.cl`)
   - ❌ NO escribas `https://`
   - ❌ NO escribas `www.`
   - ✅ Solo: `misitio.cl`

2. **Puerto del Motor** (default: `3001`)
   - Presiona Enter para usar el default

3. **¿Instalar SSL ahora?** (`s/N`)
   - Si tu DNS ya está activo: escribe `s`
   - Si aún no: escribe `N` (podrás hacerlo después)

4. **Email para Let's Encrypt** (si elegiste SSL)
   - Tu email real para notificaciones de renovación

**El script instalará:**
- ✅ Node.js 20 LTS
- ✅ PM2 (process manager)
- ✅ Nginx (proxy inverso)
- ✅ Certbot (SSL, si lo elegiste)
- ✅ Motor Kore desde GitHub
- ✅ Dependencias npm

**Tiempo estimado:** 3-5 minutos

---

### PASO 3: Completar Instalación Web

Una vez que kInstall termine exitosamente, verás:

```
══════════════════════════════════════════════
  ✓  Kore instalado — Motor corriendo        
══════════════════════════════════════════════

  ┌──────────────────────────────────────────┐
  │  SIGUIENTE PASO — Abre en tu navegador: │
  │                                          │
  │    https://tudominio.com/setup          │
  │                                          │
  │  Configura: nombre, Kapitán,             │
  │  Claude API Key y selecciona tu Klik.    │
  └──────────────────────────────────────────┘
```

**⚠️ IMPORTANTE:**

- ❌ **NO** abras `http://localhost:3001/setup` (NO funcionará)
- ✅ **SÍ** abre `https://tudominio.com/setup` (tu dominio real)

**En Safari/Chrome, abre:**

```
https://tudominio.com/setup
```

**Formulario de setup (4 campos):**

1. **Nombre del proyecto** — Ej: "CP Comunicaciones"
2. **Kapitán (usuario admin)** — Ej: "admin"
3. **Contraseña Kapitán** — Mínimo 8 caracteres
4. **(Opcional) Claude API Key** — Para funciones IA

5. **Selecciona un Klik** (opcional)
   - Mediatiko (sitio de noticias)
   - Direktorio (listado de empresas)
   - Korporativo (sitio corporativo)

**Presiona "Completar instalación"**

El Motor se reiniciará automáticamente (toma 5 segundos).

---

### ✅ PASO 4: Acceder a kAdmin

Una vez reiniciado el Motor:

```
https://tudominio.com/admin
```

**Login:**
- Usuario: el que elegiste en "Kapitán"
- Contraseña: la que elegiste

---

## 🔍 Verificación Post-Instalación

### 1. Ver el Sitio Público

Desde kAdmin, haz clic en el botón **"Ver el Sitio"** (header, arriba a la derecha).

O abre directamente:
```
https://tudominio.com/
```

### 2. Verificar que el Motor está corriendo

En el servidor (SSH):

```bash
pm2 status
# Debe mostrar tu app en estado "online"

pm2 logs tudominio-com --lines 20
# Ver últimos logs (no debe haber errores)
```

### 3. Verificar Nginx

```bash
sudo systemctl status nginx
# Debe estar "active (running)"

sudo nginx -t
# Debe decir "test is successful"
```

---

## 🚨 Troubleshooting

### Error: "Safari no puede abrir localhost:3003"

**Causa:** Estás intentando acceder desde tu Mac a una URL localhost, pero Kore está en un servidor remoto.

**Solución:** Usa tu dominio real:
```
https://tudominio.com/setup
```

### Error: 429 Too Many Requests

**Causa:** Rate limiting de nginx muy restrictivo (versión antigua).

**Solución:** Ya está corregido en v2.1+. Si instalaste una versión anterior:

```bash
# En el servidor:
sudo nano /etc/nginx/sites-available/tu-app

# Busca y cambia:
# rate=5r/m → rate=10r/s
# burst=3 → burst=20

sudo nginx -t && sudo nginx -s reload
```

### Error: ERR_CONNECTION_REFUSED

**Posibles causas:**

1. **DNS no propagado** — Espera 30 min y reintenta
2. **Motor no corriendo:**
   ```bash
   pm2 restart tu-app
   pm2 logs
   ```
3. **Firewall bloqueando:**
   ```bash
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw status
   ```

### Error: 502 Bad Gateway

**Causa:** Nginx no puede conectarse al Motor.

**Solución:**
```bash
# Verificar que el Motor esté corriendo
pm2 status

# Ver logs del Motor
pm2 logs tu-app --lines 50

# Reiniciar Motor
pm2 restart tu-app
```

### Error: SSL no funciona (NET::ERR_CERT_AUTHORITY_INVALID)

**Causa:** No instalaste SSL o Certbot falló.

**Solución:**
```bash
# Instalar Certbot si no lo tienes
sudo apt-get install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tudominio.com

# Debe completar sin errores
```

### Error: "KORE_INSTALLED no definido" al reiniciar

**Causa:** El archivo `.env` no se actualizó correctamente.

**Solución:**
```bash
cd /var/www/tu-app
cat .env | grep KORE_INSTALLED
# Debe mostrar: KORE_INSTALLED=true

# Si no, editar:
nano .env
# Cambiar: KORE_INSTALLED=true

pm2 restart tu-app
```

---

## 📊 Comandos Útiles Post-Instalación

### Ver estado del sistema

```bash
# Estado de PM2
pm2 status

# Logs en tiempo real
pm2 logs tu-app

# Estadísticas de recursos
pm2 monit

# Reiniciar Motor
pm2 restart tu-app

# Estado de Nginx
sudo systemctl status nginx
```

### Backup manual de la base de datos

```bash
cd /var/www/tu-app
node backup.js
```

### Ver configuración actual

```bash
cat /var/www/tu-app/.env
```

### Renovar SSL (se hace automáticamente, pero puedes forzarlo)

```bash
sudo certbot renew --dry-run
```

---

## 🎨 Siguientes Pasos

Una vez que kAdmin esté funcionando:

### 1. Personalizar Identidad del Klik
- **kAdmin → kCostumizer**
- Cambia logos, colores, tipografías
- Con IA: describe tu marca y deja que Claude genere el CSS

### 2. Crear Contenido
- **Noticias:** Agrega artículos manualmente o con IA (Comunicados)
- **Agenda:** Programa eventos (puedes leer afiches con IA)
- **Banners:** Sube publicidad

### 3. Activar Kits Adicionales
- **kAdmin → Configuración → Kits nativos**
- Activa Push Notifications, Telegram, etc.

### 4. Instalar Kits Externos
- Descarga kits desde [kore.nadia.cl](https://kore.nadia.cl)
- **kAdmin → Kits → + Instalar nuevo**

---

## 📞 Soporte

Si después de seguir esta guía sigues teniendo problemas:

1. **Revisa logs:**
   ```bash
   pm2 logs tu-app --lines 100
   sudo tail -f /var/log/nginx/error.log
   ```

2. **Reporta el issue:**
   - GitHub: [nadia-labs/kore/issues](https://github.com/nadia-labs/kore/issues)
   - Incluye: sistema operativo, logs, pasos que seguiste

---

## ✅ Checklist de Instalación Exitosa

- [ ] DNS configurado y verificado (`ping tudominio.com`)
- [ ] kInstall completado sin errores
- [ ] SSL instalado (candado verde en el navegador)
- [ ] `/setup` completado y Motor reiniciado
- [ ] Login en `/admin` exitoso
- [ ] "Ver el Sitio" muestra el Klik público
- [ ] `pm2 status` muestra app "online"
- [ ] `sudo nginx -t` sin errores

**Si todos los checks están ✅, tu instalación es exitosa.**

---

**Kore 2.1** · nadIA Labs · [nadialabs.cl](https://nadialabs.cl)

> *"WordPress killer en Node.js — sin la complejidad"*
