import { firebaseConfig } from './config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

const app = initializeApp(firebaseConfig);
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
// Reduce cache TTL so public inventory refreshes quickly
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function showSkeleton(count = 8) {
  const container = document.getElementById('productsContainer');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className =
      'skeleton-card space-y-2 p-4 rounded-xl shadow animate-pulse';
    card.innerHTML = `
      <div class="h-40 w-full"></div>
      <div class="h-4 w-3/4"></div>
      <div class="h-4 w-1/2"></div>
    `;
    container.appendChild(card);
  }
}

function loadInventory() {
  const container = document.getElementById('productsContainer');
  showSkeleton();

  const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
  const cachedTime = localStorage.getItem(INVENTORY_CACHE_TS_KEY);
  const now = Date.now();
  const cacheValid =
    cached && cachedTime && now - Number(cachedTime) < CACHE_TTL_MS;
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      const hasFotos = parsed.some(
        (p) => p.foto && !p.foto.includes('tenis_default.jpg'),
      );
      if (hasFotos) {
        localStorage.removeItem(INVENTORY_CACHE_KEY);
        localStorage.removeItem(INVENTORY_CACHE_TS_KEY);
      } else {
        allProducts = parsed;
        renderFilters(allProducts);
        renderCarousel(allProducts);
        applyFilters();
      }
    } catch (err) {
      console.error('Error leyendo cache de inventario', err);
    }
  }

  if (cacheValid) return;

  fetch('inventory.json')
    .then((res) => {
      if (!res.ok) throw new Error('Fetch failed');
      return res.json();
    })
    .then((data) => {
      allProducts = data;
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
  allBtn.className =
    'cat-btn bg-indigo-600 text-white px-3 py-1 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500';
  container.appendChild(allBtn);

  const categories = Array.from(
    new Set(products.map((p) => p.categoria || 'Tenis')),
  );
  categories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.textContent = cat;
    btn.dataset.cat = cat;
    btn.className =
      'cat-btn bg-gray-200 text-gray-700 px-3 py-1 rounded-full hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500';
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
    slide.className = 'cover-slide w-3/4 sm:w-1/2 h-full';

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
    const elems = slides.children;
    for (let i = 0; i < elems.length; i++) {
      const offset = i - index;
      const abs = Math.abs(offset);
      const rotate = offset * -45;
      const translate = offset * 60;
      const scale = offset === 0 ? 1 : 0.7;
      const z = 100 - abs;
      elems[i].style.transform =
        `translateX(-50%) translateX(${translate}%) rotateY(${rotate}deg) scale(${scale})`;
      elems[i].style.zIndex = z;
      elems[i].style.opacity = abs > 3 ? 0 : 1;
    }
  }
  document.getElementById('carouselPrev').onclick = () => {
    index = (index - 1 + valid.length) % valid.length;
    update();
  };
  document.getElementById('carouselNext').onclick = () => {
    index = (index + 1) % valid.length;
    update();
  };
  setInterval(() => {
    index = (index + 1) % valid.length;
    update();
  }, 3000);
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
    card.className =
      'relative bg-white rounded-xl shadow hover:shadow-lg transition transform hover:-translate-y-1 p-4 flex flex-col';
    const computedOferta =
      p.precioOferta ??
      (p.descuentoActivo
        ? p.precio * (1 - (p.porcentajeDescuento || 0) / 100)
        : null);
    const ribbon =
      p.descuentoActivo || p.precioOferta
        ? '<span class="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">Descuento</span>'
        : '';
    const priceHtml = computedOferta
      ? `<p class="text-sm line-through text-gray-400">${formatCurrency(
          p.precio,
        )}</p>`
      : '';
    const mainPriceHtml = computedOferta
      ? `${formatCurrency(computedOferta)}`
      : `${formatCurrency(p.precio)}`;
    const priceDisplay = formatCurrency(computedOferta ?? p.precio);
    const waMsg = encodeURIComponent(
      `Hola, quisiera información sobre la disponibilidad del producto:\nModelo: ${
        p.modelo
      }\nMarca: ${p.marca}\nSKU: ${p.sku ?? 'N/A'}\nPrecio: ${priceDisplay}`,
    );
    const waLink = `https://wa.me/5214491952828?text=${waMsg}`;
    card.innerHTML = `
      ${ribbon}
      <img src="${
        p.foto || 'tenis_default.jpg'
      }" data-full="${p.foto || 'tenis_default.jpg'}" class="product-img w-full h-40 object-cover rounded cursor-pointer" onerror="this.onerror=null;this.src='tenis_default.jpg';" alt="${
        p.modelo
      }">
      <h3 class="mt-2 font-semibold">${p.marca} ${p.modelo}</h3>
      <p class="text-sm text-gray-500">SKU: ${p.sku || 'N/A'}</p>
      <p class="text-sm text-gray-500">Nº de Modelo: ${p.numeroModelo || 'N/A'}</p>
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

async function fetchImageWithProxy(url) {
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
}

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
  doc.querySelectorAll('style').forEach((el) => el.remove());
  doc.querySelectorAll('[style]').forEach((el) => {
    let cleaned = el.getAttribute('style').replace(/font-family:[^;]+;?/gi, '');
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
  const applyUnbreakable = (node) => {
    if (Array.isArray(node)) {
      node.forEach(applyUnbreakable);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node.pageBreakInside === 'avoid') {
      node.unbreakable = true;
    }
    if (node.stack) applyUnbreakable(node.stack);
    if (node.ul) applyUnbreakable(node.ul);
    if (node.ol) applyUnbreakable(node.ol);
    if (node.table && node.table.body) {
      node.table.body.forEach(applyUnbreakable);
    }
    if (node.columns) applyUnbreakable(node.columns);
  };
  applyUnbreakable(pdfContent);
  let header = undefined;
  if (headerHtml) {
    const processedHeader = await convertImagesToDataUrls(headerHtml);
    header = htmlToPdfmake(processedHeader, { window });
  }
  const docDefinition = {
    pageOrientation: orientation,
    pageMargins: [40, 120, 40, 60],
    content: pdfContent,
  };
  if (header) {
    docDefinition.header = header;
  }
  pdfMake.createPdf(docDefinition).download(filename);
};

async function generateCatalogPDF() {
  const disponibles = allProducts.filter(
    (item) => item.status === 'disponible',
  );
  if (disponibles.length === 0) {
    alert('No hay artículos disponibles para generar el catálogo.');
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

document
  .getElementById('downloadCatalogBtn')
  .addEventListener('click', handleDownloadCatalog);

loadInventory();
