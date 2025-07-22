# Tenis Carmen

Aplicación web para la gestión y venta de tenis, ropa y accesorios. El sitio cuenta con una página pública que muestra los productos disponibles y un área privada para administración. Todo está construido como página estática con integración a Firebase y Gemini API.

## Desarrollo

El código JavaScript se encuentra ahora en `js/index.js` como módulo ES.

## Migración a React

Se añadió un pipeline con **Vite** en el directorio `src/` para ir migrando la
interfaz a React. Ejecuta lo siguiente para compilar los componentes:

```bash
cd src
npm install
npm run build
```

Los archivos generados quedan en `react-dist/` y son incluidos desde
`index.html` y `admin.html`.

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

## Exportar Inventario para la sección pública

`inventory.json` funciona como caché para la galería pública. Cuando se detecte
un movimiento en el inventario privado aparecerá un aviso dentro de la pestaña
**Inventario**. El encargado debe seguir estos pasos:

1. Abrir `exportar.html` y pulsar **Obtener inventario**.
2. Descargar el archivo con **Descargar JSON**.
3. Subir `inventory.json` al repositorio.
4. Cerrar el aviso usando el botón «X».

Este procedimiento se repite cada vez que el inventario privado cambia.


### Configurar CORS en Firebase Storage

Si al subir imágenes aparecen errores de CORS como `Response to preflight request doesn't pass access control check`, necesitas permitir tu dominio en el bucket de Firebase Storage.

Crea un archivo `cors.json` con el siguiente contenido y ejecútalo usando `gsutil`:

```json
[
  {
    "origin": ["http://tenischidos.xyz"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Luego establece la configuración:

```bash
gsutil cors set cors.json gs://tenischidos
```

Tras unos minutos, las solicitudes de subida funcionarán desde tu sitio.
