# Tenis Carmen

Aplicación web para la gestión de ventas de tenis. Este repositorio contiene una página estática con integración a Firebase y Gemini API.

## Configuración

1. Copia `js/config.example.js` a `js/config.js` y coloca tus claves de Firebase y Gemini en ese archivo.
2. Instala dependencias para compilar Tailwind y ejecutar herramientas de desarrollo:
   ```bash
   npm install
   ```
3. Compila los estilos (opcional):
   ```bash
   npm run build:css
   ```
4. Ejecuta las pruebas:
   ```bash
   npm test
   ```
5. Inicia un servidor local (por ejemplo con [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) o similar) para ver la aplicación.

```bash
npx serve .
```

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES. Asegúrate de mantener tus claves fuera del repositorio creando `js/config.js` (ignorado por git).

## Despliegue

Se recomienda utilizar una plataforma como Firebase Hosting o GitHub Pages. Este repositorio incluye un flujo de GitHub Actions (`.github/workflows/node.yml`) que instala dependencias, ejecuta pruebas y compila los estilos en cada push.
