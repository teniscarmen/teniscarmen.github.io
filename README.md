# Tenis Carmen

Aplicación web para la gestión y venta de tenis, ropa y accesorios. El sitio cuenta con una página pública que muestra los productos disponibles y un área privada para administración. Todo está construido como página estática con integración a Firebase y Gemini API.

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES.

## Estructura

* `index.html` muestra la galería pública de productos. Desde allí se puede iniciar sesión con Google para acceder al área privada.
* `admin.html` contiene la interfaz administrativa con módulos de Ventas, Inventario, Clientes y Finanzas.

## Despliegue

Se recomienda utilizar una plataforma como Firebase Hosting o GitHub Pages. Para un proceso de despliegue automatizado puedes configurar GitHub Actions.

## Respaldo y Restauración

En la sección de Finanzas encontrarás los botones **Respaldar Base de Datos** y **Restaurar Base de Datos**.

- **Respaldar Base de Datos** descarga un archivo JSON con los documentos de las colecciones `clientes`, `inventario`, `ventas`, `abonos` y `cortes`.
- **Restaurar Base de Datos** permite seleccionar un archivo generado por el respaldo e insertarlo de nuevo en Firestore. Se mostrará una confirmación antes de sobrescribir la información existente.

Es necesario haber iniciado sesión con una cuenta autorizada para realizar estas operaciones. Ten en cuenta que el respaldo solo incluye los documentos de Firestore; no contiene configuraciones de índices ni información de autenticación de Firebase.

## Limpieza de Fotos

Para eliminar la URL de la foto de todos los productos disponibles y restablecer la imagen por defecto en Firestore se incluye el script `clear-fotos`. Necesitas un archivo de credenciales de servicio de Firebase para ejecutarlo:

```bash
npm run clear-fotos -- path/to/serviceAccount.json
```

El script actualizará la colección `inventario` bajo `negocio-tenis/shared_data` y establecerá el campo `foto` como vacío en cada documento.

## Exportar Inventario para la sección pública

El script `export-inventory` genera un archivo `inventory.json` con los productos disponibles. Esta memoria intermedia permite que la página pública funcione sin credenciales de Firebase.

```bash
npm run export-inventory -- path/to/serviceAccount.json
```

