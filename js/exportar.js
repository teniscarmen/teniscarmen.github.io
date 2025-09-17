import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  initializeFirestore,
  collection,
  getDocs,
  Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const exportBtn = document.getElementById('export-btn');
const statusBanner = document.getElementById('status-banner');
const authStatus = document.getElementById('auth-status');
const logEl = document.getElementById('log');

const getSharedCollectionPath = (collectionName) =>
  `negocio-tenis/shared_data/${collectionName}`;

function appendLog(message) {
  const timestamp = new Date().toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  logEl.textContent += `[${timestamp}] ${message}\n`;
  logEl.scrollTop = logEl.scrollHeight;
}

function setStatus(message, type = 'info') {
  const colors = {
    info: 'border-slate-200 bg-slate-50 text-slate-600',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-rose-200 bg-rose-50 text-rose-700',
  };
  statusBanner.className = `rounded-lg border p-4 text-sm ${colors[type] || colors.info}`;
  statusBanner.textContent = message;
}

function serializeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Timestamp) {
    return {
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }
  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      const serialized = serializeValue(value[key]);
      if (serialized !== undefined) {
        acc[key] = serialized;
      }
      return acc;
    }, {});
}

function serializeProduct(doc) {
  const orderedKeys = Object.keys(doc).sort();
  return orderedKeys.reduce((acc, key) => {
    const value = serializeValue(doc[key]);
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function downloadJsonFile(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function exportInventory() {
  exportBtn.disabled = true;
  setStatus('Consultando inventario en Firestore...', 'info');
  appendLog('Solicitando documentos de la colección de inventario.');

  try {
    const snapshot = await getDocs(collection(db, getSharedCollectionPath('inventario')));
    appendLog(`Colección recibida: ${snapshot.size} documentos totales.`);

    const products = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    const disponibles = products.filter((item) => (item.status || '').toLowerCase() === 'disponible');

    appendLog(`Productos disponibles: ${disponibles.length}. Generando archivo...`);

    const plainProducts = disponibles
      .map(serializeProduct)
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''));

    downloadJsonFile(plainProducts, 'inventory.json');
    setStatus('Archivo inventory.json generado correctamente.', 'success');
    appendLog('Descarga iniciada. Reemplaza el archivo en el repositorio para publicar los cambios.');
  } catch (error) {
    console.error('Error al exportar inventario', error);
    setStatus('Ocurrió un error al exportar el inventario. Revisa la consola.', 'error');
    appendLog(`Error: ${error.message}`);
  } finally {
    exportBtn.disabled = false;
  }
}

loginBtn.addEventListener('click', async () => {
  try {
    setStatus('Autenticando con Google...', 'info');
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Error al iniciar sesión', error);
    setStatus('No se pudo iniciar sesión. Intenta nuevamente.', 'error');
    appendLog(`Fallo en autenticación: ${error.message}`);
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    appendLog('Sesión cerrada.');
  } catch (error) {
    console.error('Error al cerrar sesión', error);
    appendLog(`Error al cerrar sesión: ${error.message}`);
  }
});

exportBtn.addEventListener('click', exportInventory);

onAuthStateChanged(auth, (user) => {
  if (user) {
    authStatus.textContent = `${user.displayName || user.email}`;
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    exportBtn.disabled = false;
    setStatus('Autenticación completada. Puedes generar el archivo cuando gustes.', 'success');
    appendLog('Autenticado correctamente.');
  } else {
    authStatus.textContent = 'Verifica tu identidad para continuar.';
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    exportBtn.disabled = true;
    setStatus('Conéctate para habilitar la exportación.', 'info');
  }
});
