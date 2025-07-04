import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  initializeFirestore,
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
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});
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
let sortOrder = 'precio-desc';

// Set default sort selection
document.getElementById('sortSelect').value = sortOrder;

const INVENTORY_CACHE_KEY = 'inventoryCache';
const INVENTORY_CACHE_TS_KEY = 'inventoryCacheTime';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

function loadInventory() {
  const container = document.getElementById('productsContainer');
  container.innerHTML =
    '<p class="col-span-full text-center text-gray-500">Cargando...</p>';

  const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
  const cachedTime = localStorage.getItem(INVENTORY_CACHE_TS_KEY);
  const now = Date.now();
  const cacheValid =
    cached && cachedTime && now - Number(cachedTime) < CACHE_TTL_MS;
  if (cached) {
    try {
      allProducts = JSON.parse(cached);
      renderFilters(allProducts);
      renderCarousel(allProducts);
      applyFilters();
    } catch (err) {
      console.error('Error leyendo cache de inventario', err);
    }
  }

  if (cacheValid) return;

  const q = query(
    collection(db, 'negocio-tenis/shared_data/inventario'),
    where('status', '==', 'disponible'),
  );
  getDocs(q)
    .then((snap) => {
      allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(allProducts));
      localStorage.setItem(INVENTORY_CACHE_TS_KEY, String(now));
      renderFilters(allProducts);
      renderCarousel(allProducts);
      applyFilters();
    })
    .catch((err) => {
      console.error('Error cargando productos', err);
      if (!cached) {
        container.innerHTML =
          '<p class="col-span-full text-center text-gray-500">Error cargando productos</p>';
      }
    });
}

function renderFilters(products) {
  const container = document.getElementById('categoryFilters');
  container.innerHTML = '';

  currentCategory = '';

  const allBtn = document.createElement('button');
  allBtn.textContent = 'Todos';
  allBtn.dataset.cat = '';
  allBtn.className = 'cat-btn bg-indigo-600 text-white px-3 py-1 rounded-full';
  container.appendChild(allBtn);

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

function renderCarousel(products) {
  const container = document.getElementById('carouselContainer');
  const slides = document.getElementById('carouselSlides');
  slides.innerHTML = '';
  const valid = products.filter(
    (p) => p.foto && !p.foto.includes('tenis_default.jpg'),
  );
  if (valid.length === 0) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  valid.forEach((p) => {
    const slide = document.createElement('div');
    slide.className = 'relative w-full h-60 flex-shrink-0';

    const img = document.createElement('img');
    img.src = p.foto;
    img.alt = p.modelo;
    img.className = 'w-full h-full object-cover';
    slide.appendChild(img);

    const info = document.createElement('div');
    info.className =
      'absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1';
    const price = formatCurrency(p.precioOferta ?? p.precio);
    info.innerHTML = `
      <p><strong>${p.marca}</strong> ${p.modelo}</p>
      <p>SKU: ${p.sku || 'N/A'} | Talla: ${p.talla} | Género: ${p.genero || 'N/A'} | Precio: ${price}</p>
    `;
    slide.appendChild(info);

    slides.appendChild(slide);
  });
  let index = 0;
  function update() {
    slides.style.transform = `translateX(-${index * 100}%)`;
  }
  document.getElementById('carouselPrev').onclick = () => {
    index = (index - 1 + valid.length) % valid.length;
    update();
  };
  document.getElementById('carouselNext').onclick = () => {
    index = (index + 1) % valid.length;
    update();
  };
  update();
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
        )}</p>`
      : '';
    const mainPriceHtml = p.precioOferta
      ? `${formatCurrency(p.precioOferta)}`
      : `${formatCurrency(p.precio)}`;
    const priceDisplay = formatCurrency(p.precioOferta ?? p.precio);
    const waMsg = encodeURIComponent(
      `Hola, quisiera información sobre la disponibilidad del producto:\nModelo: ${
        p.modelo
      }\nMarca: ${p.marca}\nSKU: ${p.sku ?? 'N/A'}\nPrecio: ${priceDisplay}`,
    );
    const waLink = `https://wa.me/5214491952828?text=${waMsg}`;
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
      <div class="mt-2 flex items-center gap-2">
        <p class="text-indigo-600 font-bold">${mainPriceHtml}</p>
        <a href="${waLink}" target="_blank" class="text-green-600 hover:text-green-700" aria-label="Consultar disponibilidad">
          <i class="fab fa-whatsapp text-2xl"></i>
        </a>
      </div>
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
