# Tenis Carmen

Aplicación web para la gestión de ventas de tenis. Este repositorio contiene una página estática con integración a Firebase y Gemini API.

## Configuración

1. Copia `js/config.example.js` a `js/config.js` y coloca tus claves de Firebase y Gemini en ese archivo.
2. Instala dependencias si deseas compilar Tailwind o ejecutar herramientas de desarrollo:
   ```bash
   npm install
   ```
3. Inicia un servidor local (por ejemplo con [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) o similar) para ver la aplicación.

```bash
npx serve .
```

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES. Asegúrate de mantener tus claves fuera del repositorio creando `js/config.js` (ignorado por git).

## Despliegue

Se recomienda utilizar una plataforma como Firebase Hosting o GitHub Pages. Para un proceso de despliegue automatizado puedes configurar GitHub Actions.

## Solución de Problemas

Si al generar el ticket de venta el PDF aparece en blanco:

1. Verifica que abras la aplicación desde un servidor local y no directamente con `file://`. Puedes usar `npx serve .` o la extensión *Live Server*.
2. Asegúrate de que las librerías externas se cargaron correctamente antes de generar el ticket.
