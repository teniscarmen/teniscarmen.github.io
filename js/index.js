// Firebase Imports
import {
  firebaseConfig,
  geminiApiKey,
  inventoryExportEndpoint,
} from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  initializeFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDoc,
  getDocs,
  writeBatch,
  Timestamp,
  updateDoc,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  const loadStartTimestamp = Date.now();
  const MIN_LOADING_TIME_MS = 5000;
  // --- CONFIGURATION ---

  // --- FIREBASE INITIALIZATION ---
  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
  const auth = getAuth(app);
  const storage = getStorage(app);
  const provider = new GoogleAuthProvider();
  let unsubscribeListeners = [];

  // --- UI ELEMENTS ---
  const loadingOverlay = document.getElementById('loading-overlay');
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');
  const loginBtn = document.getElementById('loginBtn');
  const userInfoDiv = document.getElementById('user-info');

  // --- STATE ---
  let allClientes = {};
  let allInventario = {};
  let allAbonos = [];
  let localClientes = [];
  let localInventario = [];
  let localVentas = [];
  let localCortes = [];
  let ventaItems = [];
  let uploadedFotoUrl = '';

  const categorias = ['Tenis', 'Ropa', 'Accesorios'];

  // --- UTILS ---
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp.seconds * 1000).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  const formatPhoneNumber = (phoneStr) => {
    const cleaned = ('' + phoneStr).replace(/\D/g, '');
    if (cleaned.length === 10) {
      const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
      if (match) {
        return `(${match[1]}) ${match[2]} ${match[3]}`;
      }
    }
    return phoneStr;
  };

  const exportArrayToCSV = (arr, filename) => {
    if (!Array.isArray(arr) || arr.length === 0) {
      showAlert('Sin datos', 'No hay información para exportar.', 'info');
      return;
    }
    const headers = Object.keys(arr[0]);
    const csv = [headers.join(',')];
    arr.forEach((item) => {
      const row = headers
        .map((h) => {
          let val = item[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'object') {
            if ('seconds' in val) {
              val = new Date(val.seconds * 1000).toISOString();
            } else {
              val = JSON.stringify(val);
            }
          }
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
      csv.push(row);
    });
    const blob = new Blob([csv.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const backupDatabase = async () => {
    const collections = [
      'clientes',
      'inventario',
      'ventas',
      'abonos',
      'cortes',
    ];
    const backup = {};
    try {
      for (const col of collections) {
        const snap = await getDocs(
          collection(db, getSharedCollectionPath(col)),
        );
        backup[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error creating backup:', error);
      showAlert('Error', 'No se pudo generar el respaldo.', 'error');
    }
  };

  const restoreDatabase = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      let data;
      try {
        data = JSON.parse(e.target.result);
      } catch (err) {
        console.error('Invalid backup file:', err);
        showAlert('Error', 'Archivo de respaldo inválido.', 'error');
        return;
      }

      const reviveTimestamps = (obj) => {
        if (obj && typeof obj === 'object') {
          if (
            Object.keys(obj).length === 2 &&
            typeof obj.seconds === 'number' &&
            typeof obj.nanoseconds === 'number'
          ) {
            return new Timestamp(obj.seconds, obj.nanoseconds);
          }
          Object.keys(obj).forEach((k) => {
            obj[k] = reviveTimestamps(obj[k]);
          });
        }
        return obj;
      };

      showAlert(
        'Confirmar Restauración',
        'Esto reemplazará los datos actuales con los del respaldo seleccionado. ¿Continuar?',
        'warning',
        async () => {
          try {
            const batch = writeBatch(db);
            const collections = [
              'clientes',
              'inventario',
              'ventas',
              'abonos',
              'cortes',
            ];
            for (const col of collections) {
              const docsArr = Array.isArray(data[col]) ? data[col] : [];
              docsArr.forEach((docData) => {
                const { id, ...rest } = docData;
                const restored = reviveTimestamps({ ...rest });
                batch.set(doc(db, getSharedCollectionPath(col), id), restored);
              });
            }
            await batch.commit();
            showAlert(
              'Éxito',
              'La base de datos ha sido restaurada.',
              'success',
            );
          } catch (err) {
            console.error('Error restoring backup:', err);
            showAlert(
              'Error',
              'No se pudo restaurar la base de datos.',
              'error',
            );
          }
        },
      );
    };
    reader.readAsText(file);
  };

  const updatePublicInventory = async () => {
    try {
      const res = await fetch(inventoryExportEndpoint, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showAlert(
        'Inventario Actualizado',
        'Se generó el archivo público de inventario.',
        'success',
      );
    } catch (error) {
      console.error('Error updating public inventory:', error);
      showAlert(
        'Error',
        'No se pudo actualizar el inventario público.',
        'error',
      );
    }
  };

  const fetchImageWithProxy = async (url) => {
    const attempt = async (u) => {
      const res = await fetch(u);
      const type = res.headers.get('content-type') || '';
      if (!res.ok || !type.startsWith('image/')) {
        throw new Error(`Invalid image response: HTTP ${res.status} ${type}`);
      }
      return res.blob();
    };
    const proxies = [
      url,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://images.weserv.nl/?url=${url.replace(/^https?:\/\//, '')}`,
    ];
    for (const p of proxies) {
      try {
        return await attempt(p);
      } catch (err) {
        console.warn('Image fetch failed for', p, err);
      }
    }
    throw new Error('All image fetch attempts failed');
  };

  const blobToPngDataUrl = (blob) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });

  const convertImagesToDataUrls = async (html) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // Remove style tags and inline font families that pdfMake can't handle
    doc.querySelectorAll('style').forEach((el) => el.remove());
    doc.querySelectorAll('[style]').forEach((el) => {
      let cleaned = el
        .getAttribute('style')
        .replace(/font-family:[^;]+;?/gi, '');
      cleaned = cleaned.replace(
        /([\d.]+)rem/g,
        (_, n) => `${parseFloat(n) * 16}px`,
      );
      cleaned = cleaned.replace(
        /([\d.]+)em/g,
        (_, n) => `${parseFloat(n) * 16}px`,
      );
      cleaned = cleaned.replace(
        /([\d.]+)in/g,
        (_, n) => `${parseFloat(n) * 96}px`,
      );
      cleaned = cleaned.replace(/:\s*auto\b/g, ':0');
      if (cleaned.trim()) {
        el.setAttribute('style', cleaned);
      } else {
        el.removeAttribute('style');
      }
    });
    const imgs = doc.querySelectorAll('img');
    for (const img of imgs) {
      const src = img.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        try {
          const blob = await fetchImageWithProxy(src);
          const dataUrl = await blobToPngDataUrl(blob);
          img.setAttribute('src', dataUrl);
        } catch (err) {
          console.error('Image load error:', src, err);
          try {
            const res = await fetch('tenis_default.jpg');
            const blob = await res.blob();
            const placeholderUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            img.setAttribute('src', placeholderUrl);
          } catch (placeholderErr) {
            console.error('Placeholder load error:', placeholderErr);
            img.remove();
          }
        }
      }
    }
    return doc.body.innerHTML;
  };

  const downloadPdfFromHtml = async (
    html,
    filename,
    orientation = 'portrait',
    headerHtml = null,
  ) => {
    const processedHtml = await convertImagesToDataUrls(html);
    const pdfContent = htmlToPdfmake(processedHtml, { window });
    let header = undefined;
    if (headerHtml) {
      const processedHeader = await convertImagesToDataUrls(headerHtml);
      header = htmlToPdfmake(processedHeader, { window });
    }
    const docDefinition = {
      pageOrientation: orientation,
      content: pdfContent,
    };
    if (header) {
      docDefinition.header = header;
    }
    pdfMake.createPdf(docDefinition).download(filename);
  };

  // --- MODALS AND ALERTS ---
  const showModal = (modal) => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
      }
    }, 10);
  };
  const hideModal = (modal) => {
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.classList.add('scale-95');
      content.classList.remove('scale-100');
    }
    setTimeout(() => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }, 300);
  };
  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    const alertModal = document.getElementById('alertModal');
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').innerHTML = message;

    const iconContainer = document.getElementById('alertIcon');
    const buttonsContainer = document.getElementById('alertButtons');
    iconContainer.innerHTML = '';
    buttonsContainer.innerHTML = '';

    let iconClass = '';
    switch (type) {
      case 'success':
        iconClass = 'fa-check-circle text-green-500';
        break;
      case 'error':
        iconClass = 'fa-times-circle text-red-500';
        break;
      case 'warning':
        iconClass = 'fa-exclamation-triangle text-yellow-500';
        break;
      default:
        iconClass = 'fa-info-circle text-blue-500';
    }
    iconContainer.innerHTML = `<i class="fas ${iconClass} text-4xl"></i>`;

    if (onConfirm) {
      buttonsContainer.innerHTML = `
<button id="alertCancelBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancelar</button>
<button id="alertConfirmBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Confirmar</button>
`;
      document.getElementById('alertConfirmBtn').onclick = () => {
        onConfirm();
        hideModal(alertModal);
      };
      document.getElementById('alertCancelBtn').onclick = () =>
        hideModal(alertModal);
    } else {
      buttonsContainer.innerHTML = `<button id="alertOkBtn" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Entendido</button>`;
      document.getElementById('alertOkBtn').onclick = () =>
        hideModal(alertModal);
    }
    showModal(alertModal);
  };

  function hideLoadingOverlay() {
    const elapsed = Date.now() - loadStartTimestamp;
    const remaining = Math.max(MIN_LOADING_TIME_MS - elapsed, 0);
    setTimeout(() => {
      loadingOverlay.classList.add('hidden');
    }, remaining);
  }

  function setupClearableSearch(inputId, clearBtnId) {
    const input = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearBtnId);

    const renderFunction = () => {
      const event = new Event('input', { bubbles: true, cancelable: true });
      input.dispatchEvent(event);
    };

    input.addEventListener('input', () => {
      clearBtn.classList.toggle('hidden', input.value.trim().length === 0);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.add('hidden');
      renderFunction();
      input.focus();
    });
  }

  // --- AUTHENTICATION LOGIC ---
  async function handleUserLogin(user) {
    loadingOverlay.classList.remove('hidden');
    if (!user) {
      unsubscribeAll();
      appContainer.classList.add('hidden');
      loginScreen.classList.remove('hidden');
      hideLoadingOverlay();
      return;
    }

    const adminRef = doc(db, 'admins', user.email);
    const adminSnap = await getDoc(adminRef);

    if (adminSnap.exists()) {
      userInfoDiv.innerHTML = `
<img src="${user.photoURL}" alt="${user.displayName}" class="w-8 h-8 rounded-full border-2 border-gray-200">
<span class="font-semibold hidden md:inline text-gray-800">${user.displayName}</span>
<button id="logoutBtn" class="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-lg text-xs">Salir</button>
`;
      document
        .getElementById('logoutBtn')
        .addEventListener('click', () => signOut(auth));
      initializeAppListeners(user);
      renderCajaActions(user);
      appContainer.classList.remove('hidden');
      loginScreen.classList.add('hidden');
    } else {
      showAlert(
        'Acceso Denegado',
        `El correo <b>${user.email}</b> no tiene permiso para acceder.`,
        'error',
      );
      signOut(auth);
    }
    hideLoadingOverlay();
  }

  // --- LOGIN HANDLER (using Popup) ---
  const signInWithGoogle = async () => {
    loadingOverlay.classList.remove('hidden');
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error en inicio con Popup:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        showAlert(
          'Error de Inicio de Sesión',
          `No se pudo completar: ${error.message}`,
          'error',
        );
      }
      hideLoadingOverlay();
    }
  };

  const getSharedCollectionPath = (collectionName) =>
    `negocio-tenis/shared_data/${collectionName}`;

  function unsubscribeAll() {
    unsubscribeListeners.forEach((unsub) => unsub());
    unsubscribeListeners = [];
  }

  // --- FULLY RESTORED FUNCTIONS ---

  function renderFinancialSummaries() {
    const periodSummaryDiv = document.getElementById('finanzas-summary');
    const globalSummaryDiv = document.getElementById('saldo-global-summary');
    periodSummaryDiv.innerHTML =
      '<p class="col-span-full text-center text-gray-500">Calculando...</p>';
    globalSummaryDiv.innerHTML =
      '<p class="text-center text-gray-500">Calculando...</p>';

    const startDateStr = document.getElementById('startDate').value;
    const endDateStr = document.getElementById('endDate').value;

    let startDate = null;
    let endDate = null;

    if (startDateStr && endDateStr) {
      startDate = new Date(startDateStr);
      endDate = new Date(endDateStr);
      endDate.setHours(23, 59, 59, 999);
    }

    const currentUserName = auth.currentUser?.displayName || '';

    let totalVentasPeriodo = 0;
    let totalAbonosPeriodo = 0;
    let totalPendienteGlobal = 0;

    const ventasEnPeriodo = localVentas.filter((v) => {
      if (v.vendedor !== currentUserName) return false;
      if (!v.fecha) return false;
      const fechaVenta = new Date(v.fecha.seconds * 1000);
      return !startDate || (fechaVenta >= startDate && fechaVenta <= endDate);
    });
    totalVentasPeriodo = ventasEnPeriodo.reduce(
      (acc, v) => acc + (v.precioPactado || 0),
      0,
    );

    const abonosEnPeriodo = allAbonos.filter((a) => {
      if (a.cobradoPor !== currentUserName) return false;
      if (!a.fecha) return false;
      const fechaAbono = new Date(a.fecha.seconds * 1000);
      return !startDate || (fechaAbono >= startDate && fechaAbono <= endDate);
    });
    totalAbonosPeriodo = abonosEnPeriodo.reduce(
      (acc, a) => acc + (a.monto || 0),
      0,
    );

    totalPendienteGlobal = localVentas
      .filter((v) => v.vendedor === currentUserName)
      .reduce((acc, v) => acc + (v.saldo || 0), 0);

    periodSummaryDiv.innerHTML = `
<div class="bg-gray-50 p-4 rounded-lg text-center">
<p class="text-sm text-gray-500 mb-1">Total Ventas (Periodo)</p>
<p class="text-3xl font-bold text-indigo-600">${formatCurrency(totalVentasPeriodo)}</p>
</div>
<div class="bg-gray-50 p-4 rounded-lg text-center">
<p class="text-sm text-gray-500 mb-1">Total Abonos (Periodo)</p>
<p class="text-3xl font-bold text-green-600">${formatCurrency(totalAbonosPeriodo)}</p>
</div>
`;

    globalSummaryDiv.innerHTML = `
<p class="text-sm text-gray-500 mb-1">Pendiente por Cobrar</p>
<p class="text-4xl font-bold text-red-600">${formatCurrency(totalPendienteGlobal)}</p>
`;

    renderDineroEnPosesion(currentUserName);
  }

  function renderDineroEnPosesion(userName) {
    const container = document.getElementById('dinero-en-posesion');
    container.innerHTML = '';

    const abonosPendientes = allAbonos.filter(
      (a) => a.estado === 'pendiente' && a.enPosesionDe === userName,
    );

    const totales = { efectivo: 0, transferencia: 0, total: 0 };
    abonosPendientes.forEach((abono) => {
      if (abono.metodoPago === 'Efectivo') {
        totales.efectivo += abono.monto;
      } else if (abono.metodoPago === 'Transferencia') {
        totales.transferencia += abono.monto;
      }
      totales.total += abono.monto;
    });

    if (abonosPendientes.length === 0) {
      container.innerHTML = `<p class="text-center text-gray-500 col-span-full">No hay dinero pendiente en tu posesión.</p>`;
      return;
    }

    const card = `
<div class="bg-gray-50 p-3 rounded-lg border">
<p class="font-bold text-gray-800">${userName}</p>
<div class="mt-2 text-sm space-y-1">
<div class="flex justify-between"><span>Efectivo:</span> <span class="font-medium text-green-600">${formatCurrency(totales.efectivo)}</span></div>
<div class="flex justify-between"><span>Transferencia:</span> <span class="font-medium text-blue-600">${formatCurrency(totales.transferencia)}</span></div>
<div class="flex justify-between border-t mt-1 pt-1"><strong>Total:</strong> <strong class="text-indigo-600">${formatCurrency(totales.total)}</strong></div>
</div>
</div>
`;
    container.innerHTML = card;
  }

  function renderCajaActions(currentUser) {
    const container = document.getElementById('caja-actions');
    container.innerHTML = '';

    if (currentUser.displayName !== 'Carmen Reyes') {
      container.innerHTML += `
<div>
<h4 class="font-semibold text-gray-700">Entregar al supervisor (Corte X)</h4>
<p class="text-sm text-gray-500 mb-2">Marcará todo tu dinero pendiente como entregado.</p>
<button id="corteXBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">
Realizar Corte X
</button>
</div>
`;
      document
        .getElementById('corteXBtn')
        .addEventListener('click', handleCorteX);
    }

    if (currentUser.displayName === 'Carmen Reyes') {
      container.innerHTML += `
<div>
<h4 class="font-semibold text-gray-700">Corte Z (Final)</h4>
<p class="text-sm text-gray-500 mb-2">Realizar el corte final con todo el dinero en tu posesión. Se calcularán comisiones.</p>
<button id="corteZBtn" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
Realizar Corte Z
</button>
</div>
`;
      document
        .getElementById('corteZBtn')
        .addEventListener('click', handleCorteZ);
    }
  }

  async function handleCorteX() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const abonosPendientes = allAbonos.filter(
      (a) =>
        a.estado === 'pendiente' && a.enPosesionDe === currentUser.displayName,
    );

    if (abonosPendientes.length === 0) {
      showAlert(
        'Sin pendientes',
        'No tienes dinero pendiente para transferir.',
        'info',
      );
      return;
    }

    const totalEntregado = abonosPendientes.reduce(
      (sum, a) => sum + a.monto,
      0,
    );

    showAlert(
      'Confirmar Corte X',
      `Estás a punto de entregar ${formatCurrency(totalEntregado)} al supervisor. ¿Continuar?`,
      'warning',
      async () => {
        const batch = writeBatch(db);
        const corteRef = doc(collection(db, getSharedCollectionPath('cortes')));

        const corteDoc = {
          type: 'Corte X',
          fecha: new Date(),
          totalGeneral: totalEntregado,
          realizadoPor: currentUser.displayName,
          recibidoPor: 'Carmen',
          abonosIds: abonosPendientes.map((a) => a.id),
        };
        batch.set(corteRef, corteDoc);

        abonosPendientes.forEach((abono) => {
          const abonoRef = doc(db, getSharedCollectionPath('abonos'), abono.id);
          batch.update(abonoRef, {
            estado: 'entregado_a_carmen',
            corteId: corteRef.id,
          });
        });

        try {
          await batch.commit();
          showAlert('Éxito', 'El Corte X ha sido registrado.', 'success');
        } catch (error) {
          console.error('Error al crear Corte X:', error);
          showAlert(
            'Error',
            'Ocurrió un problema al registrar el corte.',
            'error',
          );
        }
      },
    );
  }

  async function handleCorteZ() {
    const abonosParaCorte = allAbonos.filter(
      (a) => a.estado === 'entregado_a_carmen',
    );

    if (abonosParaCorte.length === 0) {
      showAlert(
        'Sin dinero para cortar',
        'No hay dinero pendiente de corte final.',
        'info',
      );
      return;
    }

    const totalCorte = abonosParaCorte.reduce((sum, a) => sum + a.monto, 0);

    const ventasAfectadas = {};
    abonosParaCorte.forEach((abono) => {
      if (!ventasAfectadas[abono.ventaId]) {
        const venta = localVentas.find((v) => v.id === abono.ventaId);
        if (venta) {
          ventasAfectadas[abono.ventaId] = {
            saldoAnterior: venta.saldo,
            abonosEnCorte: 0,
          };
        }
      }
      if (ventasAfectadas[abono.ventaId]) {
        ventasAfectadas[abono.ventaId].abonosEnCorte += abono.monto;
      }
    });

    const comisionesPorVendedor = {};
    const ventasLiquidadas = [];

    for (const ventaId in ventasAfectadas) {
      const ventaOriginal = localVentas.find((v) => v.id === ventaId);
      const saldoPostAbonos = ventaOriginal.saldo; // Saldo ya actualizado por los abonos

      if (saldoPostAbonos <= 0 && !ventaOriginal.comisionPagada) {
        const vendedor = ventaOriginal.vendedor || 'Desconocido';
        if (!comisionesPorVendedor[vendedor]) {
          comisionesPorVendedor[vendedor] = 0;
        }
        comisionesPorVendedor[vendedor] += 300; // Comisión de $300
        ventasLiquidadas.push(ventaId);
      }
    }

    let comisionHtml = '<p>No se generaron nuevas comisiones.</p>';
    const totalComision = Object.values(comisionesPorVendedor).reduce(
      (s, c) => s + c,
      0,
    );

    if (totalComision > 0) {
      comisionHtml = `
<div class="text-left text-sm mt-4 p-2 bg-gray-100 rounded">
<h4 class="font-bold">Comisiones Generadas:</h4>
${Object.entries(comisionesPorVendedor)
  .map(
    ([vendedor, monto]) => `
<div class="flex justify-between"><span>${vendedor}:</span> <span>${formatCurrency(monto)}</span></div>
`,
  )
  .join('')}
<div class="flex justify-between border-t mt-1 pt-1"><strong>Total:</strong> <strong>${formatCurrency(totalComision)}</strong></div>
</div>
`;
    }

    showAlert(
      'Confirmar Corte Z (Final)',
      `Se entregará un total de ${formatCurrency(totalCorte)} al dueño.`,
      'warning',
      async () => {
        const batch = writeBatch(db);
        const corteRef = doc(collection(db, getSharedCollectionPath('cortes')));

        const corteDoc = {
          type: 'Corte Z',
          fecha: new Date(),
          totalGeneral: totalCorte,
          comisionTotal: totalComision,
          comisionesPorVendedor: comisionesPorVendedor,
          realizadoPor: auth.currentUser?.displayName || 'Carmen',
          abonosIds: abonosParaCorte.map((a) => a.id),
        };
        batch.set(corteRef, corteDoc);

        abonosParaCorte.forEach((abono) => {
          const abonoRef = doc(db, getSharedCollectionPath('abonos'), abono.id);
          batch.update(abonoRef, {
            estado: 'entregado_a_jr',
            corteId: corteRef.id,
          });
        });

        ventasLiquidadas.forEach((ventaId) => {
          const ventaRef = doc(db, getSharedCollectionPath('ventas'), ventaId);
          batch.update(ventaRef, { comisionPagada: true });
        });

        try {
          await batch.commit();
          showAlert(
            'Corte Z Realizado',
            'El corte final fue registrado y las comisiones calculadas.',
            'success',
          );
        } catch (error) {
          console.error('Error en corte final:', error);
          showAlert(
            'Error',
            'Ocurrió un problema al registrar el corte final.',
            'error',
          );
        }
      },
    );
    setTimeout(
      () =>
        document
          .getElementById('alertMessage')
          .insertAdjacentHTML('afterend', comisionHtml),
      50,
    );
  }

  async function handleDeleteCorte(corteId, corteType) {
    const corte = localCortes.find((c) => c.id === corteId);
    if (!corte) return;

    showAlert(
      'Confirmar Reversión de Corte',
      '¿Estás seguro? Esto eliminará el corte y revertirá los abonos y comisiones asociadas.',
      'warning',
      async () => {
        const batch = writeBatch(db);

        if (corte.abonosIds && corte.abonosIds.length > 0) {
          corte.abonosIds.forEach((abonoId) => {
            const abonoRef = doc(
              db,
              getSharedCollectionPath('abonos'),
              abonoId,
            );
            if (corteType === 'Corte X') {
              batch.update(abonoRef, { estado: 'pendiente', corteId: null });
            } else {
              // Corte Z
              batch.update(abonoRef, { estado: 'entregado_a_carmen' });
            }
          });
        }

        if (
          corteType === 'Corte Z' &&
          corte.comisionesPorVendedor &&
          Object.keys(corte.comisionesPorVendedor).length > 0
        ) {
          const ventasLiquidadasEnCorte = localVentas.filter(
            (v) =>
              v.comisionPagada &&
              corte.abonosIds.some(
                (aid) => allAbonos.find((a) => a.id === aid)?.ventaId === v.id,
              ),
          );
          ventasLiquidadasEnCorte.forEach((venta) => {
            const ventaRef = doc(
              db,
              getSharedCollectionPath('ventas'),
              venta.id,
            );
            batch.update(ventaRef, { comisionPagada: false });
          });
        }

        const corteRef = doc(db, getSharedCollectionPath('cortes'), corteId);
        batch.delete(corteRef);

        try {
          await batch.commit();
          showAlert('Éxito', 'El corte ha sido revertido.', 'success');
        } catch (error) {
          console.error('Error reverting cut:', error);
          showAlert('Error', 'No se pudo revertir el corte.', 'error');
        }
      },
    );
  }

  function populateInventoryFilters(inventario) {
    const brandFilter = document.getElementById('filterMarca');
    const currentBrand = brandFilter.value;
    const brands = [...new Set(inventario.map((item) => item.marca))].sort();
    brandFilter.innerHTML = '<option value="">Todas</option>';
    brands.forEach((brand) => {
      brandFilter.innerHTML += `<option value="${brand}">${brand}</option>`;
    });
    brandFilter.value = currentBrand;

    const categoriaFilter = document.getElementById('filterCategoria');
    const currentCategoria = categoriaFilter.value;
    categoriaFilter.innerHTML = '<option value="">Todas</option>';
    categorias.forEach((cat) => {
      categoriaFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    categoriaFilter.value = currentCategoria;

    const datalist = document.getElementById('marcasList');
    datalist.innerHTML = '';
    brands.forEach((brand) => {
      datalist.innerHTML += `<option value="${brand}">`;
    });
  }

  function updateInventoryHeader(inventario) {
    const disponibles = inventario.filter(
      (item) => item.status === 'disponible',
    );
    const totalValue = disponibles.reduce(
      (sum, item) => sum + (item.precio || 0),
      0,
    );
    document.getElementById('valor-total-inventario').textContent =
      formatCurrency(totalValue);
    document.getElementById('cantidad-total-productos').textContent =
      `${disponibles.length} productos`;
  }

  function renderInventario() {
    const list = document.getElementById('inventario-list');
    list.innerHTML = '';

    const searchTerm = document
      .getElementById('searchInventario')
      .value.toUpperCase()
      .trim();
    const brand = document.getElementById('filterMarca').value;
    const categoria = document.getElementById('filterCategoria').value;
    const gender = document.getElementById('filterGenero').value;
    const size = document
      .getElementById('filterTalla')
      .value.trim()
      .toUpperCase();
    const sortMethod = document.getElementById('sortInventario').value;

    let filteredInventario = [...localInventario];

    if (searchTerm) {
      filteredInventario = filteredInventario.filter(
        (i) =>
          i.modelo.toUpperCase().includes(searchTerm) ||
          i.marca.toUpperCase().includes(searchTerm) ||
          (i.sku || '').toUpperCase().includes(searchTerm),
      );
    }
    if (brand) {
      filteredInventario = filteredInventario.filter((i) => i.marca === brand);
    }
    if (categoria) {
      filteredInventario = filteredInventario.filter(
        (i) => (i.categoria || 'Tenis') === categoria,
      );
    }
    if (gender) {
      filteredInventario = filteredInventario.filter(
        (i) => i.genero === gender,
      );
    }
    if (size) {
      filteredInventario = filteredInventario.filter((i) =>
        i.talla.toUpperCase().includes(size),
      );
    }

    switch (sortMethod) {
      case 'precio_asc':
        filteredInventario.sort((a, b) => a.precio - b.precio);
        break;
      case 'precio_desc':
        filteredInventario.sort((a, b) => b.precio - a.precio);
        break;
      case 'marca_asc':
        filteredInventario.sort((a, b) => a.marca.localeCompare(b.marca));
        break;
      case 'marca_desc':
        filteredInventario.sort((a, b) => b.marca.localeCompare(a.marca));
        break;
      case 'reciente':
      default:
        filteredInventario.sort(
          (a, b) =>
            (b.fechaRegistro?.seconds || 0) - (a.fechaRegistro?.seconds || 0),
        );
    }

    if (filteredInventario.length === 0) {
      list.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron productos que coincidan con los filtros.</p>`;
      return;
    }

    filteredInventario.forEach((item) => {
      const statusColor =
        item.status === 'disponible'
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800';
      const statusText =
        item.status === 'disponible' ? 'Disponible' : 'Vendido';
      const discountActive = item.descuentoActivo;
      const precioFinal = discountActive
        ? (item.precioOferta ??
          item.precio * (1 - (item.porcentajeDescuento || 0) / 100))
        : item.precio;
      const ribbon = discountActive
        ? '<span class="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">Descuento</span>'
        : '';
      const card = document.createElement('div');
      card.className =
        'relative bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row gap-4 items-start';

      const editButtonHtml =
        item.status === 'vendido'
          ? ''
          : `<button class="editInventarioBtn text-sm text-gray-500 hover:text-indigo-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${item.id}" title="Editar"><i class="fas fa-edit fa-lg"></i></button>`;

      card.innerHTML = `${ribbon}
<img src="${item.foto || 'tenis_default.jpg'}" alt="${item.modelo}" class="w-full sm:w-24 h-24 object-cover rounded-lg flex-shrink-0" onerror="this.onerror=null;this.src='https://placehold.co/96x96/e2e8f0/64748b?text=N/A';">
<div class="flex-grow">
<div class="flex justify-between items-start">
<h4 class="font-bold text-lg text-gray-900">${item.marca} - ${item.modelo}</h4>
<span class="flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusColor}">${statusText}</span>
</div>
<div class="mt-2 text-sm text-gray-600 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
      <p><span class="font-semibold text-gray-500">Talla:</span> ${item.talla}</p>
      <p><span class="font-semibold text-gray-500">SKU:</span> ${item.sku || 'N/A'}</p>
      <p><span class="font-semibold text-gray-500">Nº de Modelo:</span> ${item.numeroModelo || 'N/A'}</p>
      <p><span class="font-semibold text-gray-500">Categoría:</span> ${item.categoria || 'Tenis'}</p>
<p><span class="font-semibold text-gray-500">Género:</span> ${item.genero || 'N/A'}</p>
<p><span class="font-semibold text-gray-500">Estilo:</span> ${item.estilo || 'N/A'}</p>
<p><span class="font-semibold text-gray-500">Material:</span> ${item.material || 'N/A'}</p>
</div>
<div class="mt-3 pt-3 border-t flex justify-between items-center">
<p class="text-gray-500 text-sm">Costo: <span class="font-semibold">${formatCurrency(item.costo || 0)}</span></p>
<div class="text-right">
${discountActive ? `<p class="text-sm line-through text-gray-400">${formatCurrency(item.precio)}</p>` : ''}
<p class="text-indigo-600 font-bold text-xl">${formatCurrency(precioFinal || 0)}</p>
</div>
</div>
</div>
<div class="w-full sm:w-auto flex-shrink-0 flex sm:flex-col justify-end gap-2 pt-2 sm:pt-0 sm:border-l sm:pl-4">
${editButtonHtml}
<button class="deleteInventarioBtn text-sm text-gray-500 hover:text-red-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${item.id}" title="Eliminar"><i class="fas fa-trash fa-lg"></i></button>
</div>
`;
      list.appendChild(card);
    });

    document
      .querySelectorAll('.editInventarioBtn')
      .forEach((btn) => btn.addEventListener('click', handleEditInventario));
    document
      .querySelectorAll('.deleteInventarioBtn')
      .forEach((btn) => btn.addEventListener('click', handleDeleteInventario));
  }

  function renderClientes(clientes, searchTerm = '') {
    const list = document.getElementById('clientes-list');
    list.innerHTML = '';

    const filteredClientes = searchTerm
      ? clientes.filter((c) => c.nombre.toUpperCase().includes(searchTerm))
      : clientes;

    if (filteredClientes.length === 0) {
      list.innerHTML = `<p class="col-span-full text-center text-gray-500 p-4">${searchTerm ? 'No se encontraron resultados.' : 'No hay clientes registrados.'}</p>`;
      return;
    }

    filteredClientes.forEach((c) => {
      const cleanedPhone = c.telefono.replace(/\D/g, '');
      const card = document.createElement('div');
      card.className =
        'bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col justify-between text-center';
      let obsHtml = '';
      if (c.observaciones) {
        obsHtml = `<p class="text-sm text-gray-500 mt-2"><i class="fas fa-sticky-note mr-2 text-gray-400"></i>${c.observaciones}</p>`;
      }

      card.innerHTML = `
<div class="flex-grow">
<p class="font-bold text-gray-900">${c.nombre}</p>
<p class="text-sm text-gray-600 flex items-center justify-center mt-1">
<i class="fas fa-phone-alt text-xs mr-2 text-gray-400"></i>
${formatPhoneNumber(c.telefono)}
</p>
${obsHtml}
</div>
<div class="flex justify-center items-center space-x-2 mt-4 pt-3 border-t">
<button class="generateReportBtn text-gray-400 hover:text-teal-500 transition-colors" data-id="${c.id}" title="Generar Reporte de Cuenta"><i class="fas fa-file-pdf fa-lg"></i></button>
<button class="gemini-btn text-gray-400 hover:text-indigo-500 transition-colors" data-id="${c.id}" title="✨ Sugerir Mensaje de Cobranza"><i class="fas fa-comment-dots fa-lg"></i></button>
<button class="abonoCuentaBtn text-gray-400 hover:text-purple-500 transition-colors" data-id="${c.id}" title="Abonar a Cuenta"><i class="fas fa-money-bill-wave fa-lg"></i></button>
<button class="clientHistoryBtn text-gray-400 hover:text-blue-500 transition-colors" data-id="${c.id}" title="Ver Historial"><i class="fas fa-history fa-lg"></i></button>
<a href="https://wa.me/521${cleanedPhone}" target="_blank" rel="noopener noreferrer" title="Enviar WhatsApp" class="text-gray-400 hover:text-green-500 transition-colors"><i class="fab fa-whatsapp fa-lg"></i></a>
<button class="editClienteBtn text-gray-400 hover:text-indigo-500 transition-colors" data-id="${c.id}" title="Editar Cliente"><i class="fas fa-edit fa-lg"></i></button>
<button class="deleteClienteBtn text-gray-400 hover:text-red-500 transition-colors" data-id="${c.id}" title="Eliminar Cliente"><i class="fas fa-trash fa-lg"></i></button>
</div>
`;
      list.appendChild(card);
    });
    document
      .querySelectorAll('.generateReportBtn')
      .forEach((btn) => btn.addEventListener('click', handleGenerateReport));
    document
      .querySelectorAll('.abonoCuentaBtn')
      .forEach((btn) => btn.addEventListener('click', handleOpenAbonoCuenta));
    document
      .querySelectorAll('.clientHistoryBtn')
      .forEach((btn) => btn.addEventListener('click', handleShowClientHistory));
    document
      .querySelectorAll('.editClienteBtn')
      .forEach((btn) => btn.addEventListener('click', handleEditCliente));
    document
      .querySelectorAll('.deleteClienteBtn')
      .forEach((btn) => btn.addEventListener('click', handleDeleteCliente));
    document
      .querySelectorAll('.gemini-btn')
      .forEach((btn) => btn.addEventListener('click', handleOpenCobranzaModal));
  }

  function renderVentas() {
    const list = document.getElementById('ventas-list');
    const header = document.getElementById('ventas-summary-header');
    list.innerHTML = '';
    header.innerHTML = '';

    const searchTerm = document
      .getElementById('searchVentas')
      .value.toUpperCase()
      .trim();
    const clienteId = document.getElementById('filterCliente').value;
    const vendedor = document.getElementById('filterVendedor').value;
    const estado = document.getElementById('filterEstadoVenta').value;
    const sortMethod = document.getElementById('sortVentas').value;

    let filteredVentas = [...localVentas];

    if (searchTerm) {
      filteredVentas = filteredVentas.filter((v) => {
        const cliente = allClientes[v.clienteId];
        const tenis = allInventario[v.tenisId];
        const clienteMatch = cliente
          ? cliente.nombre.toUpperCase().includes(searchTerm)
          : false;
        const tenisMatch = tenis
          ? `${tenis.marca} ${tenis.modelo}`.toUpperCase().includes(searchTerm)
          : false;
        const skuMatch = tenis
          ? (tenis.sku || '').toUpperCase().includes(searchTerm)
          : false;
        return clienteMatch || tenisMatch || skuMatch;
      });
    }
    if (clienteId)
      filteredVentas = filteredVentas.filter((v) => v.clienteId === clienteId);
    if (vendedor)
      filteredVentas = filteredVentas.filter((v) => v.vendedor === vendedor);
    if (estado === 'con_saldo')
      filteredVentas = filteredVentas.filter((v) => v.saldo > 0);
    else if (estado === 'liquidado')
      filteredVentas = filteredVentas.filter((v) => v.saldo <= 0);

    switch (sortMethod) {
      case 'reciente':
        filteredVentas.sort((a, b) => b.fecha.seconds - a.fecha.seconds);
        break;
      case 'antigua':
        filteredVentas.sort((a, b) => a.fecha.seconds - b.fecha.seconds);
        break;
      case 'saldo_desc':
        filteredVentas.sort((a, b) => b.saldo - a.saldo);
        break;
      case 'saldo_asc':
        filteredVentas.sort((a, b) => a.saldo - b.saldo);
        break;
      case 'cliente_az':
        filteredVentas.sort((a, b) =>
          (allClientes[a.clienteId]?.nombre || '').localeCompare(
            allClientes[b.clienteId]?.nombre || '',
          ),
        );
        break;
      case 'cliente_za':
        filteredVentas.sort((a, b) =>
          (allClientes[b.clienteId]?.nombre || '').localeCompare(
            allClientes[a.clienteId]?.nombre || '',
          ),
        );
        break;
    }

    const totalVendidoFiltrado = filteredVentas.reduce(
      (sum, v) => sum + (v.precioPactado || 0),
      0,
    );
    const saldoPendienteFiltrado = filteredVentas.reduce(
      (sum, v) => sum + (v.saldo || 0),
      0,
    );
    header.innerHTML = `
<div class="bg-gray-100 p-4 rounded-lg">
<p class="text-sm text-gray-600">Cantidad de Ventas</p>
<p class="text-2xl font-bold text-gray-800">${filteredVentas.length}</p>
</div>
<div class="bg-gray-100 p-4 rounded-lg">
<p class="text-sm text-gray-600">Total Vendido</p>
<p class="text-2xl font-bold text-green-600">${formatCurrency(totalVendidoFiltrado)}</p>
</div>
<div class="bg-gray-100 p-4 rounded-lg">
<p class="text-sm text-gray-600">Saldo Pendiente</p>
<p class="text-2xl font-bold text-red-600">${formatCurrency(saldoPendienteFiltrado)}</p>
</div>
`;

    if (filteredVentas.length === 0) {
      list.innerHTML = `<p class="text-center text-gray-500 py-8">No se encontraron ventas que coincidan con los filtros.</p>`;
      return;
    }

    filteredVentas.forEach((v) => {
      const cliente = allClientes[v.clienteId];
      const tenis = allInventario[v.tenisId];
      const abonosAcumulados = v.precioPactado - v.saldo;
      const card = document.createElement('div');
      const isOwner = v.vendedor === auth.currentUser?.displayName;
      card.className = `bg-white rounded-xl shadow-sm border p-4 flex flex-col sm:flex-row gap-4 items-start ${v.saldo <= 0 ? 'border-green-200' : 'border-gray-200'}`;
      card.innerHTML = `
<div class="flex-grow">
<div class="flex justify-between items-start mb-2">
<div>
<h4 class="font-bold text-lg text-gray-900">${cliente ? cliente.nombre : 'CLIENTE NO ENCONTRADO'}</h4>
<p class="text-sm text-gray-500">${tenis ? `${tenis.marca} ${tenis.modelo} (SKU: ${tenis.sku || 'N/A'})` : 'Artículo no encontrado'}</p>
<p class="text-xs text-gray-400 mt-1">Vendido por: ${v.vendedor || 'N/A'} el ${formatDate(v.fecha)}</p>
</div>
</div>

<div class="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
<div>
<p class="text-xs text-gray-500">Precio</p>
<p class="font-semibold text-gray-800">${formatCurrency(v.precioPactado)}</p>
</div>
<div>
<p class="text-xs text-gray-500">Abonado</p>
<p class="font-semibold text-green-600">${formatCurrency(abonosAcumulados)}</p>
</div>
<div>
<p class="text-xs text-gray-500">Saldo</p>
<p class="font-bold text-lg text-red-600">${formatCurrency(v.saldo)}</p>
</div>
</div>
</div>

<div class="w-full sm:w-auto flex-shrink-0 flex sm:flex-col justify-end gap-2 pt-2 sm:pt-0 sm:border-l sm:pl-4">
<button class="addAbonoBtn text-sm text-white font-bold py-2 px-3 rounded-md	 flex items-center justify-center ${v.saldo <= 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'}" data-id="${v.id}" ${v.saldo <= 0 ? 'disabled' : ''} title="Abonar"><i class="fas fa-hand-holding-dollar fa-lg"></i></button>
<button class="ticketVentaBtn text-sm text-gray-500 hover:text-teal-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${v.id}" title="Ticket PDF"><i class="fas fa-file-pdf fa-lg"></i></button>
<button class="whatsappVentaBtn text-sm text-gray-500 hover:text-green-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${v.id}" title="Enviar WhatsApp"><i class="fab fa-whatsapp fa-lg"></i></button>
<button class="editVentaBtn text-sm text-gray-500 hover:text-indigo-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${v.id}" title="Editar Venta"><i class="fas fa-edit fa-lg"></i></button>
<button class="deleteVentaBtn text-sm text-gray-500 hover:text-red-600 flex items-center justify-center p-2 rounded-lg hover:bg-gray-100" data-id="${v.id}" title="Eliminar Venta"><i class="fas fa-trash fa-lg"></i></button>
</div>
`;
      list.appendChild(card);
      if (!isOwner) {
        card.querySelector('.editVentaBtn')?.remove();
        card.querySelector('.deleteVentaBtn')?.remove();
      }
    });

    document
      .querySelectorAll('.addAbonoBtn')
      .forEach((btn) => btn.addEventListener('click', handleAddAbono));
    document
      .querySelectorAll('.deleteVentaBtn')
      .forEach((btn) => btn.addEventListener('click', handleDeleteVenta));
    document
      .querySelectorAll('.editVentaBtn')
      .forEach((btn) => btn.addEventListener('click', handleEditVenta));
    document
      .querySelectorAll('.ticketVentaBtn')
      .forEach((btn) =>
        btn.addEventListener('click', handleGenerateVentaTicket),
      );
    document
      .querySelectorAll('.whatsappVentaBtn')
      .forEach((btn) => btn.addEventListener('click', handleSendVentaWhatsapp));
  }

  function renderCortesXHistory(cortes, userName) {
    const list = document.getElementById('cortes-x-history-list');
    list.innerHTML = '';
    const ownCortes = cortes.filter((c) => c.realizadoPor === userName);

    if (ownCortes.length === 0) {
      list.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay Cortes X registrados.</td></tr>`;
      return;
    }

    const sortedCortes = ownCortes.sort(
      (a, b) => b.fecha.seconds - a.fecha.seconds,
    );

    sortedCortes.forEach((corte) => {
      const row = document.createElement('tr');
      row.className = 'border-b hover:bg-gray-50';
      row.innerHTML = `
<td class="px-4 py-3 whitespace-nowrap">${formatDate(corte.fecha)}</td>
<td class="px-4 py-3">${corte.realizadoPor || 'N/A'}</td>
<td class="px-4 py-3 text-right font-semibold text-green-600">${formatCurrency(corte.totalGeneral)}</td>
<td class="px-4 py-3 text-center">
<button class="deleteCorteBtn text-red-500 hover:text-red-700" data-id="${corte.id}" data-type="Corte X" title="Eliminar Corte X">
<i class="fas fa-trash"></i>
</button>
</td>
`;
      list.appendChild(row);
    });

    document
      .querySelectorAll('#cortes-x-history-list .deleteCorteBtn')
      .forEach((btn) => {
        btn.addEventListener('click', (e) =>
          handleDeleteCorte(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.type,
          ),
        );
      });
  }

  function renderCortesZHistory(cortes) {
    const list = document.getElementById('cortes-z-history-list');
    list.innerHTML = '';

    if (cortes.length === 0) {
      list.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay Cortes Z registrados.</td></tr>`;
      return;
    }

    const sortedCortes = cortes.sort(
      (a, b) => b.fecha.seconds - a.fecha.seconds,
    );

    sortedCortes.forEach((corte) => {
      const row = document.createElement('tr');
      row.className = 'border-b hover:bg-gray-50';
      row.innerHTML = `
<td class="px-4 py-3 whitespace-nowrap">${formatDate(corte.fecha)}</td>
<td class="px-4 py-3 text-right font-bold text-indigo-600">${formatCurrency(corte.totalGeneral)}</td>
<td class="px-4 py-3 text-right font-semibold text-green-600">${formatCurrency(corte.comisionTotal || 0)}</td>
<td class="px-4 py-3 text-gray-600">${corte.realizadoPor || 'N/A'}</td>
<td class="px-4 py-3 text-center">
<button class="deleteCorteBtn text-red-500 hover:text-red-700" data-id="${corte.id}" data-type="Corte Z" title="Eliminar Corte Z">
<i class="fas fa-trash"></i>
</button>
</td>
`;
      list.appendChild(row);
    });

    document
      .querySelectorAll('#cortes-z-history-list .deleteCorteBtn')
      .forEach((btn) => {
        btn.addEventListener('click', (e) =>
          handleDeleteCorte(
            e.currentTarget.dataset.id,
            e.currentTarget.dataset.type,
          ),
        );
      });
  }

  function populateVentaFilters(clientes, ventas) {
    const clienteFilter = document.getElementById('filterCliente');
    const currentCliente = clienteFilter.value;
    clienteFilter.innerHTML = '<option value="">Todos</option>';
    clientes
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((cliente) => {
        clienteFilter.innerHTML += `<option value="${cliente.id}">${cliente.nombre}</option>`;
      });
    clienteFilter.value = currentCliente;

    const vendedorFilter = document.getElementById('filterVendedor');
    const currentVendedor = vendedorFilter.value;
    const vendedores = [
      ...new Set(ventas.map((v) => v.vendedor).filter((v) => v)),
    ].sort();
    vendedorFilter.innerHTML = '<option value="">Todos</option>';
    vendedores.forEach((vendedor) => {
      vendedorFilter.innerHTML += `<option value="${vendedor}">${vendedor}</option>`;
    });
    vendedorFilter.value = currentVendedor;
  }

  async function handleEditInventario(e) {
    const id = e.currentTarget.closest('[data-id]').dataset.id;
    const item = allInventario[id];
    if (item) {
      if (item.status === 'vendido') {
        showAlert(
          'Acción no permitida',
          'No se puede editar un tenis que ya ha sido vendido. Primero debe eliminar la venta asociada.',
          'error',
        );
        return;
      }
      document.getElementById('inventarioId').value = id;
      document.getElementById('inventarioMarca').value = item.marca || '';
      document.getElementById('inventarioModelo').value = item.modelo;
      document.getElementById('inventarioNumeroModelo').value =
        item.numeroModelo || '';
      document.getElementById('inventarioSku').value = item.sku || '';
      document.getElementById('inventarioCategoria').value =
        item.categoria || 'Tenis';
      document.getElementById('inventarioTalla').value = item.talla;
      document.getElementById('inventarioGenero').value = item.genero || '';
      document.getElementById('inventarioEstilo').value = item.estilo || '';
      document.getElementById('inventarioMaterial').value = item.material || '';
      document.getElementById('inventarioDescripcion').value =
        item.descripcion || '';
      uploadedFotoUrl = item.foto || '';
      document.getElementById('inventarioDescuentoActivo').checked =
        item.descuentoActivo || false;
      document.getElementById('inventarioPorcentajeDescuento').value =
        item.porcentajeDescuento ?? '';
      document.getElementById('inventarioCosto').value = item.costo;
      document.getElementById('inventarioPrecio').value = item.precio;
      document.getElementById('inventarioModalTitle').textContent =
        'Editar Producto';
      showModal(document.getElementById('inventarioModal'));
    }
  }

  function handleDeleteInventario(e) {
    const id = e.currentTarget.closest('[data-id]').dataset.id;
    const item = allInventario[id];

    if (item && item.status === 'vendido') {
      showAlert(
        'Acción no permitida',
        'No se puede eliminar un tenis que ya ha sido vendido. Primero debe eliminar la venta asociada.',
        'error',
      );
      return;
    }

    showAlert(
      'Confirmar Eliminación',
      '¿Estás seguro de que quieres eliminar este par de tenis? Esta acción no se puede deshacer.',
      'warning',
      async () => {
        try {
          await deleteDoc(doc(db, getSharedCollectionPath('inventario'), id));
        } catch (error) {
          console.error('Error deleting item:', error);
          showAlert('Error', 'No se pudo eliminar el artículo.', 'error');
        }
      },
    );
  }

  function handleEditCliente(e) {
    const id = e.currentTarget.dataset.id;
    const cliente = allClientes[id];
    if (cliente) {
      document.getElementById('clienteId').value = id;
      document.getElementById('clienteNombre').value = cliente.nombre;
      document.getElementById('clienteTelefono').value = cliente.telefono;
      document.getElementById('clienteObservaciones').value =
        cliente.observaciones || '';
      document.getElementById('clienteModalTitle').textContent =
        'Editar Cliente';
      showModal(document.getElementById('clienteModal'));
    }
  }

  function handleDeleteCliente(e) {
    const id = e.currentTarget.dataset.id;
    showAlert(
      'Confirmar Eliminación',
      '¿Seguro que quieres eliminar a este cliente? Se eliminará si no tiene ventas asociadas.',
      'warning',
      async () => {
        const q = query(
          collection(db, getSharedCollectionPath('ventas')),
          where('clienteId', '==', id),
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          showAlert(
            'Error',
            'No se puede eliminar. El cliente tiene ventas registradas.',
            'error',
          );
          return;
        }
        try {
          await deleteDoc(doc(db, getSharedCollectionPath('clientes'), id));
        } catch (error) {
          console.error('Error deleting client:', error);
          showAlert('Error', 'Ocurrió un error al eliminar.', 'error');
        }
      },
    );
  }

  async function handleShowClientHistory(e) {
    const clientId = e.currentTarget.dataset.id;
    const cliente = allClientes[clientId];

    if (!cliente) return;

    document.getElementById('clientHistoryTitle').textContent =
      `Historial de ${cliente.nombre}`;
    const summaryDiv = document.getElementById('clientHistorySummary');
    const salesListDiv = document.getElementById('clientHistorySalesList');
    summaryDiv.innerHTML = 'Calculando...';
    salesListDiv.innerHTML = 'Buscando ventas...';
    showModal(document.getElementById('clientHistoryModal'));

    const ventasCliente = localVentas.filter((v) => v.clienteId === clientId);

    if (ventasCliente.length === 0) {
      summaryDiv.innerHTML = `<div><p class="font-semibold">Total Comprado:</p><p>${formatCurrency(0)}</p></div><div><p class="font-semibold text-red-600">Saldo Pendiente:</p><p class="text-red-600">${formatCurrency(0)}</p></div>`;
      salesListDiv.innerHTML = `<p class="text-center text-gray-500">Este cliente no tiene ventas registradas.</p>`;
      return;
    }

    let totalComprado = 0;
    let saldoPendienteGlobal = 0;
    salesListDiv.innerHTML = '';

    const sales = ventasCliente.sort(
      (a, b) => b.fecha.seconds - a.fecha.seconds,
    );

    sales.forEach((venta) => {
      totalComprado += venta.precioPactado;
      saldoPendienteGlobal += venta.saldo;
      const tenis = allInventario[venta.tenisId];
      const isPaid = venta.saldo <= 0;

      const saleCard = document.createElement('div');
      saleCard.className = `p-3 rounded-lg border ${isPaid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`;
      saleCard.innerHTML = `
<div class="flex justify-between items-center">
<div>
<p class="font-semibold">${tenis ? `${tenis.marca} ${tenis.modelo} (SKU: ${tenis.sku || 'N/A'})` : 'TENIS NO ENCONTRADO'}</p>
<p class="text-xs text-gray-500">${formatDate(venta.fecha)} - Vendido por: ${venta.vendedor || 'N/A'}</p>
</div>
<div class="text-right">
<p class="font-semibold">${formatCurrency(venta.precioPactado)}</p>
<p class="text-xs ${isPaid ? 'text-green-600' : 'text-red-600'}">Saldo: ${formatCurrency(venta.saldo)}</p>
</div>
</div>
`;
      salesListDiv.appendChild(saleCard);
    });

    summaryDiv.innerHTML = `
<div>
<p class="font-semibold text-gray-600">Total Comprado</p>
<p class="text-xl font-bold text-gray-800">${formatCurrency(totalComprado)}</p>
</div>
<div>
<p class="font-semibold text-red-600">Saldo Pendiente</p>
<p class="text-xl font-bold text-red-600">${formatCurrency(saldoPendienteGlobal)}</p>
</div>
`;
  }

  function populateVentaModal() {
    const clienteSelect = document.getElementById('ventaCliente');

    clienteSelect.innerHTML = '<option value="">Selecciona un cliente</option>';
    Object.values(allClientes)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((c) => {
        clienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
      });

    ventaItems = [];
    document.getElementById('productoSearch').value = '';
    const resultados = document.getElementById('productoResultados');
    resultados.innerHTML = '';
    resultados.classList.add('hidden');
    document.getElementById('ventaItemsContainer').innerHTML = '';
    document.getElementById('ventaTotal').value = '';
  }

  function renderProductoResultados() {
    const term = document
      .getElementById('productoSearch')
      .value.toUpperCase()
      .trim();
    const container = document.getElementById('productoResultados');
    container.innerHTML = '';
    if (!term) {
      container.classList.add('hidden');
      return;
    }
    const matches = Object.values(allInventario).filter(
      (i) =>
        i.status === 'disponible' &&
        ((i.marca && i.marca.toUpperCase().includes(term)) ||
          (i.modelo && i.modelo.toUpperCase().includes(term)) ||
          (i.descripcion && i.descripcion.toUpperCase().includes(term)) ||
          (i.sku && i.sku.toUpperCase().includes(term))),
    );
    if (matches.length === 0) {
      container.innerHTML =
        '<p class="p-2 text-gray-500">No se encontraron coincidencias.</p>';
      container.classList.remove('hidden');
      return;
    }
    matches.forEach((item) => {
      const div = document.createElement('div');
      div.className =
        'flex justify-between items-center p-2 cursor-pointer hover:bg-gray-100';
      div.innerHTML = `<span>${item.marca} ${item.modelo} (SKU: ${item.sku || 'N/A'})</span><span>${formatCurrency(item.precio)}</span>`;
      div.addEventListener('click', () => addProductoAVenta(item.id));
      container.appendChild(div);
    });
    container.classList.remove('hidden');
  }

  function addProductoAVenta(id) {
    if (ventaItems.some((p) => p.id === id)) return;
    const prod = allInventario[id];
    if (!prod) return;
    ventaItems.push({ id, precio: prod.precio });
    const container = document.getElementById('ventaItemsContainer');
    const div = document.createElement('div');
    div.dataset.id = id;
    div.className = 'flex items-center justify-between bg-gray-50 p-2 rounded';
    div.innerHTML = `<span class="text-sm">${prod.marca} ${prod.modelo} (SKU: ${prod.sku || 'N/A'})</span><input type="number" step="0.01" class="venta-item-precio w-24 p-1 border rounded text-right mr-2" value="${prod.precio}"><button type="button" class="remove-item-btn text-red-500"><i class="fas fa-times"></i></button>`;
    div
      .querySelector('.remove-item-btn')
      .addEventListener('click', () => removeProductoDeVenta(id));
    div
      .querySelector('.venta-item-precio')
      .addEventListener('input', actualizarTotalVenta);
    container.appendChild(div);
    actualizarTotalVenta();
  }

  function removeProductoDeVenta(id) {
    ventaItems = ventaItems.filter((p) => p.id !== id);
    const div = document.querySelector(
      `#ventaItemsContainer [data-id="${id}"]`,
    );
    if (div) div.remove();
    actualizarTotalVenta();
  }

  function actualizarTotalVenta() {
    const container = document.getElementById('ventaItemsContainer');
    let total = 0;
    container.querySelectorAll('[data-id]').forEach((div) => {
      const precio = parseFloat(div.querySelector('.venta-item-precio').value);
      if (!isNaN(precio)) total += precio;
      const item = ventaItems.find((p) => p.id === div.dataset.id);
      if (item) item.precio = precio;
    });
    document.getElementById('ventaTotal').value = total.toFixed(2);
  }

  async function handleEditVenta(e) {
    const id = e.currentTarget.closest('[data-id]').dataset.id;
    const venta = localVentas.find((v) => v.id === id);
    if (!venta) return;
    if (venta.vendedor !== auth.currentUser?.displayName) {
      showAlert(
        'Acceso Denegado',
        'No puedes editar ventas de otro vendedor.',
        'error',
      );
      return;
    }

    document.getElementById('editVentaId').value = id;

    const tenis = allInventario[venta.tenisId];
    document.getElementById('editVentaTenisInfo').textContent = tenis
      ? `${tenis.marca} ${tenis.modelo} (SKU: ${tenis.sku || 'N/A'})`
      : 'Artículo no encontrado';

    const clienteSelect = document.getElementById('editVentaCliente');
    clienteSelect.innerHTML = '';
    Object.values(allClientes)
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .forEach((c) => {
        clienteSelect.innerHTML += `<option value="${c.id}">${c.nombre}</option>`;
      });
    clienteSelect.value = venta.clienteId;

    document.getElementById('editVentaPrecio').value = venta.precioPactado;

    showModal(document.getElementById('editVentaModal'));
  }

  function handleDeleteVenta(e) {
    const id = e.currentTarget.closest('[data-id]').dataset.id;
    const venta = localVentas.find((v) => v.id === id);
    if (!venta || venta.vendedor !== auth.currentUser?.displayName) {
      showAlert(
        'Acceso Denegado',
        'No puedes eliminar ventas de otro vendedor.',
        'error',
      );
      return;
    }
    showAlert(
      'Confirmar Eliminación',
      'Esto eliminará la venta y todos sus abonos. El tenis volverá a estar disponible. ¿Continuar?',
      'warning',
      async () => {
        try {
          const ventaRef = doc(db, getSharedCollectionPath('ventas'), id);
          const ventaSnap = await getDoc(ventaRef);
          const ventaData = ventaSnap.data();

          const batch = writeBatch(db);

          const abonosQuery = query(
            collection(db, getSharedCollectionPath('abonos')),
            where('ventaId', '==', id),
          );
          const abonosSnapshot = await getDocs(abonosQuery);
          abonosSnapshot.forEach((doc) => batch.delete(doc.ref));

          batch.delete(ventaRef);

          const inventarioRef = doc(
            db,
            getSharedCollectionPath('inventario'),
            ventaData.tenisId,
          );
          batch.update(inventarioRef, { status: 'disponible' });

          await batch.commit();
          showAlert(
            'Éxito',
            'La venta ha sido eliminada y el tenis ha sido restaurado al inventario.',
            'success',
          );
        } catch (error) {
          console.error('Error deleting sale: ', error);
          showAlert('Error', 'Ocurrió un error al eliminar la venta.', 'error');
        }
      },
    );
  }

  async function handleAddAbono(e) {
    const ventaId = e.currentTarget.closest('[data-id]').dataset.id;
    const ventaRef = doc(db, getSharedCollectionPath('ventas'), ventaId);
    const ventaSnap = await getDoc(ventaRef);
    const venta = { id: ventaSnap.id, ...ventaSnap.data() };

    if (!venta) return;

    const cliente = allClientes[venta.clienteId];
    const tenis = allInventario[venta.tenisId];

    document.getElementById('abonoVentaId').value = ventaId;
    document.getElementById('abonoInfo').innerHTML = `
<b>Cliente:</b> ${cliente.nombre}<br>
<b>Tenis:</b> ${tenis.modelo}<br>
<b>Saldo Actual:</b> <span class="font-bold text-red-600">${formatCurrency(venta.saldo)}</span>
`;

    const abonosList = document.querySelector('#abonosAnteriores ul');
    abonosList.innerHTML = '<li>Cargando historial...</li>';
    const abonosQuery = query(
      collection(db, getSharedCollectionPath('abonos')),
      where('ventaId', '==', ventaId),
    );
    onSnapshot(abonosQuery, (snapshot) => {
      abonosList.innerHTML = '';
      if (snapshot.empty) {
        abonosList.innerHTML =
          '<li class="text-gray-400">No hay abonos previos.</li>';
      } else {
        const abonos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        abonos.sort((a, b) => a.fecha.seconds - b.fecha.seconds);

        abonos.forEach((abono) => {
          const metodoClass =
            abono.metodoPago === 'Efectivo'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800';
          const metodoText = abono.metodoPago || 'N/A';
          const li = document.createElement('li');
          li.className =
            'flex justify-between items-center bg-gray-50 p-2 rounded';
          const isOwnerAbono =
            abono.cobradoPor === auth.currentUser?.displayName;
          li.innerHTML = `
<div>
<span>${formatDate(abono.fecha)} - ${formatCurrency(abono.monto)}</span>
<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${metodoClass}">${metodoText}</span>
</div>
<div class="flex items-center space-x-3">
${isOwnerAbono ? `<button class="editAbonoBtn text-xs text-gray-500 hover:text-indigo-600" data-id="${abono.id}" data-monto="${abono.monto}" data-metodo="${abono.metodoPago}" data-fecha='${JSON.stringify(abono.fecha)}' data-ventaid="${abono.ventaId}"><i class="fas fa-edit"></i></button>` : ''}
${isOwnerAbono ? `<button class="deleteAbonoBtn text-xs text-red-400 hover:text-red-600" data-id="${abono.id}" data-monto="${abono.monto}" data-ventaid="${abono.ventaId}"><i class="fas fa-times"></i></button>` : ''}
</div>
`;
          abonosList.appendChild(li);
        });
        document
          .querySelectorAll('.editAbonoBtn')
          .forEach((btn) => btn.addEventListener('click', handleEditAbono));
        document
          .querySelectorAll('.deleteAbonoBtn')
          .forEach((btn) => btn.addEventListener('click', handleDeleteAbono));
      }
    });

    document.getElementById('abonoForm').reset();
    showModal(document.getElementById('abonoModal'));
  }

  async function handleDeleteAbono(e) {
    const abonoId = e.currentTarget.dataset.id;
    const monto = parseFloat(e.currentTarget.dataset.monto);
    const ventaId = e.currentTarget.dataset.ventaid;

    const abono = allAbonos.find((a) => a.id === abonoId);
    if (!abono || abono.cobradoPor !== auth.currentUser?.displayName) {
      showAlert(
        'Acceso Denegado',
        'No puedes eliminar abonos de otro vendedor.',
        'error',
      );
      return;
    }

    showAlert(
      'Confirmar Eliminación',
      `¿Seguro que quieres eliminar este abono de ${formatCurrency(monto)}? El saldo de la venta se reajustará.`,
      'warning',
      async () => {
        const batch = writeBatch(db);

        const abonoRef = doc(db, getSharedCollectionPath('abonos'), abonoId);
        batch.delete(abonoRef);

        const ventaRef = doc(db, getSharedCollectionPath('ventas'), ventaId);
        const ventaSnap = await getDoc(ventaRef);
        const nuevoSaldo = ventaSnap.data().saldo + monto;
        batch.update(ventaRef, { saldo: nuevoSaldo });

        try {
          await batch.commit();
        } catch (error) {
          console.error('Error deleting payment: ', error);
          showAlert('Error', 'No se pudo eliminar el abono.', 'error');
        }
      },
    );
  }

  function handleEditAbono(e) {
    const btn = e.currentTarget;
    const abonoId = btn.dataset.id;
    const ventaId = btn.dataset.ventaid;
    const monto = btn.dataset.monto;
    const metodo = btn.dataset.metodo;
    const fechaTimestamp = JSON.parse(btn.dataset.fecha);
    const fecha = new Date(fechaTimestamp.seconds * 1000);

    const abono = allAbonos.find((a) => a.id === abonoId);
    if (!abono || abono.cobradoPor !== auth.currentUser?.displayName) {
      showAlert(
        'Acceso Denegado',
        'No puedes editar abonos de otro vendedor.',
        'error',
      );
      return;
    }

    document.getElementById('editAbonoId').value = abonoId;
    document.getElementById('editAbonoVentaId').value = ventaId;
    document.getElementById('editAbonoOriginalMonto').value = monto;
    document.getElementById('editAbonoMonto').value = monto;
    document.getElementById('editAbonoMetodoPago').value = metodo;
    document.getElementById('editAbonoFecha').value = fecha
      .toISOString()
      .split('T')[0];

    showModal(document.getElementById('editAbonoModal'));
  }

  async function handleOpenAbonoCuenta(e) {
    const clienteId = e.currentTarget.dataset.id;
    const cliente = allClientes[clienteId];
    if (!cliente) return;

    const ventasCliente = localVentas.filter((v) => v.clienteId === clienteId);
    const saldoTotal = ventasCliente.reduce(
      (sum, venta) => sum + venta.saldo,
      0,
    );

    document.getElementById('abonoCuentaClienteId').value = clienteId;
    document.getElementById('abonoCuentaInfo').innerHTML = `
<b>Cliente:</b> ${cliente.nombre}<br>
<b>Saldo Total Pendiente:</b> <span class="font-bold text-red-600">${formatCurrency(saldoTotal)}</span>
`;
    document.getElementById('abonoCuentaForm').reset();
    showModal(document.getElementById('abonoCuentaModal'));
  }

  function getVentaGrupo(venta) {
    return localVentas.filter(
      (v) =>
        v.clienteId === venta.clienteId &&
        v.vendedor === venta.vendedor &&
        v.fecha.seconds === venta.fecha.seconds,
    );
  }

  async function handleGenerateVentaTicket(e) {
    const ventaId = e.currentTarget.closest('[data-id]').dataset.id;
    const venta = localVentas.find((v) => v.id === ventaId);
    if (!venta) return;
    const cliente = allClientes[venta.clienteId];
    if (!cliente) return;
    const grupo = getVentaGrupo(venta);
    await generateVentaTicketPDF(cliente, grupo);
  }

  function handleSendVentaWhatsapp(e) {
    const ventaId = e.currentTarget.closest('[data-id]').dataset.id;
    const venta = localVentas.find((v) => v.id === ventaId);
    if (!venta) return;
    const cliente = allClientes[venta.clienteId];
    if (!cliente) return;
    const grupo = getVentaGrupo(venta);
    const fechaVenta = new Date(venta.fecha.seconds * 1000).toLocaleDateString(
      'es-MX',
    );
    const vendedor = venta.vendedor || 'N/A';
    const detalles = grupo
      .map((v) => {
        const prod = allInventario[v.tenisId];
        const desc = prod ? `${prod.marca} ${prod.modelo}` : v.tenisId;
        return `- ${desc}: ${formatCurrency(v.precioPactado)}`;
      })
      .join('\n');
    const total = grupo.reduce((sum, v) => sum + v.precioPactado, 0);
    const msg = `Compra ${fechaVenta}\nVendedor: ${vendedor}\n${detalles}\nTotal: ${formatCurrency(
      total,
    )}`;
    const phone = cliente.telefono.replace(/\D/g, '');
    window.open(`https://wa.me/52${phone}?text=${encodeURIComponent(msg)}`);
  }

  async function handleOpenCobranzaModal(e) {
    const clienteId = e.currentTarget.dataset.id;
    if (!clienteId) return;

    const cliente = allClientes[clienteId];
    if (!cliente) return;

    const cobranzaModal = document.getElementById('cobranzaModal');
    cobranzaModal.dataset.clienteId = clienteId;

    const ventasCliente = localVentas.filter(
      (v) => v.clienteId === clienteId && v.saldo > 0,
    );
    if (ventasCliente.length === 0) {
      showAlert(
        'Sin Deudas',
        'Este cliente no tiene saldos pendientes.',
        'info',
      );
      return;
    }

    document.getElementById('cobranzaClientName').textContent = cliente.nombre;
    showModal(cobranzaModal);

    await generateCobranzaMessage(cliente, ventasCliente);
  }

  async function generateCobranzaMessage(cliente, ventas) {
    if (geminiApiKey === 'TU_API_KEY_AQUÍ' || !geminiApiKey) {
      showAlert(
        'Clave de API Faltante',
        'Por favor, añade tu clave de API de Gemini para usar esta función.',
        'warning',
      );
      return;
    }

    const loader = document.getElementById('cobranzaLoader');
    const messageTextarea = document.getElementById('cobranzaMessage');
    const regenerateBtn = document.getElementById('regenerateCobranzaBtn');

    loader.classList.remove('hidden');
    messageTextarea.value = 'Generando mensaje...';
    regenerateBtn.disabled = true;

    const saldoTotal = ventas.reduce((sum, v) => sum + v.saldo, 0);
    const detallesArticulos = ventas
      .map((v) => {
        const tenis = allInventario[v.tenisId];
        return `- ${tenis ? `${tenis.marca} ${tenis.modelo}` : 'Artículo desconocido'} (saldo: ${formatCurrency(v.saldo)})`;
      })
      .join('\n');

    const prompt = `Actúa como un asistente de cobranza para un negocio de venta de tenis, ropa y accesorios de moda. Escribe un mensaje de WhatsApp para el cliente "${cliente.nombre}". El mensaje debe ser en un tono amigable. El objetivo es recordarle amablemente sobre su saldo pendiente total de ${formatCurrency(saldoTotal)}. Menciona sutilmente los artículos que tiene pendientes de pago. Los artículos son:\n${detallesArticulos}\n\nRecordandole que puede realizar sus abonos mediante pagos en efectivo o transferencia bancaraia a la tarjeta BANORTE N° 4189 1430 5770 2998 a nomre de Carmen Reyes Nuñez. El mensaje debe ser conciso y no agresivo.`;

    try {
      let chatHistory = [{ role: 'user', parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.candidates && result.candidates[0].content.parts[0].text) {
        messageTextarea.value = result.candidates[0].content.parts[0].text;
      } else {
        messageTextarea.value =
          'No se pudo generar el mensaje. Por favor, inténtalo de nuevo.';
      }
    } catch (error) {
      console.error('Error con la API de Gemini:', error);
      messageTextarea.value = 'Error de conexión con la IA. Revisa la consola.';
    } finally {
      loader.classList.add('hidden');
      regenerateBtn.disabled = false;
    }
  }

  async function generateProductDescription() {
    if (geminiApiKey === 'TU_API_KEY_AQUÍ' || !geminiApiKey) {
      showAlert(
        'Clave de API Faltante',
        'Por favor, añade tu clave de API de Gemini para usar esta función.',
        'warning',
      );
      return;
    }

    const marca = document.getElementById('inventarioMarca').value;
    const modelo = document.getElementById('inventarioModelo').value;
    const estilo = document.getElementById('inventarioEstilo').value;
    const material = document.getElementById('inventarioMaterial').value;
    const genero = document.getElementById('inventarioGenero').value;
    const descTextarea = document.getElementById('inventarioDescripcion');

    if (!marca || !modelo) {
      showAlert(
        'Datos insuficientes',
        'Por favor, introduce al menos la marca y el modelo para generar una descripción.',
        'warning',
      );
      return;
    }

    descTextarea.value = 'Generando descripción con IA...';

    const prompt = `Eres un experto en marketing de calzado. Escribe una descripción de producto atractiva y vendedora para unos tenis con las siguientes características:\n- Marca: ${marca}\n- Modelo: ${modelo}\n- Estilo: ${estilo}\n- Material principal: ${material}\n- Género: ${genero}\n\nLa descripción debe ser breve (2-3 frases), resaltar los beneficios clave y usar un lenguaje que incite a la compra.`;

    try {
      let chatHistory = [{ role: 'user', parts: [{ text: prompt }] }];
      const payload = { contents: chatHistory };
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (result.candidates && result.candidates[0].content.parts[0].text) {
        descTextarea.value = result.candidates[0].content.parts[0].text;
      } else {
        descTextarea.value = 'No se pudo generar la descripción.';
      }
    } catch (error) {
      console.error('Error con la API de Gemini:', error);
      descTextarea.value = 'Error de conexión con la IA.';
    }
  }

  async function handleGenerateReport(e) {
    const clienteId = e.currentTarget.dataset.id;
    const cliente = allClientes[clienteId];
    if (!cliente) return;

    const ventasCliente = localVentas
      .filter((v) => v.clienteId === clienteId)
      .sort((a, b) => b.fecha.seconds - a.fecha.seconds);
    const abonosCliente = allAbonos.filter((a) =>
      ventasCliente.some((v) => v.id === a.ventaId),
    );

    let comprasHtml = '';
    let totalComprado = 0;
    let saldoPendienteTotal = 0;

    ventasCliente.forEach((venta) => {
      const tenis = allInventario[venta.tenisId];
      totalComprado += venta.precioPactado;
      saldoPendienteTotal += venta.saldo;

      const abonosVenta = abonosCliente
        .filter((a) => a.ventaId === venta.id)
        .sort((a, b) => a.fecha.seconds - b.fecha.seconds);
      let abonosHtml =
        '<tr><td colspan="4" style="text-align: center; color: #6b7280; padding: 8px;">No se han registrado abonos para esta compra.</td></tr>';

      if (abonosVenta.length > 0) {
        abonosHtml = abonosVenta
          .map(
            (abono) => `
<tr>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(abono.fecha)}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatCurrency(abono.monto)}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${abono.metodoPago}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${abono.cobradoPor}</td>
</tr>
`,
          )
          .join('');
      }

      comprasHtml += `
<div style="margin-bottom: 1.5rem; page-break-inside: avoid;">
<h3 style="font-size: 1.1rem; font-weight: 600; color: #1f2937; margin-bottom: 0.5rem;">Compra: ${tenis ? `${tenis.marca} ${tenis.modelo}` : 'Artículo no encontrado'}</h3>
<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
<thead style="background-color: #f9fafb;">
<tr>
<th style="padding: 8px; text-align: left;">Fecha de Venta</th>
<th style="padding: 8px; text-align: left;">Vendedor</th>
<th style="padding: 8px; text-align: right;">Precio Pactado</th>
<th style="padding: 8px; text-align: right; color: #dc2626;">Saldo Actual</th>
</tr>
</thead>
<tbody>
<tr>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatDate(venta.fecha)}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${venta.vendedor || 'N/A'}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatCurrency(venta.precioPactado)}</td>
<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold; color: #dc2626;">${formatCurrency(venta.saldo)}</td>
</tr>
</tbody>
</table>
<h4 style="font-size: 0.95rem; font-weight: 600; color: #374151; margin-top: 1rem; margin-bottom: 0.5rem;">Historial de Abonos para esta Compra:</h4>
<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
<thead style="background-color: #f9fafb;">
<tr>
<th style="padding: 8px; text-align: left;">Fecha del Abono</th>
<th style="padding: 8px; text-align: left;">Monto Abonado</th>
<th style="padding: 8px; text-align: left;">Método de Pago</th>
<th style="padding: 8px; text-align: left;">Cobrado por</th>
</tr>
</thead>
<tbody>
${abonosHtml}
</tbody>
</table>
</div>
`;
    });

    const fontStyles = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');</style>`;
    const reportHtml = `
${fontStyles}
<div style="font-family: 'Inter', sans-serif; padding: 2rem; color: #1f2937; background-color: #ffffff;">
<!-- Encabezado -->
<div style="display: flex; justify-content: space-between; align-items: start; border-bottom: 3px solid #d1d5db; padding-bottom: 1rem; margin-bottom: 2rem;">
<div style="text-align: left;">
<img src="logo.png" alt="Logo del Negocio" style="width: 140px; margin-bottom: 0.5rem;">
<p style="font-size: 0.85rem; color: #6b7280; line-height: 1.4;">
www.tenischidos.xyz<br>
Aguascalientes, Ags.<br>
carmen@tenischidos.xyz
</p>
</div>
<div style="text-align: right;">
<h1 style="margin: 0; font-size: 1.8rem; color: #111827;">Estado de Cuenta</h1>
<p style="margin: 0; font-size: 0.95rem; color: #4b5563;">Generado el: ${new Date().toLocaleDateString('es-MX')}</p>
</div>
</div>

<!-- Info Cliente -->
<h2 style="font-size: 1.3rem; font-weight: 600; color: #1f2937; margin-bottom: 0.8rem;">Información del Cliente</h2>
<table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; margin-bottom: 2rem;">
<thead style="background-color: #f3f4f6;">
<tr>
<th style="padding: 10px; text-align: left;">Cliente</th>
<th style="padding: 10px; text-align: left;">Teléfono</th>
</tr>
</thead>
<tbody>
<tr>
<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${cliente.nombre}</td>
<td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${formatPhoneNumber(cliente.telefono)}</td>                    
</tr>
${
  cliente.observaciones
    ? `
<tr>
<td colspan="2" style="padding: 10px; font-size: 0.88rem; color: #4b5563; background-color: #f9fafb;">
<strong>Observaciones:</strong> ${cliente.observaciones}
</td>
</tr>`
    : ''
}
</tbody>
</table>

<!-- Historial -->
<h2 style="font-size: 1.3rem; font-weight: 600; margin-bottom: 1rem;">Historial Detallado de Compras y Abonos</h2>
${comprasHtml}

<!-- Salto de página antes del resumen -->
<div style="page-break-before: always;"></div>

<!-- Resumen Financiero -->
<h2 style="font-size: 1.3rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem;">Resumen Financiero General</h2>
<table style="width: 60%; margin-left: auto; border-collapse: collapse; font-size: 1rem; background-color: #f9fafb;">
<tr>
<td style="padding: 12px; font-weight: 500;">Total Comprado:</td>
<td style="padding: 12px; text-align: right;">${formatCurrency(totalComprado)}</td>
</tr>
<tr style="border-top: 1px solid #e5e7eb;">
<td style="padding: 12px; font-weight: 500;">Total Abonado:</td>
<td style="padding: 12px; text-align: right;">${formatCurrency(totalComprado - saldoPendienteTotal)}</td>
</tr>
<tr style="background-color: #fee2e2;">
<td style="padding: 12px; font-weight: bold;">Saldo Pendiente Total:</td>
<td style="padding: 12px; text-align: right; font-weight: bold; color: #b91c1c;">${formatCurrency(saldoPendienteTotal)}</td>
</tr>
</table>

<!-- Footer -->
<div style="text-align: center; font-size: 0.85rem; color: #6b7280; border-top: 1px solid #d1d5db; padding-top: 1rem; margin-top: 3rem;">
<p>Gracias por su preferencia.</p>
</div>
</div>
`;

    await downloadPdfFromHtml(
      reportHtml,
      `Estado_de_Cuenta_${cliente.nombre.replace(/\s/g, '_')}.pdf`,
      'portrait',
      null,
    );
  }

  async function generateVentaTicketPDF(cliente, ventas) {
    const rows = ventas
      .map((v) => {
        const prod = allInventario[v.tenisId];
        const desc = prod
          ? `${prod.marca} ${prod.modelo} (SKU: ${prod.sku || 'N/A'})`
          : v.tenisId;
        return `<tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;word-break:break-word;">${desc}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${formatCurrency(v.precioPactado)}</td>
        </tr>`;
      })
      .join('');

    const total = ventas.reduce((sum, v) => sum + v.precioPactado, 0);
    const fechaVenta = ventas[0]?.fecha
      ? new Date(
          ventas[0].fecha.seconds
            ? ventas[0].fecha.seconds * 1000
            : ventas[0].fecha,
        ).toLocaleDateString('es-MX')
      : new Date().toLocaleDateString('es-MX');
    const vendedor = ventas[0]?.vendedor || 'N/A';

    const ticketHtml = `
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');</style>
    <div style="font-family:'Inter',sans-serif;padding:1rem;color:#1f2937;background:#ffffff;max-width:6.5in;margin:auto;box-sizing:border-box;text-align:center;">
      <div style="text-align:center;margin-bottom:1rem;">
        <img src="logo.png" alt="Logo" style="width:100px;margin:auto;" />
        <h1 style="margin:0;font-size:1.25rem;font-weight:600;">Ticket de Venta</h1>
      </div>
      <p><strong>Cliente:</strong> ${cliente.nombre} - ${formatPhoneNumber(cliente.telefono)}</p>
      <p><strong>Fecha:</strong> ${fechaVenta}</p>
      <p><strong>Vendedor:</strong> ${vendedor}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:1rem;font-size:0.9rem;">
        <thead style="background:#f9fafb;">
          <tr><th style="padding:8px;">Producto</th><th style="padding:8px;">Precio</th></tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="background:#f3f4f6;">
            <td style="padding:8px;font-weight:600;">Total</td>
            <td style="padding:8px;font-weight:600;">${formatCurrency(total)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="text-align:center;margin-top:2rem;font-size:0.85rem;color:#6b7280;">Gracias por su compra.</div>
    </div>
  `;

    await downloadPdfFromHtml(
      ticketHtml,
      `Ticket_${cliente.nombre.replace(/\s/g, '_')}.pdf`,
      'portrait',
      null,
    );
  }

  async function generateCatalogPDF() {
    const disponibles = localInventario.filter(
      (item) => item.status === 'disponible',
    );
    if (disponibles.length === 0) {
      showAlert(
        'Sin Productos',
        'No hay artículos disponibles para generar el catálogo.',
        'info',
      );
      return;
    }

    const grouped = {};
    disponibles.forEach((item) => {
      const cat = item.categoria || 'Otros';
      const gen = item.genero || 'General';
      if (!grouped[cat]) grouped[cat] = {};
      if (!grouped[cat][gen]) grouped[cat][gen] = [];
      grouped[cat][gen].push(item);
    });

    const today = new Date().toLocaleDateString('es-MX');
    const headerHtml = `
      <div style="text-align:center;margin-bottom:1rem;">
        <img src="logo.png" alt="Logo" style="width:120px;margin:auto;" />
        <h1 style="margin-top:0.5rem;font-size:1.5rem;font-weight:600;">Productos Disponibles</h1>
        <p style="margin:0;font-size:0.9rem;">${today}</p>
      </div>`;

    let catalogHtml = `
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');</style>
    <div style="font-family:'Inter',sans-serif;padding:1rem;color:#1f2937;">
    `;
    Object.keys(grouped).forEach((cat) => {
      catalogHtml += `<h2 style="font-size:1.3rem;margin-top:1rem;border-bottom:1px solid #e5e7eb;">${cat}</h2>`;
      const genders = grouped[cat];
      Object.keys(genders).forEach((gen) => {
        catalogHtml += `<h3 style="font-size:1.1rem;margin-top:0.5rem;">${gen}</h3><ul style="list-style:none;padding-left:0;">`;
        genders[gen].forEach((item) => {
          catalogHtml += `
          <li style="margin-bottom:0.7rem;border-bottom:1px dashed #d1d5db;padding-bottom:0.5rem;page-break-inside:avoid;display:flex;gap:0.5rem;align-items:center;">
            <img src="${item.foto || 'tenis_default.jpg'}" alt="${item.modelo}" style="width:80px;height:80px;object-fit:cover;border-radius:0.25rem;" />
            <div>
              <strong>${item.marca} ${item.modelo}</strong> (SKU: ${item.sku || 'N/A'})<br>
              Talla: ${item.talla} | Estilo: ${item.estilo || 'N/A'} | Material: ${item.material || 'N/A'}<br>
              Precio: ${formatCurrency(item.precio || 0)}
            </div>
          </li>`;
        });
        catalogHtml += '</ul>';
      });
    });
    catalogHtml += '</div>';

    await downloadPdfFromHtml(
      catalogHtml,
      `Catalogo_${new Date().toLocaleDateString('es-MX')}.pdf`,
      'portrait',
      headerHtml,
    );
  }

  async function handleDownloadCatalog() {
    await generateCatalogPDF();
  }

  // --- APP INITIALIZATION ---
  function initializeAppListeners(user) {
    unsubscribeAll();

    document.getElementById('tabs').addEventListener('click', (e) => {
      const button = e.target.closest('.tab-button');
      if (!button) return;
      document
        .getElementById('tabs')
        .querySelectorAll('.tab-button')
        .forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      document
        .getElementById('tab-content')
        .querySelectorAll('div[id$="-content"]')
        .forEach((content) => content.classList.add('hidden'));
      const tabName = button.dataset.tab;
      document.getElementById(`${tabName}-content`).classList.remove('hidden');
    });

    const cortesZContainer = document.getElementById('cortes-z-container');
    if (user && user.displayName === 'Carmen') {
      cortesZContainer.classList.remove('hidden');
    } else {
      cortesZContainer.classList.add('hidden');
    }

    const exportDataSection = document.getElementById('export-data-section');
    if (user && user.displayName === 'Juan Alfredo Cuellar Piedra') {
      exportDataSection.classList.remove('hidden');
    } else {
      exportDataSection.classList.add('hidden');
    }

    // Filter listeners
    [
      'filterMarca',
      'filterCategoria',
      'filterGenero',
      'filterTalla',
      'sortInventario',
      'searchInventario',
    ].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderInventario);
    });
    document
      .getElementById('clearInventoryFilters')
      .addEventListener('click', () => {
        document.getElementById('filterMarca').value = '';
        document.getElementById('filterCategoria').value = '';
        document.getElementById('filterGenero').value = '';
        document.getElementById('filterTalla').value = '';
        document.getElementById('sortInventario').value = 'reciente';
        document.getElementById('searchInventario').value = '';
        document
          .getElementById('clearSearchInventario')
          .classList.add('hidden');
        renderInventario();
      });
    [
      'filterCliente',
      'filterVendedor',
      'filterEstadoVenta',
      'sortVentas',
      'searchVentas',
    ].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderVentas);
    });
    document
      .getElementById('clearVentasFilters')
      .addEventListener('click', () => {
        document.getElementById('filterCliente').value = '';
        document.getElementById('filterVendedor').value = '';
        document.getElementById('filterEstadoVenta').value = '';
        document.getElementById('sortVentas').value = 'reciente';
        document.getElementById('searchVentas').value = '';
        document.getElementById('clearSearchVentas').classList.add('hidden');
        renderVentas();
      });
    document
      .getElementById('startDate')
      .addEventListener('change', renderFinancialSummaries);
    document
      .getElementById('endDate')
      .addEventListener('change', renderFinancialSummaries);
    document
      .getElementById('clearDateFilters')
      .addEventListener('click', () => {
        document.getElementById('startDate').value = '';
        document.getElementById('endDate').value = '';
        renderFinancialSummaries();
      });

    document
      .getElementById('inventarioFotoFile')
      .addEventListener('change', handleFotoUpload);

    async function handleFotoUpload(e) {
      const file = e.target.files[0];
      if (!file) return;
      const path = `inventario/${Date.now()}_${file.name}`;
      try {
        const ref = storageRef(storage, path);
        await uploadBytes(ref, file);
        const url = await getDownloadURL(ref);
        uploadedFotoUrl = url;
      } catch (err) {
        console.error('Error uploading image: ', err);
        showAlert('Error', 'No se pudo subir la imagen.', 'error');
      }
    }

    // Form and Modal Listeners
    document
      .getElementById('inventarioForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('inventarioId').value;
        const skuValue = document
          .getElementById('inventarioSku')
          .value.toUpperCase();
        const numeroModelo = document
          .getElementById('inventarioNumeroModelo')
          .value.toUpperCase();

        if (skuValue) {
          const isDuplicate = localInventario.some(
            (item) =>
              item.sku && item.sku.toUpperCase() === skuValue && item.id !== id,
          );
          if (isDuplicate) {
            showAlert(
              'SKU Duplicado',
              'Ya existe un artículo con este código SKU.',
              'warning',
            );
            return;
          }
        }

        const data = {
          modelo: document
            .getElementById('inventarioModelo')
            .value.toUpperCase(),
          numeroModelo: numeroModelo,
          marca: document.getElementById('inventarioMarca').value.toUpperCase(),
          categoria: document.getElementById('inventarioCategoria').value,
          sku: skuValue,
          talla: document.getElementById('inventarioTalla').value.toUpperCase(),
          genero: document.getElementById('inventarioGenero').value,
          estilo: document.getElementById('inventarioEstilo').value,
          material: document.getElementById('inventarioMaterial').value,
          descripcion: document.getElementById('inventarioDescripcion').value,
          foto: uploadedFotoUrl,
          costo: parseFloat(document.getElementById('inventarioCosto').value),
          precio: parseFloat(document.getElementById('inventarioPrecio').value),
          descuentoActivo: document.getElementById('inventarioDescuentoActivo')
            .checked,
          porcentajeDescuento:
            parseFloat(
              document.getElementById('inventarioPorcentajeDescuento').value,
            ) || 0,
          status: 'disponible',
          fechaRegistro: Timestamp.now(),
        };
        if (data.descuentoActivo) {
          data.precioOferta = Number(
            (data.precio * (1 - data.porcentajeDescuento / 100)).toFixed(2),
          );
        } else {
          data.precioOferta = null;
        }
        const path = getSharedCollectionPath('inventario');
        try {
          if (id) {
            await setDoc(doc(db, path, id), data, { merge: true });
          } else {
            await addDoc(collection(db, path), data);
          }
          hideModal(document.getElementById('inventarioModal'));
        } catch (error) {
          console.error('Error saving inventory item: ', error);
          showAlert('Error', 'No se pudo guardar el artículo.', 'error');
        }
      });
    document
      .getElementById('clienteForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('clienteId').value;
        const data = {
          nombre: document.getElementById('clienteNombre').value.toUpperCase(),
          telefono: document
            .getElementById('clienteTelefono')
            .value.replace(/\D/g, ''),
          observaciones: document
            .getElementById('clienteObservaciones')
            .value.toUpperCase(),
        };
        const path = getSharedCollectionPath('clientes');
        try {
          if (id) {
            await setDoc(doc(db, path, id), data, { merge: true });
          } else {
            await addDoc(collection(db, path), data);
          }
          hideModal(document.getElementById('clienteModal'));
        } catch (error) {
          console.error('Error saving client: ', error);
          showAlert('Error', 'No se pudo guardar el cliente.', 'error');
        }
      });
    document
      .getElementById('ventaForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const clienteId = document.getElementById('ventaCliente').value;
        if (!clienteId || ventaItems.length === 0) {
          showAlert(
            'Datos incompletos',
            'Selecciona un cliente y al menos un producto.',
            'warning',
          );
          return;
        }
        const currentUser = auth.currentUser;
        if (!currentUser) {
          showAlert(
            'Error',
            'No se ha podido identificar al usuario. Por favor, recarga la página.',
            'error',
          );
          return;
        }

        const batch = writeBatch(db);
        const ventasCreadas = [];
        ventaItems.forEach((item) => {
          const ventaData = {
            clienteId,
            tenisId: item.id,
            precioPactado: item.precio,
            saldo: item.precio,
            fecha: new Date(),
            vendedor: currentUser.displayName,
            comisionPagada: false,
          };
          const ventaRef = doc(
            collection(db, getSharedCollectionPath('ventas')),
          );
          ventasCreadas.push({ data: ventaData });
          batch.set(ventaRef, ventaData);
          const inventarioRef = doc(
            db,
            getSharedCollectionPath('inventario'),
            item.id,
          );
          batch.update(inventarioRef, { status: 'vendido' });
        });

        try {
          await batch.commit();
          hideModal(document.getElementById('ventaModal'));
          showAlert('Éxito', 'Venta registrada correctamente.', 'success');
        } catch (error) {
          console.error('Error creating sale: ', error);
          showAlert('Error', 'No se pudo registrar la venta.', 'error');
        }
      });
    document
      .getElementById('editVentaForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editVentaId').value;
        const nuevoClienteId =
          document.getElementById('editVentaCliente').value;
        const nuevoPrecio = parseFloat(
          document.getElementById('editVentaPrecio').value,
        );
        const ventaOriginal = localVentas.find((v) => v.id === id);
        if (!ventaOriginal) {
          showAlert(
            'Error',
            'No se encontró la venta original para actualizar.',
            'error',
          );
          return;
        }
        if (ventaOriginal.vendedor !== auth.currentUser?.displayName) {
          showAlert(
            'Acceso Denegado',
            'No puedes modificar ventas de otro vendedor.',
            'error',
          );
          return;
        }
        const abonosAcumulados =
          ventaOriginal.precioPactado - ventaOriginal.saldo;
        const nuevoSaldo = nuevoPrecio - abonosAcumulados;
        if (nuevoSaldo < 0) {
          showAlert(
            'Precio inválido',
            'El nuevo precio no puede ser menor que el total ya abonado.',
            'warning',
          );
          return;
        }
        const ventaRef = doc(db, getSharedCollectionPath('ventas'), id);
        try {
          await updateDoc(ventaRef, {
            clienteId: nuevoClienteId,
            precioPactado: nuevoPrecio,
            saldo: nuevoSaldo,
          });
          hideModal(document.getElementById('editVentaModal'));
          showAlert(
            'Éxito',
            'La venta ha sido actualizada correctamente.',
            'success',
          );
        } catch (error) {
          console.error('Error updating sale: ', error);
          showAlert(
            'Error',
            'No se pudieron guardar los cambios en la venta.',
            'error',
          );
        }
      });
    document
      .getElementById('abonoForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const ventaId = document.getElementById('abonoVentaId').value;
        const monto = parseFloat(document.getElementById('abonoMonto').value);
        const metodoPago = document.getElementById('abonoMetodoPago').value;
        const currentUser = auth.currentUser;
        if (!monto || monto <= 0 || !metodoPago) {
          showAlert(
            'Datos incompletos',
            'Por favor, ingresa un monto válido y selecciona un método de pago.',
            'warning',
          );
          return;
        }
        const ventaRef = doc(db, getSharedCollectionPath('ventas'), ventaId);
        const ventaSnap = await getDoc(ventaRef);
        const venta = ventaSnap.data();
        if (monto > venta.saldo) {
          showAlert(
            'Monto Excedido',
            'El abono no puede ser mayor que el saldo pendiente.',
            'warning',
          );
          return;
        }
        const batch = writeBatch(db);
        const abonoRef = doc(collection(db, getSharedCollectionPath('abonos')));
        batch.set(abonoRef, {
          ventaId: ventaId,
          monto: monto,
          fecha: new Date(),
          metodoPago: metodoPago,
          estado: 'pendiente',
          enPosesionDe: currentUser.displayName,
          cobradoPor: currentUser.displayName,
        });
        batch.update(ventaRef, { saldo: venta.saldo - monto });
        try {
          await batch.commit();
          hideModal(document.getElementById('abonoModal'));
          showAlert('Éxito', 'Abono registrado correctamente.', 'success');
        } catch (error) {
          console.error('Error adding payment: ', error);
          showAlert('Error', 'No se pudo registrar el abono.', 'error');
        }
      });
    document
      .getElementById('editAbonoForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        const abonoId = document.getElementById('editAbonoId').value;
        const ventaId = document.getElementById('editAbonoVentaId').value;
        const originalMonto = parseFloat(
          document.getElementById('editAbonoOriginalMonto').value,
        );
        const nuevoMonto = parseFloat(
          document.getElementById('editAbonoMonto').value,
        );
        const nuevoMetodo = document.getElementById(
          'editAbonoMetodoPago',
        ).value;
        const nuevaFechaStr = document.getElementById('editAbonoFecha').value;
        if (!nuevoMonto || nuevoMonto <= 0 || !nuevaFechaStr) {
          showAlert(
            'Datos incompletos',
            'Asegúrate de que el monto y la fecha sean válidos.',
            'warning',
          );
          return;
        }
        const nuevaFecha = new Date(nuevaFechaStr);
        const userTimezoneOffset = nuevaFecha.getTimezoneOffset() * 60000;
        const correctedDate = new Date(
          nuevaFecha.getTime() + userTimezoneOffset,
        );
        const ventaRef = doc(db, getSharedCollectionPath('ventas'), ventaId);
        const abonoRef = doc(db, getSharedCollectionPath('abonos'), abonoId);
        const batch = writeBatch(db);
        try {
          const abonoOrig = allAbonos.find((a) => a.id === abonoId);
          if (
            !abonoOrig ||
            abonoOrig.cobradoPor !== auth.currentUser?.displayName
          ) {
            showAlert(
              'Acceso Denegado',
              'No puedes modificar abonos de otro vendedor.',
              'error',
            );
            return;
          }
          const ventaSnap = await getDoc(ventaRef);
          const ventaData = ventaSnap.data();
          const diferencia = nuevoMonto - originalMonto;
          const nuevoSaldo = ventaData.saldo - diferencia;
          if (nuevoSaldo < 0) {
            showAlert(
              'Monto Excedido',
              'El nuevo monto hace que el total pagado supere el precio de la venta. Por favor, ajústalo.',
              'warning',
            );
            return;
          }
          batch.update(abonoRef, {
            monto: nuevoMonto,
            metodoPago: nuevoMetodo,
            fecha: Timestamp.fromDate(correctedDate),
          });
          batch.update(ventaRef, { saldo: nuevoSaldo });
          await batch.commit();
          hideModal(document.getElementById('editAbonoModal'));
          if (
            !document.getElementById('abonoModal').classList.contains('hidden')
          ) {
            hideModal(document.getElementById('abonoModal'));
          }
          showAlert(
            'Éxito',
            'El abono ha sido actualizado correctamente.',
            'success',
          );
        } catch (error) {
          console.error('Error updating payment:', error);
          showAlert(
            'Error',
            'No se pudieron guardar los cambios en el abono.',
            'error',
          );
        }
      });
    document
      .getElementById('abonoCuentaForm')
      .addEventListener('submit', async (e) => {
        e.preventDefault();
        let montoTotalAbono = parseFloat(
          document.getElementById('abonoCuentaMonto').value,
        );
        const metodoPago = document.getElementById(
          'abonoCuentaMetodoPago',
        ).value;
        const clienteId = document.getElementById('abonoCuentaClienteId').value;
        const currentUser = auth.currentUser;
        if (!montoTotalAbono || montoTotalAbono <= 0 || !metodoPago) {
          showAlert(
            'Datos Incompletos',
            'Ingresa un monto y método de pago válidos.',
            'warning',
          );
          return;
        }
        const ventasPendientes = localVentas
          .filter((v) => v.clienteId === clienteId && v.saldo > 0)
          .sort((a, b) => a.fecha.seconds - b.fecha.seconds);
        if (ventasPendientes.length === 0) {
          showAlert(
            'Sin Deudas',
            'Este cliente no tiene saldos pendientes.',
            'info',
          );
          return;
        }
        const batch = writeBatch(db);
        for (const venta of ventasPendientes) {
          if (montoTotalAbono <= 0) break;
          const montoAAplicar = Math.min(montoTotalAbono, venta.saldo);
          const ventaRef = doc(db, getSharedCollectionPath('ventas'), venta.id);
          batch.update(ventaRef, { saldo: venta.saldo - montoAAplicar });
          const abonoRef = doc(
            collection(db, getSharedCollectionPath('abonos')),
          );
          batch.set(abonoRef, {
            ventaId: venta.id,
            monto: montoAAplicar,
            fecha: new Date(),
            metodoPago: metodoPago,
            estado: 'pendiente',
            enPosesionDe: currentUser.displayName,
            cobradoPor: currentUser.displayName,
          });
          montoTotalAbono -= montoAAplicar;
        }
        try {
          await batch.commit();
          hideModal(document.getElementById('abonoCuentaModal'));
          showAlert(
            'Éxito',
            'El abono a cuenta fue aplicado correctamente a las ventas más antiguas.',
            'success',
          );
        } catch (error) {
          console.error('Error applying global payment:', error);
          showAlert('Error', 'No se pudo aplicar el abono a cuenta.', 'error');
        }
      });
    document
      .getElementById('openVentaModalBtn')
      .addEventListener('click', () => {
        populateVentaModal();
        showModal(document.getElementById('ventaModal'));
      });
    document
      .getElementById('openClienteModalBtn')
      .addEventListener('click', () => {
        document.getElementById('clienteForm').reset();
        document.getElementById('clienteId').value = '';
        document.getElementById('clienteModalTitle').textContent =
          'Agregar Nuevo Cliente';
        showModal(document.getElementById('clienteModal'));
      });
    document
      .getElementById('openInventarioModalBtn')
      .addEventListener('click', () => {
        document.getElementById('inventarioForm').reset();
        document.getElementById('inventarioSku').value = '';
        document.getElementById('inventarioId').value = '';
        document.getElementById('inventarioCategoria').value = '';
        document.getElementById('inventarioDescuentoActivo').checked = false;
        document.getElementById('inventarioPorcentajeDescuento').value = '';
        uploadedFotoUrl = '';
        document.getElementById('inventarioModalTitle').textContent =
          'Agregar Producto al Inventario';
        showModal(document.getElementById('inventarioModal'));
      });
    document
      .getElementById('downloadCatalogBtn')
      .addEventListener('click', handleDownloadCatalog);
    document
      .getElementById('exportClientesBtn')
      .addEventListener('click', () =>
        exportArrayToCSV(localClientes, 'clientes.csv'),
      );
    document
      .getElementById('exportInventarioBtn')
      .addEventListener('click', () =>
        exportArrayToCSV(localInventario, 'inventario.csv'),
      );
    document
      .getElementById('exportVentasBtn')
      .addEventListener('click', () =>
        exportArrayToCSV(localVentas, 'ventas.csv'),
      );
    document
      .getElementById('exportAbonosBtn')
      .addEventListener('click', () =>
        exportArrayToCSV(allAbonos, 'abonos.csv'),
      );
    document
      .getElementById('updatePublicInventoryBtn')
      .addEventListener('click', updatePublicInventory);
    document
      .getElementById('backupDbBtn')
      .addEventListener('click', backupDatabase);
    document
      .getElementById('restoreDbBtn')
      .addEventListener('click', () =>
        document.getElementById('restoreFileInput').click(),
      );
    document
      .getElementById('restoreFileInput')
      .addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          restoreDatabase(file);
        }
        e.target.value = '';
      });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal:not(.hidden)');
        if (openModal) {
          hideModal(openModal);
        }
      }
    });
    document.querySelectorAll('.modal').forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal || e.target.closest('.closeModalBtn')) {
          hideModal(modal);
        }
      });
    });
    document
      .getElementById('generateDescBtn')
      .addEventListener('click', generateProductDescription);
    document
      .getElementById('productoSearch')
      .addEventListener('input', renderProductoResultados);
    setupClearableSearch('productoSearch', 'clearSearchProducto');
    document.getElementById('copyCobranzaBtn').addEventListener('click', () => {
      const messageTextarea = document.getElementById('cobranzaMessage');
      messageTextarea.select();
      document.execCommand('copy');
      showAlert('Copiado', 'Mensaje copiado al portapapeles.', 'success');
    });
    document
      .getElementById('regenerateCobranzaBtn')
      .addEventListener('click', () => {
        const cobranzaModal = document.getElementById('cobranzaModal');
        const clienteId = cobranzaModal.dataset.clienteId;
        const cliente = allClientes[clienteId];
        const ventasCliente = localVentas.filter(
          (v) => v.clienteId === clienteId && v.saldo > 0,
        );
        generateCobranzaMessage(cliente, ventasCliente);
      });

    // Firestore snapshot listeners
    const unsubClientes = onSnapshot(
      collection(db, getSharedCollectionPath('clientes')),
      (snapshot) => {
        localClientes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        allClientes = localClientes.reduce(
          (acc, c) => ({ ...acc, [c.id]: c }),
          {},
        );
        populateVentaFilters(localClientes, localVentas);
        renderClientes(localClientes);
        renderFinancialSummaries();
      },
    );
    const unsubInventario = onSnapshot(
      collection(db, getSharedCollectionPath('inventario')),
      (snapshot) => {
        localInventario = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        allInventario = localInventario.reduce(
          (acc, i) => ({ ...acc, [i.id]: i }),
          {},
        );
        populateInventoryFilters(localInventario);
        updateInventoryHeader(localInventario);
        renderInventario();
        renderFinancialSummaries();
      },
    );
    const unsubVentas = onSnapshot(
      collection(db, getSharedCollectionPath('ventas')),
      (snapshot) => {
        localVentas = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        populateVentaFilters(localClientes, localVentas);
        renderVentas();
        renderFinancialSummaries();
      },
    );
    const unsubAbonos = onSnapshot(
      collection(db, getSharedCollectionPath('abonos')),
      (snapshot) => {
        allAbonos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderFinancialSummaries();
      },
    );
    const unsubCortes = onSnapshot(
      collection(db, getSharedCollectionPath('cortes')),
      (snapshot) => {
        localCortes = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const cortesX = localCortes.filter((c) => c.type === 'Corte X');
        const cortesZ = localCortes.filter((c) => c.type === 'Corte Z');
        renderCortesXHistory(cortesX, user.displayName);
        if (user && user.displayName === 'Carmen') {
          renderCortesZHistory(cortesZ);
        }
      },
    );
    unsubscribeListeners.push(
      unsubClientes,
      unsubInventario,
      unsubVentas,
      unsubAbonos,
      unsubCortes,
    );
  }

  // Start authentication
  loginBtn.addEventListener('click', signInWithGoogle);
  try {
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, handleUserLogin);
  } catch (error) {
    console.error('Error crítico de Firebase:', error);
    showAlert(
      'Error Crítico',
      'No se pudo inicializar la sesión de Firebase.',
      'error',
    );
  }
});
