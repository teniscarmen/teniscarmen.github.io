import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  onSnapshot,
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

let allProducts = [];
let currentCategory = '';
let searchTerm = '';
let sortOrder = '';

const INVENTORY_CACHE_KEY = 'inventoryCache';

function loadInventory() {
  const container = document.getElementById('productsContainer');
  container.innerHTML =
    '<p class="col-span-full text-center text-gray-500">Cargando...</p>';

  const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
  if (cached) {
    try {
      allProducts = JSON.parse(cached);
      renderFilters(allProducts);
      applyFilters();
    } catch (err) {
      console.error('Error leyendo cache de inventario', err);
    }
  }

  const q = query(
    collection(db, 'negocio-tenis/shared_data/inventario'),
    where('status', '==', 'disponible'),
  );
  onSnapshot(
    q,
    (snap) => {
      allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(allProducts));
      renderFilters(allProducts);
      applyFilters();
    },
    (err) => {
      console.error('Error cargando productos', err);
      if (!cached) {
        container.innerHTML =
          '<p class="col-span-full text-center text-gray-500">Error cargando productos</p>';
      }
    },
  );
}

function renderFilters(products) {
  const container = document.getElementById('categoryFilters');
  container.innerHTML = '';
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
  if (!container.dataset.listenerAttached) {
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-btn');
      if (!btn) return;
      container
        .querySelectorAll('.cat-btn')
        .forEach((b) => b.classList.remove('bg-indigo-600', 'text-white'));
      btn.classList.add('bg-indigo-600', 'text-white');
      currentCategory = btn.dataset.cat;
      applyFilters();
    });
    container.dataset.listenerAttached = 'true';
  }
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
      }" data-full="${p.foto || 'tenis_default.jpg'}" class="product-img w-full h-40 object-cover rounded cursor-pointer" onerror="this.onerror=null;this.src='tenis_default.jpg';" alt="${
        p.modelo
      }">
      <h3 class="mt-2 font-semibold">${p.marca} ${p.modelo}</h3>
      <p class="text-sm text-gray-500">SKU: ${p.sku || 'N/A'}</p>
      <p class="text-sm text-gray-500">Género: ${p.genero || 'N/A'}</p>
      <p class="text-sm text-gray-500">Estilo: ${p.estilo || 'N/A'}</p>
      <p class="text-sm text-gray-500">Talla: ${p.talla}</p>
      ${priceHtml}
    `;
    container.appendChild(card);
  });
}

function applyFilters() {
  let filtered = allProducts;
  if (currentCategory) {
    filtered = filtered.filter(
      (p) => (p.categoria || 'Tenis') === currentCategory,
    );
  }
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        `${p.marca} ${p.modelo}`.toLowerCase().includes(term) ||
        (p.sku || '').toLowerCase().includes(term),
    );
  }
  if (sortOrder === 'precio-asc') {
    filtered = filtered.slice().sort((a, b) => {
      const pa = a.precioOferta ?? a.precio;
      const pb = b.precioOferta ?? b.precio;
      return pa - pb;
    });
  } else if (sortOrder === 'precio-desc') {
    filtered = filtered.slice().sort((a, b) => {
      const pa = a.precioOferta ?? a.precio;
      const pb = b.precioOferta ?? b.precio;
      return pb - pa;
    });
  }
  renderProducts(filtered);
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  applyFilters();
});

document.getElementById('sortSelect').addEventListener('change', (e) => {
  sortOrder = e.target.value;
  applyFilters();
});

document.getElementById('productsContainer').addEventListener('click', (e) => {
  const img = e.target.closest('.product-img');
  if (!img) return;
  const modal = document.getElementById('imageModal');
  modal.querySelector('img').src = img.dataset.full;
  modal.classList.remove('hidden');
});

document.getElementById('imageModal').addEventListener('click', () => {
  document.getElementById('imageModal').classList.add('hidden');
});

const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  if (window.scrollY > 100) scrollBtn.classList.remove('hidden');
  else scrollBtn.classList.add('hidden');
});
scrollBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

loadInventory();
