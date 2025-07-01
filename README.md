# Tenis Carmen

Aplicación web para la gestión de ventas de tenis, ropa y accesorios. Este repositorio contiene una página estática con integración a Firebase y Gemini API.

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES. 

## Despliegue

Se recomienda utilizar una plataforma como Firebase Hosting o GitHub Pages. Para un proceso de despliegue automatizado puedes configurar GitHub Actions.

## Respaldo y Restauración

En la sección de Finanzas encontrarás los botones **Respaldar Base de Datos** y **Restaurar Base de Datos**.

* **Respaldar Base de Datos** descarga un archivo JSON con los documentos de las colecciones `clientes`, `inventario`, `ventas`, `abonos` y `cortes`.
* **Restaurar Base de Datos** permite seleccionar un archivo generado por el respaldo e insertarlo de nuevo en Firestore. Se mostrará una confirmación antes de sobrescribir la información existente.

Es necesario haber iniciado sesión con una cuenta autorizada para realizar estas operaciones. Ten en cuenta que el respaldo solo incluye los documentos de Firestore; no contiene configuraciones de índices ni información de autenticación de Firebase.
