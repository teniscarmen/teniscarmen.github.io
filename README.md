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

## Problemas comunes

Si al generar los archivos PDF notas que las imágenes o estilos no se cargan correctamente, asegúrate de abrir la aplicación mediante un servidor local y no directamente con el archivo `index.html`.

```bash
npx serve .
```
