# Tenis Carmen

Aplicación web para la gestión y venta de tenis, ropa y accesorios. El sitio cuenta con una página pública que muestra los productos disponibles y un área privada para administración. Todo está construido como página estática con integración a Firebase y Gemini API.

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES.

### Configuración inicial

Copia `js/config.example.js` a `js/config.js` y coloca las credenciales de
Firebase y Gemini que correspondan a tu entorno de desarrollo. El archivo
`config.js` está listado en `.gitignore`, por lo que tus llaves no se
versionarán.

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


## Inventario público

El archivo `inventory.json` funciona como caché para la galería pública. Es necesario actualizarlo manualmente cada vez que cambie el inventario privado.
