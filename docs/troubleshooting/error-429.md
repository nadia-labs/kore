# Solución al Error 429 "Too Many Requests" en kAdmin

## Problema Identificado

El error **429 Too Many Requests** al intentar acceder a `/admin` o `/setup` es causado por una configuración **demasiado restrictiva** del rate limiting en Nginx.

### Configuración Problemática (ANTES)

```nginx
limit_req_zone $binary_remote_addr zone=kore_login:10m rate=5r/m;

location = /admin/login {
    limit_req zone=kore_login burst=3 nodelay;
    # ...
}
```

**Problema:** `rate=5r/m` significa **5 requests por minuto** por IP. Al cargar la página de login/admin, el navegador hace múltiples requests simultáneos (HTML, CSS, JS, APIs), superando rápidamente este límite.

---

## Solución Implementada

### 1. Nueva Configuración de Nginx

**Cambios aplicados en `nginx.conf.template`:**

```nginx
# Rate limiting más permisivo pero seguro
limit_req_zone $binary_remote_addr zone=kore_login:10m rate=10r/s;

location = /admin/login {
    limit_req zone=kore_login burst=20 nodelay;
    limit_req_status 429;
    # ...
}

location = /setup {
    limit_req zone=kore_login burst=20 nodelay;
    # ...
}
```

**Mejoras:**
- ✅ **Rate:** `5r/m` → `10r/s` (de 5 por minuto a 10 por segundo)
- ✅ **Burst:** `3` → `20` (permite hasta 20 requests simultáneos en ráfaga)
- ✅ Mantiene protección contra ataques de fuerza bruta
- ✅ Permite uso normal del admin sin bloqueos

---

## Cómo Aplicar la Solución en Servidor Activo

### Opción A: Reconfigurar Nginx (recomendado)

Si ya instalaste Kore y tienes el error 429:

```bash
# 1. Conectar al servidor
ssh usuario@tu-dominio.com

# 2. Editar configuración de Nginx
sudo nano /etc/nginx/sites-available/tu-app

# 3. Cambiar las líneas:
#    rate=5r/m  →  rate=10r/s
#    burst=3    →  burst=20

# 4. Probar configuración
sudo nginx -t

# 5. Recargar Nginx
sudo nginx -s reload
```

### Opción B: Usar nginx.conf.template actualizado

Si tienes acceso al código fuente actualizado:

```bash
# 1. Copiar nginx.conf.template nuevo al servidor
scp nginx.conf.template usuario@servidor:/var/www/tu-app/

# 2. En el servidor, regenerar configuración
cd /var/www/tu-app
sed -e "s|__DOMAIN__|tu-dominio.com|g" \
    -e "s|__PORT__|3001|g" \
    -e "s|__APP_PATH__|/var/www/tu-app|g" \
    nginx.conf.template > /tmp/nginx-nuevo.conf

# 3. Copiar a Nginx
sudo cp /tmp/nginx-nuevo.conf /etc/nginx/sites-available/tu-app

# 4. Probar y recargar
sudo nginx -t && sudo nginx -s reload
```

---

## Verificación

Después de aplicar los cambios:

1. **Limpiar caché del navegador** (Ctrl/Cmd + Shift + R)
2. Acceder a `https://tu-dominio.com/admin` o `/setup`
3. Debería cargar sin errores 429

---

## Para Nuevas Instalaciones

✅ **Ya está solucionado** en los archivos actualizados:
- `nginx.conf.template` (versión corregida)
- `kinstall.sh` generará la configuración correcta automáticamente

---

## Explicación Técnica

### Rate Limiting en Nginx

- **`limit_req_zone`**: Define la zona de memoria y el rate limit
  - `rate=10r/s`: Máximo 10 requests por segundo por IP
  - `zone=kore_login:10m`: 10MB de memoria para trackear IPs

- **`limit_req`**: Aplica el límite a una location específica
  - `burst=20`: Permite hasta 20 requests en ráfaga antes de rechazar
  - `nodelay`: Procesa los requests del burst inmediatamente (no los encola)

### Seguridad Mantenida

Aunque es más permisivo, sigue protegiendo contra:
- ✅ Ataques de fuerza bruta (10 intentos/seg es suficiente para login manual)
- ✅ DDoS básicos (límite por IP)
- ✅ Scrapers agresivos

Para aplicaciones de uso normal, **10 requests por segundo** es más que suficiente y evita falsos positivos.

---

## Soporte

Si sigues teniendo problemas:

1. Verifica logs de Nginx:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

2. Verifica logs del Motor:
   ```bash
   pm2 logs tu-app
   ```

3. Reporta el issue en: [GitHub Issues](https://github.com/nadia-labs/kore/issues)

---

**Kore 2.1** · nadIA Labs · nadialabs.cl
