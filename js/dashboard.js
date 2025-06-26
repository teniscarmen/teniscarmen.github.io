import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(value);
}

document.addEventListener('DOMContentLoaded', async () => {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const ventasSnap = await getDocs(
    collection(db, 'negocio-tenis/shared_data/ventas'),
  );
  const ventas = ventasSnap.docs.map((doc) => doc.data());
  const abonosSnap = await getDocs(
    collection(db, 'negocio-tenis/shared_data/abonos'),
  );
  const abonos = abonosSnap.docs.map((doc) => doc.data());

  const totalVentas = ventas.reduce(
    (sum, v) => sum + (v.precioPactado || 0),
    0,
  );
  const totalAbonos = abonos.reduce((sum, a) => sum + (a.monto || 0), 0);
  const saldoGlobal = ventas.reduce((sum, v) => sum + (v.saldo || 0), 0);

  document.getElementById('kpi-ventas').textContent =
    formatCurrency(totalVentas);
  document.getElementById('kpi-abonos').textContent =
    formatCurrency(totalAbonos);
  document.getElementById('kpi-saldo').textContent =
    formatCurrency(saldoGlobal);

  const monthly = {};
  ventas.forEach((v) => {
    if (v.fecha && v.fecha.seconds) {
      const d = new Date(v.fecha.seconds * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + (v.precioPactado || 0);
    }
  });
  const labels = Object.keys(monthly).sort();
  const data = labels.map((l) => monthly[l]);

  new Chart(document.getElementById('ventasChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Ventas por mes',
          backgroundColor: '#4f46e5',
          data,
        },
      ],
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } },
    },
  });
});
