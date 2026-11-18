# Cómo Acceder Correctamente a Kore Instalado en Servidor Remoto

## ❌ ERROR COMÚN

**NO DEBES** intentar acceder a:
- `http://localhost:3001/admin`
- `http://localhost:3003/admin`
- `http://127.0.0.1:3001/admin`

**¿Por qué no funciona?**
`localhost` siempre se refiere a **tu computadora local**, no al servidor remoto donde instalaste Kore.

---

## ✅ FORMA CORRECTA DE ACCEDER

### Si tienes un dominio configurado:

```
https://tudominio.com/admin
https://tudominio.com/setup
```

O con www:
```
https://www.tudominio.com/admin
```

### Si solo tienes la IP pública del servidor:

```
http://123.45.67.89/admin
```

(Reemplaza `123.45.67.89` con la IP real de tu servidor)

---

## Cómo Verificar que el Servidor Está Corriendo

Conéctate por SSH a tu servidor y ejecuta:

```bash
# Ver estado de PM2
pm2 status

# Ver logs en tiempo real
pm2 logs tu-app-name

# Verificar que está escuchando en el puerto
netstat -tlnp | grep 3001

# Verificar Nginx
sudo systemctl status nginx
sudo nginx -t
```

---

## Pasos de Diagnóstico

### 1. Verificar DNS (si usas dominio)

```bash
# En tu Mac local:
ping tudominio.com
nslookup tudominio.com
```

Debe resolver a la IP de tu servidor, NO a 127.0.0.1

### 2. Verificar Firewall del Servidor

```bash
# En el servidor:
sudo ufw status
sudo iptables -L -n
```

Debe permitir tráfico en puertos 80 (HTTP) y 443 (HTTPS)

### 3. Verificar Nginx

```bash
# En el servidor:
sudo nginx -t
curl -I http://localhost:3001/admin
```

### 4. Verificar PM2

```bash
# En el servidor:
pm2 list
pm2 logs --lines 50
```

---

## URLs Correctas para Acceder

Una vez que kInstall terminó exitosamente, debes acceder a:

### Primera vez (instalación web):
```
https://tudominio.com/setup
```

### Después de instalado:
```
https://tudominio.com/admin
```

### Si tienes SSL instalado:
- Usa siempre `https://`
- Nginx redirige automáticamente HTTP → HTTPS

### Si NO tienes SSL:
- Usa `http://` (no recomendado para producción)

---

## Caso Específico: Safari en Mac → Servidor Remoto

**Escenario:**
- Instalaste Kore en un servidor VPS/Cloud
- kInstall terminó sin errores
- Intentas abrir desde Safari y aparece "no puede abrir localhost:3003"

**Solución:**
1. Obtén tu dominio o IP pública del servidor
2. Abre Safari
3. Navega a: `https://tudominio.com/setup`
4. Completa la instalación web
5. Accede al admin en: `https://tudominio.com/admin`

---

## Comandos Útiles de Troubleshooting

```bash
# En el servidor remoto (conectado por SSH)

# Ver qué proceso está usando el puerto 3001
sudo lsof -i :3001

# Ver todos los logs de Nginx
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Reiniciar servicios si es necesario
pm2 restart tu-app-name
sudo systemctl restart nginx

# Ver el .env
cat /var/www/tu-app/.env

# Ver estado completo
pm2 show tu-app-name
```

---

## Recuerda

1. **localhost = tu computadora**, NO el servidor remoto
2. Debes usar el **dominio** o **IP pública** del servidor
3. Si usaste kInstall, Nginx ya está configurado como proxy inverso
4. El puerto 3001 es interno, accedes por HTTP/HTTPS (80/443)
5. Si tienes SSL, usa siempre HTTPS

---

**Kore 2.1** · nadIA Labs · nadialabs.cl
