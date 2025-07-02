import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(
    amount,
  );

async function signIn() {
  try {
    await signInWithPopup(auth, provider);
    window.location.href = 'admin.html';
  } catch (err) {
    console.error('Error al iniciar sesión', err);
    alert('No se pudo iniciar sesión');
  }
}

document.getElementById('loginPublicBtn').addEventListener('click', signIn);

async function loadInventory() {
  const q = query(
    collection(db, 'negocio-tenis/shared_data/inventario'),
    where('status', '==', 'disponible'),
  );
  const snap = await getDocs(q);
  const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderFilters(products);
  renderProducts(products);
}

function renderFilters(products) {
  const container = document.getElementById('categoryFilters');
  const categories = Array.from(
    new Set(products.map((p) => p.categoria || 'Tenis')),
  );
  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.className =
      'cat-btn bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300';
    container.appendChild(btn);
  });
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-btn');
    if (!btn) return;
    container
      .querySelectorAll('.cat-btn')
      .forEach((b) => b.classList.remove('bg-indigo-600', 'text-white'));
    btn.classList.add('bg-indigo-600', 'text-white');
    const cat = btn.dataset.cat;
    const filtered = cat
      ? products.filter((p) => (p.categoria || 'Tenis') === cat)
      : products;
    renderProducts(filtered);
  });
}

function renderProducts(products) {
  const container = document.getElementById('productsContainer');
  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML =
      '<p class="col-span-full text-center text-gray-500">Sin productos</p>';
    return;
  }
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow p-4 flex flex-col';
    const priceHtml = p.precioOferta
      ? `<p class="text-sm line-through text-gray-400">${formatCurrency(
          p.precio,
        )}</p><p class="text-indigo-600 font-bold">${formatCurrency(
          p.precioOferta,
        )}</p>`
      : `<p class="text-indigo-600 font-bold">${formatCurrency(p.precio)}</p>`;
    card.innerHTML = `
      <img src="${
        p.foto || 'tenis_default.jpg'
      }" class="w-full h-40 object-cover rounded" onerror="this.onerror=null;this.src='tenis_default.jpg';" alt="${
        p.modelo
      }">
      <h3 class="mt-2 font-semibold">${p.marca} ${p.modelo}</h3>
      <p class="text-sm text-gray-500">${p.talla}</p>
      ${priceHtml}
    `;
    container.appendChild(card);
  });
}

loadInventory();
