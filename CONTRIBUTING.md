# Cómo contribuir a Kore

Gracias por tu interés en Kore. Este documento explica cómo proponer cambios.

## Antes de empezar

- Lee el [README](./README.md) y la [guía de instalación](./docs/guia-de-instalacion.md) para levantar Kore en local o en un servidor de pruebas.
- Revisa los [issues abiertos](https://github.com/nadia-labs/kore/issues) para ver si alguien ya está trabajando en lo mismo.
- Para cambios grandes (nuevas piezas del Motor, cambios de arquitectura), abre primero un issue y conversemos el enfoque.

## Formas de contribuir

### Crear un Kit
Un Kit es una extensión descrita en un archivo `.kit.json`, sin código ejecutable. Si tu funcionalidad cabe en los 15 tipos de campo, no necesitas tocar el Motor. Usa `kits/locales.kit.json` como referencia y propón tu Kit en un pull request dentro de `kits/`.

### Crear un Klik
Un Klik es un frontend público completo: un `index.html` más su `klik.json`, distribuido como `.zip`. Usa los Kliks de `kliks/` como referencia.

### Mejorar el Motor
Los cambios a `server.js` deben mantener los principios de Kore:

- **Pocas dependencias.** No agregues paquetes npm sin una razón fuerte; cada dependencia es superficie de ataque.
- **Los Kits no ejecutan código.** Ningún cambio puede permitir que un `.kit.json` ejecute código, modifique rutas del Motor o lea datos de otros Kits.
- **Sin paso de compilación.** HTML, CSS y JavaScript vanilla en el frontend.

### Reportar errores
Abre un issue con los pasos para reproducirlo, la versión de Kore, la de Node.js y el sistema operativo del servidor.

**Las vulnerabilidades de seguridad no se reportan en issues públicos.** Sigue las instrucciones de [SECURITY.md](./SECURITY.md).

## Flujo de trabajo

1. Haz un fork del repositorio y crea una rama desde `main`.
2. Antes de enviar, ejecuta `npm run lint` y `npm run format`.
3. Abre un pull request que explique qué cambia y por qué.

## Licencia

Al contribuir, aceptas que tu aporte se publique bajo la [Licencia Apache 2.0](./LICENSE) del proyecto. La licencia no cede las marcas "Kore", "kAdmin", "Klik", "Kit" ni el logo K.

---

*English: contributions are welcome. Open an issue in English or Spanish; please follow the principles above (few dependencies, Kits never execute code, no build step) and report security issues privately as described in [SECURITY.md](./SECURITY.md).*
