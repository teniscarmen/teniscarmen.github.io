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

const INVENTORY_CACHE_KEY = 'inventoryCache';
const INVENTORY_CACHE_TS_KEY = 'inventoryCacheTime';
// Reduce cache TTL so public inventory refreshes quickly
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function showSkeleton(containerId, count = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const card = document.createElement('div');
    card.className =
      'skeleton-card carousel-item w-40 h-40 p-4 rounded-xl shadow animate-pulse';
    card.innerHTML = `<div class="w-full aspect-square"></div>`;
    container.appendChild(card);
  }
}

const priceValue = (p) => {
  if (p.precioOferta != null) return p.precioOferta;
  if (p.descuentoActivo)
    return p.precio * (1 - (p.porcentajeDescuento || 0) / 100);
  return p.precio;
};

function setupCarouselNav(containerId, itemCount) {
  const prev = document.querySelector(
    `[data-target="${containerId}"].carousel-prev`,
  );
  const next = document.querySelector(
    `[data-target="${containerId}"].carousel-next`,
  );
  const container = document.getElementById(containerId);
  if (!prev || !next || !container) return;
  if (itemCount <= 6) {
    prev.classList.add('hidden');
    next.classList.add('hidden');
  } else {
    prev.classList.remove('hidden');
    next.classList.remove('hidden');
    prev.onclick = () =>
      container.scrollBy({ left: -container.clientWidth, behavior: 'smooth' });
    next.onclick = () =>
      container.scrollBy({ left: container.clientWidth, behavior: 'smooth' });
  }
}

const carouselLoops = {};

function startInfiniteScroll(containerId, speed = 0.5) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (carouselLoops[containerId]) {
    cancelAnimationFrame(carouselLoops[containerId]);
  }
  const gap = parseFloat(getComputedStyle(container).gap) || 0;
  const step = speed;
  const move = () => {
    container.scrollLeft += step;
    const first = container.firstElementChild;
    if (first && container.scrollLeft >= first.offsetWidth + gap) {
      container.appendChild(first);
      container.scrollLeft -= first.offsetWidth + gap;
    }
    carouselLoops[containerId] = requestAnimationFrame(move);
  };
  move();
  container.addEventListener('mouseenter', () => {
    if (carouselLoops[containerId])
      cancelAnimationFrame(carouselLoops[containerId]);
  });
  container.addEventListener('mouseleave', () => {
    if (!carouselLoops[containerId]) move();
  });
}

function renderCarousel(containerId, products) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  if (products.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-500 w-full">Sin productos</p>';
    return;
  }
  products.forEach((p) => {
    const card = document.createElement('div');
    card.className =
      'carousel-item relative w-40 md:w-48 aspect-square flex-shrink-0 rounded-lg overflow-hidden cursor-pointer';
    const price = formatCurrency(priceValue(p));
    card.innerHTML = `
      <img src="${p.foto || 'tenis_default.jpg'}" data-full="${
        p.foto || 'tenis_default.jpg'
      }" data-info="${p.marca} ${p.modelo} - Talla ${p.talla} - ${price}" class="product-img w-full h-full object-cover" onerror="this.onerror=null;this.src='tenis_default.jpg';" alt="${p.modelo}">
      <div class="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-1 truncate">${p.marca} ${p.modelo} - ${price}</div>`;
    container.appendChild(card);
  });
  setupCarouselNav(containerId, products.length);
  startInfiniteScroll(containerId);
}

function renderCarousels() {
  const groups = {
    men: allProducts.filter(
      (p) => p.genero === 'Hombre' && p.categoria !== 'Accesorios',
    ),
    women: allProducts.filter(
      (p) => p.genero === 'Mujer' && p.categoria !== 'Accesorios',
    ),
    unisex: allProducts.filter(
      (p) => p.genero === 'Unisex' && p.categoria !== 'Accesorios',
    ),
    offers: allProducts.filter((p) => p.descuentoActivo),
    accessories: allProducts.filter((p) => p.categoria === 'Accesorios'),
  };

  const sorter = (a, b) => priceValue(b) - priceValue(a);

  renderCarousel('menCarousel', groups.men.sort(sorter));
  renderCarousel('womenCarousel', groups.women.sort(sorter));
  renderCarousel('unisexCarousel', groups.unisex.sort(sorter));
  renderCarousel('offersCarousel', groups.offers.sort(sorter));
  renderCarousel('accessoriesCarousel', groups.accessories.sort(sorter));
}

function loadInventory() {
  [
    'menCarousel',
    'womenCarousel',
    'unisexCarousel',
    'offersCarousel',
    'accessoriesCarousel',
  ].forEach((id) => showSkeleton(id));

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
        renderCarousels();
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
      renderCarousels();
    })
    .catch((err) => {
      console.error('Error cargando productos', err);
      if (!cached) {
        [
          'menCarousel',
          'womenCarousel',
          'unisexCarousel',
          'offersCarousel',
          'accessoriesCarousel',
        ].forEach((id) => {
          const c = document.getElementById(id);
          if (c)
            c.innerHTML =
              '<p class="text-center text-gray-500 w-full">Error cargando productos</p>';
        });
      }
    });
}

document.addEventListener('click', (e) => {
  const img = e.target.closest('.product-img');
  if (!img) return;
  const modal = document.getElementById('imageModal');
  modal.querySelector('img').src = img.dataset.full;
  modal.querySelector('#modalInfo').textContent = img.dataset.info || '';
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
        <p style="margin:0;font-size:1rem;font-weight:600;">www.tenischidos.xyz</p>
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
          <li style="margin:0 auto 0.7rem;width:80%;background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:0.75rem;page-break-inside:avoid;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="width:80px;vertical-align:top;">
                  <img src="${item.foto || 'tenis_default.jpg'}" alt="${item.modelo}" style="width:80px;height:80px;object-fit:cover;border-radius:0.5rem;" />
                </td>
                <td style="font-size:0.9rem;color:#374151;line-height:1.2;vertical-align:top;">
                  <div style="font-weight:600;">${item.marca} | ${item.modelo} | (SKU:${item.sku || 'N/A'})</div>
                  <div>N° de Modelo: ${item.numeroModelo || 'N/A'} | Talla: ${item.talla} | Material: ${item.material || 'N/A'} | Estilo: ${item.estilo || 'N/A'}</div>
                  <div style="font-weight:600;">Precio: ${formatCurrency(item.precio || 0)}</div>
                </td>
              </tr>
            </table>
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
