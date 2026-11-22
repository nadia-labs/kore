# 🚨 Diagnóstico Error 502 Bad Gateway

## ¿Qué significa?

**502 Bad Gateway** = Nginx funciona ✅ pero **no puede conectarse al Motor Node.js** ❌

## Comandos de Diagnóstico

Ejecuta estos comandos **por SSH en el servidor** (reemplaza con tus datos):

```bash
# Conectar al servidor
ssh usuario@servidor-ip

# 1. Verificar estado de PM2
pm2 status

# 2. Ver logs del Motor (últimas 50 líneas)
pm2 logs tu-app --lines 50 --nostream

# 3. Verificar puerto en .env
cat /var/www/tu-app/.env | grep PORT

# 4. Verificar configuración de Nginx
cat /etc/nginx/sites-available/tu-app | grep proxy_pass

# 5. Test de conectividad interna
curl http://localhost:3001/admin
# Si responde HTML → Motor funciona, problema es nginx
# Si error → Motor no está corriendo o puerto incorrecto
```

---

## Soluciones según el caso

### Caso 1: Motor no está corriendo (PM2 status = stopped/errored)

```bash
# Ver por qué crasheó
pm2 logs tu-app --err --lines 100

# Reiniciar
pm2 restart tu-app

# Si sigue crasheando, ver .env
cat /var/www/tu-app/.env
```

**Errores comunes en logs:**
- `KORE_INSTALLED no definido` → Falta completar `/setup`
- `EADDRINUSE` → Puerto ya en uso (otro proceso usando 3001)
- `Cannot find module` → npm install incompleto

### Caso 2: Puerto incorrecto (Nginx apunta a 3001, Motor usa 3003)

```bash
# Ver puerto del Motor
cat /var/www/tu-app/.env | grep PORT

# Ver puerto en Nginx
sudo cat /etc/nginx/sites-available/tu-app | grep proxy_pass

# Si son diferentes, corregir nginx:
sudo nano /etc/nginx/sites-available/tu-app
# Cambiar proxy_pass http://127.0.0.1:XXXX al puerto correcto

# Recargar nginx
sudo nginx -t && sudo nginx -s reload
```

### Caso 3: Motor crasheando por error en código

```bash
# Ver error exacto
pm2 logs tu-app --err --lines 200

# Errores comunes:
# - SyntaxError → archivo corrupto, re-descargar
# - Cannot find module → npm install
# - Database locked → permisos incorrectos

# Reinstalar dependencias
cd /var/www/tu-app
npm install --production

# Reiniciar
pm2 restart tu-app
```

### Caso 4: Instalación quedó incompleta

```bash
# Verificar que /setup se completó
cat /var/www/tu-app/.env | grep KORE_INSTALLED
# Debe decir: KORE_INSTALLED=true

# Si dice false, ve a:
https://tudominio.cl/setup
# Y completa el formulario
```

---

## Fix Definitivo (Si nada funciona)

Reinstalación limpia:

```bash
# 1. Detener todo
pm2 delete tu-app
pm2 save

# 2. Limpiar directorio
sudo rm -rf /var/www/tu-app

# 3. Volver a correr kInstall
bash <(curl -fsSL https://raw.githubusercontent.com/nadia-labs/kore/main/kinstall.sh)

# Dominio: tudominio.cl
# Puerto: 3001 (default)
# SSL: s
```

---

## Prevención

✅ Siempre usa el dominio (no localhost)  
✅ Espera que kInstall termine sin errores  
✅ Completa `/setup` antes de intentar `/admin`  
✅ Revisa logs con `pm2 logs` si algo falla  

---

**Kore 2.1** · Si el problema persiste después de estos pasos, envía:
- Output de `pm2 status`
- Output de `pm2 logs --lines 100`
- Output de `cat .env`
