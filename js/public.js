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

const INVENTORY_CACHE_KEY = 'inventoryCacheV2';
const INVENTORY_CACHE_TS_KEY = 'inventoryCacheTimeV2';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESULTS_PER_PAGE = 12;
const SUGGESTION_LIMIT = 6;
const GALERIA_BASE = 'https://teniscarmen.github.io/Galeria/';
const PLACEHOLDER_IMAGE = 'tenis_default.jpg';

const colorKeywords = {
  negro: 'Negro',
  black: 'Negro',
  blanco: 'Blanco',
  white: 'Blanco',
  gris: 'Gris',
  gray: 'Gris',
  plata: 'Plata',
  silver: 'Plata',
  dorado: 'Dorado',
  gold: 'Dorado',
  azul: 'Azul',
  blue: 'Azul',
  rojo: 'Rojo',
  red: 'Rojo',
  verde: 'Verde',
  green: 'Verde',
  amarillo: 'Amarillo',
  yellow: 'Amarillo',
  rosa: 'Rosa',
  pink: 'Rosa',
  morado: 'Morado',
  purple: 'Morado',
  naranja: 'Naranja',
  orange: 'Naranja',
  café: 'Café',
  cafe: 'Café',
  brown: 'Café',
  beige: 'Beige',
  crema: 'Beige',
  multicolor: 'Multicolor',
};

const state = {
  search: '',
  sort: 'relevance',
  page: 1,
  perPage: RESULTS_PER_PAGE,
  filters: {
    genero: new Set(),
    marca: new Set(),
    talla: new Set(),
    categoria: new Set(),
    color: new Set(),
  },
  priceMin: null,
  priceMax: null,
};

const elements = {
  header: document.querySelector('.pub-header'),
  searchInput: document.getElementById('searchInput'),
  searchStatus: document.getElementById('searchStatus'),
  searchSuggestions: document.getElementById('searchSuggestions'),
  clearSearch: document.getElementById('clearSearch'),
  sortSelect: document.getElementById('sortSelect'),
  productGrid: document.getElementById('productGrid'),
  pagination: document.getElementById('pagination'),
  resultsCount: document.getElementById('resultsCount'),
  openFilters: document.getElementById('openFilters'),
  closeFilters: document.getElementById('closeFilters'),
  filtersPanel: document.getElementById('filtersPanel'),
  resetFilters: document.getElementById('resetFilters'),
  applyFilters: document.getElementById('applyFilters'),
  priceMin: document.getElementById('priceMin'),
  priceMax: document.getElementById('priceMax'),
  filterContainers: {
    genero: document.getElementById('filterGenero'),
    marca: document.getElementById('filterMarca'),
    talla: document.getElementById('filterTalla'),
    categoria: document.getElementById('filterCategoria'),
    color: document.getElementById('filterColor'),
  },
  themeToggle: document.getElementById('themeToggle'),
  downloadCatalogBtn: document.getElementById('downloadCatalogBtn'),
  navWhatsapp: document.getElementById('navWhatsappBtn'),
  heroPrimary: document.getElementById('heroPrimaryCta'),
  heroWhatsapp: document.getElementById('heroWhatsapp'),
  productModal: document.getElementById('productModal'),
  modalMainImage: document.getElementById('modalMainImage'),
  modalThumbnails: document.getElementById('modalThumbnails'),
  modalBreadcrumb: document.getElementById('modalBreadcrumb'),
  modalTitle: document.getElementById('productModalTitle'),
  modalDescription: document.getElementById('modalDescription'),
  modalPrice: document.getElementById('modalPrice'),
  modalComparePrice: document.getElementById('modalComparePrice'),
  modalDiscountBadge: document.getElementById('modalDiscountBadge'),
  modalBenefits: document.getElementById('modalBenefits'),
  modalSizes: document.getElementById('modalSizes'),
  modalDetails: document.getElementById('modalDetails'),
  modalRecommendations: document.getElementById('modalRecommendations'),
  closeProductModal: document.getElementById('closeProductModal'),
  addToCartAction: document.getElementById('addToCartAction'),
  whatsappAction: document.getElementById('whatsappAction'),
  sizeGuideBtn: document.getElementById('sizeGuideBtn'),
  sizeGuideModal: document.getElementById('sizeGuideModal'),
  closeSizeGuide: document.getElementById('closeSizeGuide'),
  sizeGuideTable: document.getElementById('sizeGuideTable'),
  toast: document.getElementById('toast'),
  structuredData: document.getElementById('structuredData'),
};

let rawProducts = [];
/** @type {any[]} */
let decoratedProducts = [];
let filteredProducts = [];
let priceBounds = { min: 0, max: 0 };
let activeProduct = null;

function extractStringsFromValue(value) {
  if (!value && value !== 0) return [];
  if (typeof value === 'string' || typeof value === 'number') {
    const stringValue = String(value).trim();
    return stringValue ? [stringValue] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractStringsFromValue(item));
  }
  if (typeof value === 'object') {
    const preferredKeys = ['url', 'src', 'image', 'foto', 'path', 'thumbnail', 'thumb'];
    for (const key of preferredKeys) {
      if (typeof value[key] === 'string' && value[key].trim()) {
        return [value[key]];
      }
    }
  }
  return [];
}

function normalizeImageString(input) {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  const withoutQuery = raw.replace(/\\/g, '/').split(/[?#]/)[0].trim();
  if (!withoutQuery) return null;

  const cleanedPath = withoutQuery
    .replace(/^(?:https?:)?\/\//i, '')
    .replace(/^\/+/, '');
  const path = cleanedPath;
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  let filename = segments[segments.length - 1];
  if (!filename) return null;
  if (filename.toLowerCase() === 'galeria') return null;

  try {
    filename = decodeURIComponent(filename);
  } catch (err) {
    // ignore decode errors and use raw filename
  }

  filename = filename.trim().replace(/[\\/]+/g, '');
  if (!filename) return null;

  if (filename.endsWith('.')) filename = filename.slice(0, -1);
  const dotIndex = filename.lastIndexOf('.');
  let base = filename;
  let extension = '';
  if (dotIndex > 0 && dotIndex < filename.length - 1) {
    base = filename.slice(0, dotIndex);
    extension = filename.slice(dotIndex + 1);
  }

  base = base.trim();
  extension = extension.trim().toLowerCase();
  if (!base) return null;
  if (!extension) extension = 'jpg';

  if (extension === 'jpeg' || extension === 'jpg') {
    // keep as is
  } else {
    extension = extension.toLowerCase();
  }

  const canonicalFile = `${base}.${extension}`;
  const lowerCanonical = canonicalFile.toLowerCase();
  if (lowerCanonical === 'tenis_default.jpg' || lowerCanonical === 'tenis_default.jpeg') {
    return null;
  }
  const encodedFile = encodeURIComponent(canonicalFile);
  const urls = [`${GALERIA_BASE}${encodedFile}`];

  const fallbackExtensions = new Set();
  if (extension === 'jpg') {
    fallbackExtensions.add('jpeg');
  } else if (extension === 'jpeg') {
    fallbackExtensions.add('jpg');
  } else {
    fallbackExtensions.add('jpg');
    fallbackExtensions.add('jpeg');
  }

  fallbackExtensions.forEach((ext) => {
    const altFile = `${base}.${ext}`;
    const altUrl = `${GALERIA_BASE}${encodeURIComponent(altFile)}`;
    if (!urls.includes(altUrl)) {
      urls.push(altUrl);
    }
  });

  return {
    url: urls[0],
    urls,
    fileName: canonicalFile,
  };
}

function dedupeInfos(infos) {
  const seen = new Set();
  const result = [];
  infos.forEach((info) => {
    if (!info) return;
    if (seen.has(info.url)) return;
    seen.add(info.url);
    result.push(info);
  });
  return result;
}

function buildProductImageSources(product) {
  const galleryValues = [
    ...extractStringsFromValue(product.images),
    ...extractStringsFromValue(product.galeria),
    ...extractStringsFromValue(product.gallery),
  ];
  const galleryInfos = dedupeInfos(galleryValues.map(normalizeImageString));

  const priorityValues = [
    ...extractStringsFromValue(product.images),
    ...extractStringsFromValue(product.image),
    ...extractStringsFromValue(product.img),
    ...extractStringsFromValue(product.photo),
    ...extractStringsFromValue(product.foto),
    ...extractStringsFromValue(product.thumbnail),
    ...extractStringsFromValue(product.thumb),
  ];
  const priorityInfos = dedupeInfos(priorityValues.map(normalizeImageString));

  let main = priorityInfos[0] || null;
  const combined = dedupeInfos([...galleryInfos, ...priorityInfos]);
  if (!main) {
    main = combined[0] || null;
  }

  return {
    main,
    gallery: combined,
  };
}

function normalizeProductImages(product) {
  const imageSources = buildProductImageSources(product);
  const galleryUrls = imageSources.gallery.map((entry) => entry.url);
  const normalized = {
    ...product,
    foto: imageSources.main ? imageSources.main.url : PLACEHOLDER_IMAGE,
    galeria: galleryUrls,
    imageSources,
  };
  return normalized;
}

function getProductSku(product) {
  return product.sku || product.uid || product.id || 'sin-sku';
}

function getGalleryInfos(product) {
  if (product.imageSources?.gallery?.length) return product.imageSources.gallery;
  if (product.imageSources?.main) return [product.imageSources.main];
  return [];
}

function setModalMainImage(product, imageInfo) {
  if (!elements.modalMainImage) return;
  elements.modalMainImage.alt = `${product.marca || ''} ${product.modelo || ''}`.trim();
  elements.modalMainImage.loading = 'eager';
  elements.modalMainImage.decoding = 'async';
  applyImageWithFallback(elements.modalMainImage, product, imageInfo);
}

function applyImageWithFallback(img, product, imageInfo) {
  if (!img) return;
  const candidates = Array.isArray(imageInfo?.urls) ? imageInfo.urls.filter(Boolean) : [];

  if (img.__fallbackHandler) {
    img.removeEventListener('error', img.__fallbackHandler);
  }
  if (img.__loadHandler) {
    img.removeEventListener('load', img.__loadHandler);
  }

  if (!candidates.length) {
    img.src = PLACEHOLDER_IMAGE;
    img.__fallbackHandler = null;
    img.__loadHandler = null;
    return;
  }

  let attempt = 0;
  const skuLabel = getProductSku(product);

  const handleLoad = () => {
    if (img.__fallbackHandler) {
      img.removeEventListener('error', img.__fallbackHandler);
      img.__fallbackHandler = null;
    }
    img.__loadHandler = null;
  };

  const tryNext = () => {
    if (attempt >= candidates.length) {
      if (img.__fallbackHandler) {
        img.removeEventListener('error', img.__fallbackHandler);
        img.__fallbackHandler = null;
      }
      img.__loadHandler = null;
      img.src = PLACEHOLDER_IMAGE;
      console.warn('[images] No se encontró imagen en Galeria para SKU', skuLabel, {
        intentos: candidates,
      });
      return;
    }
    const nextSrc = candidates[attempt];
    attempt += 1;
    if (img.src === nextSrc) return;
    img.src = nextSrc;
  };

  const handleError = () => {
    tryNext();
  };

  img.__fallbackHandler = handleError;
  img.__loadHandler = handleLoad;
  img.addEventListener('error', handleError);
  img.addEventListener('load', handleLoad, { once: true });
  tryNext();
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);

const priceValue = (product) => {
  if (typeof product.precioOferta === 'number') return product.precioOferta;
  if (product.descuentoActivo && typeof product.porcentajeDescuento === 'number') {
    return Math.round(product.precio * (1 - product.porcentajeDescuento / 100));
  }
  return product.precio;
};

function detectColors(product) {
  const text = [product.color, product.descripcion, product.modelo, product.material, product.estilo]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const found = new Set();
  Object.entries(colorKeywords).forEach(([keyword, label]) => {
    if (text.includes(keyword)) {
      found.add(label);
    }
  });
  if (found.size === 0) {
    found.add('Multicolor');
  }
  return Array.from(found);
}

function normalizeDate(fechaRegistro) {
  if (!fechaRegistro) return null;
  if (fechaRegistro.seconds) {
    return new Date(fechaRegistro.seconds * 1000 + Math.round(fechaRegistro.nanoseconds || 0) / 1e6);
  }
  if (typeof fechaRegistro === 'string' || typeof fechaRegistro === 'number') {
    return new Date(fechaRegistro);
  }
  return null;
}

function decorateProduct(product, index) {
  const price = priceValue(product);
  const comparePrice = product.precio || price;
  const discount = comparePrice > price ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
  const createdAt = normalizeDate(product.fechaRegistro) || new Date(Date.now() - index * 1000 * 60 * 60);
  const isNew = Date.now() - createdAt.getTime() <= 1000 * 60 * 60 * 24 * 30;
  const tags = [];
  if (product.status && product.status !== 'disponible') tags.push('Agotado');
  if (product.descuentoActivo || discount >= 10) tags.push('Rebaja');
  if (isNew) tags.push('Nuevo');
  const colors = detectColors(product);
  const searchText = [
    product.marca,
    product.modelo,
    product.descripcion,
    product.genero,
    product.talla,
    product.categoria,
    product.material,
    colors.join(' '),
    product.numeroModelo,
    product.sku,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return {
    ...product,
    uid: product.id || `product-${index}`,
    price,
    comparePrice,
    discount,
    createdAt,
    isNew,
    tags,
    colors,
    availability: product.status === 'disponible',
    searchText,
    brandLabel: (product.marca || '').toUpperCase(),
    sortMarca: (product.marca || '').toLowerCase(),
    sortCategoria: (product.categoria || '').toLowerCase(),
  };
}

function trackEvent(name, detail = {}) {
  const payload = { event: name, detail, timestamp: Date.now() };
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, detail);
  }
  const envMode =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.MODE
      ? import.meta.env.MODE
      : 'production';
  if (envMode !== 'production') {
    console.debug('[analytics]', payload);
  }
}

function showToast(message, variant = 'success') {
  if (!elements.toast) return;
  elements.toast.textContent = message;
  elements.toast.dataset.visible = 'true';
  elements.toast.classList.toggle('pub-toast--success', variant === 'success');
  elements.toast.classList.toggle('pub-toast--danger', variant === 'danger');
  setTimeout(() => {
    elements.toast.dataset.visible = 'false';
  }, 3000);
}

function signIn() {
  signInWithPopup(auth, provider)
    .then(() => {
      window.location.href = 'admin.html';
    })
    .catch((err) => {
      console.error('Error al iniciar sesión', err);
      alert('No se pudo iniciar sesión');
    });
}

const loginBtn = document.getElementById('loginPublicBtn');
if (loginBtn) {
  loginBtn.addEventListener('click', signIn);
}

function applyTheme(theme) {
  const target = theme || localStorage.getItem('pub-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = target || (prefersDark ? 'dark' : 'light');
  document.body.dataset.theme = resolved;
  localStorage.setItem('pub-theme', resolved);
  elements.themeToggle?.setAttribute('aria-label', `Cambiar a tema ${resolved === 'dark' ? 'claro' : 'oscuro'}`);
  if (elements.themeToggle) {
    elements.themeToggle.textContent = resolved === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const current = document.body.dataset.theme || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  trackEvent('theme_toggle', { theme: next });
}

elements.themeToggle?.addEventListener('click', toggleTheme);
applyTheme();

function handleScroll() {
  if (!elements.header) return;
  const scrolled = window.scrollY > 16;
  elements.header.dataset.scrolled = String(scrolled);
}

window.addEventListener('scroll', handleScroll);
handleScroll();

function initAnimations() {
  const animated = document.querySelectorAll('[data-animate="fade-up"]');
  if (!('IntersectionObserver' in window) || animated.length === 0) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.dataset.inView = 'true';
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 },
  );
  animated.forEach((el) => observer.observe(el));
}

initAnimations();

function renderSkeleton() {
  if (!elements.productGrid) return;
  elements.productGrid.innerHTML = '';
  const skeletonCount = state.perPage;
  for (let i = 0; i < skeletonCount; i += 1) {
    const card = document.createElement('article');
    card.className = 'PubCardProduct';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = `
      <div class="PubCardProduct__media pub-skeleton" style="height:100%"></div>
      <div class="pub-skeleton" style="height:16px;border-radius:8px"></div>
      <div class="pub-skeleton" style="height:12px;border-radius:8px"></div>
      <div class="pub-skeleton" style="height:32px;border-radius:12px"></div>
    `;
    elements.productGrid.appendChild(card);
  }
}

function createProductCard(product, globalIndex = 0) {
  const article = document.createElement('article');
  article.className = 'PubCardProduct';
  article.dataset.productId = product.uid;

  const media = document.createElement('div');
  media.className = 'PubCardProduct__media';
  const badgeStack = document.createElement('div');
  badgeStack.className = 'PubCardProduct__badge-stack';
  product.tags.forEach((tag) => {
    const badge = document.createElement('span');
    badge.className = 'pub-badge';
    if (tag === 'Rebaja') badge.classList.add('pub-badge--alert');
    if (tag === 'Agotado') badge.classList.add('pub-badge--alert');
    if (tag === 'Nuevo') badge.classList.add('pub-badge--success');
    badge.textContent = tag;
    badgeStack.appendChild(badge);
  });
  const img = document.createElement('img');
  img.alt = `${product.marca || ''} ${product.modelo || ''}`.trim();
  if (typeof globalIndex === 'number' && globalIndex < 8) {
    img.loading = 'eager';
    img.decoding = 'async';
  } else {
    img.loading = 'lazy';
    img.decoding = 'async';
  }
  img.width = 400;
  img.height = 400;
  applyImageWithFallback(img, product, product.imageSources?.main);
  media.appendChild(img);
  if (badgeStack.children.length) media.appendChild(badgeStack);

  const info = document.createElement('div');
  info.className = 'PubCardProduct__info';
  const title = document.createElement('h3');
  title.className = 'PubCardProduct__title';
  title.textContent = `${product.marca || ''} ${product.modelo || ''}`.trim();
  const meta = document.createElement('div');
  meta.className = 'PubCardProduct__meta';
  meta.textContent = `${product.genero || 'Unisex'} • ${product.material || 'Material premium'}`;

  const price = document.createElement('div');
  price.className = 'PubCardProduct__price';
  const priceCurrent = document.createElement('span');
  priceCurrent.className = 'PubCardProduct__price-current';
  priceCurrent.textContent = formatCurrency(product.price);
  price.appendChild(priceCurrent);
  if (product.comparePrice > product.price) {
    const priceCompare = document.createElement('span');
    priceCompare.className = 'PubCardProduct__price-compare';
    priceCompare.textContent = formatCurrency(product.comparePrice);
    price.appendChild(priceCompare);
  }

  const chips = document.createElement('div');
  chips.className = 'PubCardProduct__chips';
  const chipGenero = document.createElement('span');
  chipGenero.className = 'pub-chip';
  chipGenero.textContent = product.genero || 'Unisex';
  const chipTalla = document.createElement('span');
  chipTalla.className = 'pub-chip';
  chipTalla.textContent = `Talla ${product.talla || 'N/A'}`;
  const chipCategoria = document.createElement('span');
  chipCategoria.className = 'pub-chip';
  chipCategoria.textContent = product.categoria || 'Sneakers';
  chips.append(chipGenero, chipTalla, chipCategoria);

  const actions = document.createElement('div');
  actions.className = 'PubCardProduct__actions';
  const viewBtn = document.createElement('button');
  viewBtn.type = 'button';
  viewBtn.className = 'pub-button pub-button--primary';
  viewBtn.textContent = 'Ver detalles';
  const whatsappBtn = document.createElement('button');
  whatsappBtn.type = 'button';
  whatsappBtn.className = 'pub-button pub-button--secondary';
  whatsappBtn.textContent = 'Pedir por WhatsApp';
  actions.append(viewBtn, whatsappBtn);

  info.append(title, meta, price, chips, actions);
  article.append(media, info);

  const openModal = () => openProductModal(product);
  article.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('button')) return;
    openModal();
  });
  viewBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openModal();
  });
  whatsappBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    openWhatsApp(product);
  });
  return article;
}

function renderProducts() {
  if (!elements.productGrid) return;
  const start = (state.page - 1) * state.perPage;
  const end = start + state.perPage;
  const items = filteredProducts.slice(start, end);
  elements.productGrid.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No encontramos productos con los filtros seleccionados.';
    empty.className = 'pub-status';
    elements.productGrid.appendChild(empty);
    elements.pagination.innerHTML = '';
    updateStructuredData([]);
    return;
  }

  items.forEach((product, index) => {
    const globalIndex = start + index;
    elements.productGrid.appendChild(createProductCard(product, globalIndex));
  });
  renderPagination();
  updateStructuredData(items);
}

function renderPagination() {
  if (!elements.pagination) return;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / state.perPage));
  elements.pagination.innerHTML = '';
  if (totalPages <= 1) return;

  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(page);
    button.setAttribute('aria-label', `Ir a la página ${page}`);
    if (page === state.page) {
      button.setAttribute('aria-current', 'true');
    }
    button.addEventListener('click', () => {
      state.page = page;
      renderProducts();
      window.scrollTo({ top: elements.resultsCount?.offsetTop || 0, behavior: 'smooth' });
      trackEvent('pagination_change', { page });
    });
    elements.pagination.appendChild(button);
  }
}

function updateResultsCount() {
  if (!elements.resultsCount) return;
  const total = filteredProducts.length;
  const start = total === 0 ? 0 : (state.page - 1) * state.perPage + 1;
  const end = Math.min(total, state.page * state.perPage);
  elements.resultsCount.textContent = `${total === 0 ? '0' : `${start}-${end}`} de ${total} modelos disponibles`;
}

function productMatchesFilters(product) {
  const { filters, priceMin, priceMax } = state;
  if (filters.genero.size && !filters.genero.has(product.genero)) return false;
  if (filters.marca.size && !filters.marca.has(product.marca)) return false;
  if (filters.talla.size && !filters.talla.has(product.talla)) return false;
  if (filters.categoria.size && !filters.categoria.has(product.categoria)) return false;
  if (filters.color.size && !product.colors.some((color) => filters.color.has(color))) return false;
  if (priceMin != null && product.price < priceMin) return false;
  if (priceMax != null && product.price > priceMax) return false;
  return true;
}

function calcRelevance(product, query) {
  if (!query) return 0;
  const terms = query.split(/\s+/).filter(Boolean);
  let score = 0;
  const fields = [product.marca, product.modelo, product.genero, product.talla, product.categoria];
  terms.forEach((term) => {
    fields.forEach((field, idx) => {
      if (!field) return;
      const lower = String(field).toLowerCase();
      if (lower === term) score += 15 - idx * 2;
      else if (lower.startsWith(term)) score += 12 - idx * 2;
      else if (lower.includes(term)) score += 8 - idx * 2;
    });
    if (product.searchText.includes(term)) score += 4;
  });
  return score + (product.isNew ? 2 : 0);
}

function sortProducts(products) {
  const query = state.search.trim().toLowerCase();
  const withScore = products.map((product) => ({
    ...product,
    relevance: calcRelevance(product, query),
  }));

  const sorters = {
    relevance: (a, b) => {
      if (query) return b.relevance - a.relevance || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    },
    new: (a, b) => b.createdAt - a.createdAt,
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
  };
  const sorter = sorters[state.sort] || sorters.relevance;
  return withScore.sort(sorter);
}

function applyFiltersAndRender(resetPage = false) {
  if (resetPage) {
    state.page = 1;
  }
  const query = state.search.trim().toLowerCase();
  filteredProducts = decoratedProducts.filter((product) => {
    if (!productMatchesFilters(product)) return false;
    if (!query) return true;
    return product.searchText.includes(query);
  });
  filteredProducts = sortProducts(filteredProducts);
  updateResultsCount();
  renderProducts();
}

function renderFilterOptions() {
  const facets = {
    genero: new Map(),
    marca: new Map(),
    talla: new Map(),
    categoria: new Map(),
    color: new Map(),
  };
  decoratedProducts.forEach((product) => {
    facets.genero.set(product.genero, (facets.genero.get(product.genero) || 0) + 1);
    facets.marca.set(product.marca, (facets.marca.get(product.marca) || 0) + 1);
    facets.talla.set(product.talla, (facets.talla.get(product.talla) || 0) + 1);
    facets.categoria.set(product.categoria, (facets.categoria.get(product.categoria) || 0) + 1);
    product.colors.forEach((color) => {
      facets.color.set(color, (facets.color.get(color) || 0) + 1);
    });
  });

  Object.entries(facets).forEach(([facet, values]) => {
    const container = elements.filterContainers[facet];
    if (!container) return;
    const entries = Array.from(values.entries()).filter(([value]) => value);
    if (facet === 'talla') {
      entries.sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    } else {
      entries.sort((a, b) => a[0].toString().localeCompare(b[0].toString(), 'es'));
    }
    container.innerHTML = '';
    entries.forEach(([value, count]) => {
      const label = document.createElement('label');
      label.className = 'pub-filter-option';
      const wrapper = document.createElement('span');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = value;
      input.dataset.filter = facet;
      input.checked = state.filters[facet].has(value);
      wrapper.appendChild(input);
      const text = document.createElement('span');
      text.textContent = value;
      wrapper.appendChild(text);
      const countBadge = document.createElement('span');
      countBadge.className = 'pub-filter-count';
      countBadge.textContent = String(count);
      label.append(wrapper, countBadge);
      container.appendChild(label);
    });
  });
}

function handleFilterChange(event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  const facet = target.dataset.filter;
  if (!facet || !state.filters[facet]) return;
  if (target.checked) state.filters[facet].add(target.value);
  else state.filters[facet].delete(target.value);
  applyFiltersAndRender(true);
  trackEvent('filter_change', {
    facet,
    value: target.value,
    active: target.checked,
  });
}

Object.values(elements.filterContainers).forEach((container) => {
  container?.addEventListener('change', handleFilterChange);
});

elements.priceMin?.addEventListener('change', () => {
  const value = Number(elements.priceMin.value);
  state.priceMin = Number.isFinite(value) && value > 0 ? value : null;
  applyFiltersAndRender(true);
});

elements.priceMax?.addEventListener('change', () => {
  const value = Number(elements.priceMax.value);
  state.priceMax = Number.isFinite(value) && value > 0 ? value : null;
  applyFiltersAndRender(true);
});

elements.resetFilters?.addEventListener('click', () => {
  Object.values(state.filters).forEach((set) => set.clear());
  if (elements.priceMin) elements.priceMin.value = '';
  if (elements.priceMax) elements.priceMax.value = '';
  state.priceMin = null;
  state.priceMax = null;
  renderFilterOptions();
  applyFiltersAndRender(true);
  trackEvent('filters_reset');
});

elements.applyFilters?.addEventListener('click', () => {
  if (window.innerWidth < 1024) toggleFiltersPanel(false);
  trackEvent('filters_apply', {
    filters: Object.fromEntries(
      Object.entries(state.filters).map(([key, set]) => [key, Array.from(set)]),
    ),
  });
});

function toggleFiltersPanel(open) {
  if (!elements.filtersPanel) return;
  const isOpen =
    typeof open === 'boolean' ? open : elements.filtersPanel.dataset.open !== 'true';
  elements.filtersPanel.dataset.open = String(isOpen);
  elements.filtersPanel.setAttribute('aria-hidden', String(!isOpen));
  elements.openFilters?.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) {
    elements.filtersPanel.scrollTop = 0;
  }
}

elements.openFilters?.addEventListener('click', () => toggleFiltersPanel(true));
elements.closeFilters?.addEventListener('click', () => toggleFiltersPanel(false));

function syncFiltersAccessibility() {
  if (!elements.filtersPanel) return;
  const desktop = window.innerWidth >= 1024;
  if (desktop) {
    elements.filtersPanel.setAttribute('aria-hidden', 'false');
  } else if (elements.filtersPanel.dataset.open !== 'true') {
    elements.filtersPanel.setAttribute('aria-hidden', 'true');
  }
}

window.addEventListener('resize', syncFiltersAccessibility);
syncFiltersAccessibility();

function updateSearchSuggestions(query) {
  if (!elements.searchSuggestions) return;
  if (!query || query.length < 2) {
    elements.searchSuggestions.setAttribute('aria-expanded', 'false');
    elements.searchSuggestions.innerHTML = '';
    return;
  }
  const normalized = query.toLowerCase();
  const matches = decoratedProducts
    .filter((product) => product.searchText.includes(normalized))
    .slice(0, SUGGESTION_LIMIT);

  if (!matches.length) {
    elements.searchSuggestions.setAttribute('aria-expanded', 'false');
    elements.searchSuggestions.innerHTML = '';
    return;
  }

  elements.searchSuggestions.innerHTML = '';
  matches.forEach((product) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pub-suggestion-item';
    button.setAttribute('role', 'option');
    button.dataset.productId = product.uid;
    button.innerHTML = `
      <span>${product.marca || ''} ${product.modelo || ''}</span>
      <span class="pub-filter-count">${product.talla || ''}</span>
    `;
    button.addEventListener('click', () => {
      elements.searchInput.value = `${product.marca || ''} ${product.modelo || ''}`.trim();
      state.search = elements.searchInput.value;
      applyFiltersAndRender(true);
      updateSearchSuggestions('');
      openProductModal(product);
      trackEvent('search_suggestion_click', { productId: product.uid });
    });
    elements.searchSuggestions.appendChild(button);
  });
  elements.searchSuggestions.setAttribute('aria-expanded', 'true');
}

elements.searchInput?.addEventListener('input', (event) => {
  const value = event.target.value;
  state.search = value;
  updateSearchSuggestions(value.trim());
  applyFiltersAndRender(true);
  trackEvent('search_input', { query: value });
});

elements.clearSearch?.addEventListener('click', () => {
  state.search = '';
  if (elements.searchInput) elements.searchInput.value = '';
  updateSearchSuggestions('');
  applyFiltersAndRender(true);
});

elements.sortSelect?.addEventListener('change', (event) => {
  state.sort = event.target.value;
  applyFiltersAndRender(false);
  trackEvent('sort_change', { sort: state.sort });
});

document.addEventListener('click', (event) => {
  if (
    elements.searchSuggestions &&
    !elements.searchSuggestions.contains(event.target) &&
    event.target !== elements.searchInput
  ) {
    elements.searchSuggestions.setAttribute('aria-expanded', 'false');
  }
});

function openWhatsApp(product) {
  const base = 'https://wa.me/5214491952828';
  const text = encodeURIComponent(
    `Hola Tenis Chidos, me interesa el modelo ${product.marca || ''} ${product.modelo || ''} (SKU ${
      product.sku || 'N/A'
    }) en talla ${product.talla || 'disponible'}. ${window.location.href}#${product.uid}`,
  );
  window.open(`${base}?text=${text}`, '_blank', 'noopener');
  trackEvent('whatsapp_click', { productId: product.uid });
}

function populateModalBenefits(product) {
  if (!elements.modalBenefits) return;
  const benefits = [
    `Material: ${product.material || 'Premium'}`,
    `Categoría: ${product.categoria || 'Sneakers'}`,
    `Género: ${product.genero || 'Unisex'}`,
    `Colores: ${product.colors.join(', ')}`,
  ];
  elements.modalBenefits.innerHTML = '';
  benefits.forEach((benefit) => {
    const item = document.createElement('div');
    item.className = 'pub-info-item';
    item.innerHTML = `<span aria-hidden="true">✨</span><span>${benefit}</span>`;
    elements.modalBenefits.appendChild(item);
  });
}

function populateModalSizes(product) {
  if (!elements.modalSizes) return;
  elements.modalSizes.innerHTML = '';
  const size = document.createElement('span');
  size.className = 'pub-size-option';
  size.textContent = `MX ${product.talla || 'N/A'}`;
  elements.modalSizes.appendChild(size);
}

function populateModalThumbnails(product) {
  if (!elements.modalThumbnails || !elements.modalMainImage) return;
  elements.modalThumbnails.innerHTML = '';
  const galleryInfos = getGalleryInfos(product);
  const sources = galleryInfos.length ? galleryInfos : [null];
  sources.forEach((info, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pub-modal__thumb';
    button.dataset.active = index === 0 ? 'true' : 'false';
    const img = document.createElement('img');
    img.alt = `${product.marca || ''} ${product.modelo || ''}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    applyImageWithFallback(img, product, info);
    button.appendChild(img);
    button.addEventListener('click', () => {
      Array.from(elements.modalThumbnails.children).forEach((child) => {
        child.dataset.active = 'false';
      });
      button.dataset.active = 'true';
      setModalMainImage(product, info);
    });
    elements.modalThumbnails.appendChild(button);
  });
  setModalMainImage(product, sources[0]);
}

function populateRecommendations(product) {
  if (!elements.modalRecommendations) return;
  const related = decoratedProducts
    .filter((p) => p.uid !== product.uid && p.categoria === product.categoria)
    .slice(0, 4);
  elements.modalRecommendations.innerHTML = '';
  related.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pub-suggestion-item';
    button.innerHTML = `
      <span>${item.marca || ''} ${item.modelo || ''}</span>
      <span class="pub-filter-count">${formatCurrency(item.price)}</span>
    `;
    button.addEventListener('click', () => {
      openProductModal(item);
      trackEvent('recommendation_click', { productId: item.uid });
    });
    elements.modalRecommendations.appendChild(button);
  });
}

function updateStructuredData(items) {
  if (!elements.structuredData) return;
  const baseUrl = window.location.origin + window.location.pathname;
  const json = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catálogo Tenis Chidos',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: (state.page - 1) * state.perPage + index + 1,
      item: {
        '@type': 'Product',
        name: `${item.marca || ''} ${item.modelo || ''}`.trim(),
        image: item.foto || 'https://teniscarmen.github.io/tenis_default.jpg',
        description: item.descripcion || 'Sneakers y streetwear verificados por Tenis Chidos.',
        sku: item.sku || item.uid,
        brand: {
          '@type': 'Brand',
          name: item.marca || 'Tenis Chidos',
        },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'MXN',
          price: item.price,
          availability: item.availability
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: `${baseUrl}#${item.uid}`,
        },
      },
    })),
  };
  elements.structuredData.textContent = JSON.stringify(json, null, 2);
}

function openProductModal(product) {
  activeProduct = product;
  if (!elements.productModal) return;
  elements.productModal.dataset.open = 'true';
  elements.productModal.setAttribute('aria-hidden', 'false');
  elements.productModal.focus?.();
  elements.modalBreadcrumb.textContent = `${product.marca || ''} ${product.modelo || ''}`.trim();
  elements.modalTitle.textContent = `${product.marca || ''} ${product.modelo || ''}`.trim();
  elements.modalDescription.textContent = product.descripcion || 'Sin descripción disponible.';
  elements.modalPrice.textContent = formatCurrency(product.price);
  if (product.comparePrice > product.price) {
    elements.modalComparePrice.textContent = formatCurrency(product.comparePrice);
    elements.modalDiscountBadge.hidden = false;
  } else {
    elements.modalComparePrice.textContent = '';
    elements.modalDiscountBadge.hidden = true;
  }
  populateModalSizes(product);
  populateModalBenefits(product);
  populateModalThumbnails(product);
  elements.modalDetails.textContent = `SKU ${product.sku || 'N/D'} • Material ${
    product.material || 'Premium'
  } • Modelo ${product.numeroModelo || 'Especial'}`;
  populateRecommendations(product);
  trackEvent('product_view', { productId: product.uid });
}

function closeProductModal() {
  if (!elements.productModal) return;
  elements.productModal.dataset.open = 'false';
  elements.productModal.setAttribute('aria-hidden', 'true');
  activeProduct = null;
}

elements.productModal?.addEventListener('click', (event) => {
  if (event.target === elements.productModal) {
    closeProductModal();
  }
});

elements.closeProductModal?.addEventListener('click', closeProductModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (elements.productModal?.dataset.open === 'true') closeProductModal();
    if (elements.sizeGuideModal?.dataset.open === 'true') toggleSizeGuide(false);
  }
});

elements.addToCartAction?.addEventListener('click', () => {
  if (!activeProduct) return;
  showToast('Producto agregado al carrito (simulado).');
  trackEvent('add_to_cart', { productId: activeProduct.uid });
});

elements.whatsappAction?.addEventListener('click', () => {
  if (!activeProduct) return;
  openWhatsApp(activeProduct);
});

const sizeGuide = [
  { mx: '23', usM: '5', usW: '6.5', cm: '23' },
  { mx: '24', usM: '6', usW: '7.5', cm: '24' },
  { mx: '25', usM: '7', usW: '8.5', cm: '25' },
  { mx: '26', usM: '8', usW: '9.5', cm: '26' },
  { mx: '27', usM: '9', usW: '10.5', cm: '27' },
  { mx: '28', usM: '10', usW: '11.5', cm: '28' },
  { mx: '29', usM: '11', usW: '12.5', cm: '29' },
];

if (elements.sizeGuideTable) {
  elements.sizeGuideTable.innerHTML = sizeGuide
    .map(
      (row) => `
      <tr>
        <td>${row.mx}</td>
        <td>${row.usM}</td>
        <td>${row.usW}</td>
        <td>${row.cm}</td>
      </tr>
    `,
    )
    .join('');
}

function toggleSizeGuide(open) {
  if (!elements.sizeGuideModal) return;
  const isOpen = typeof open === 'boolean' ? open : elements.sizeGuideModal.dataset.open !== 'true';
  elements.sizeGuideModal.dataset.open = String(isOpen);
  elements.sizeGuideModal.setAttribute('aria-hidden', String(!isOpen));
}

elements.sizeGuideBtn?.addEventListener('click', () => toggleSizeGuide(true));
elements.closeSizeGuide?.addEventListener('click', () => toggleSizeGuide(false));
elements.sizeGuideModal?.addEventListener('click', (event) => {
  if (event.target === elements.sizeGuideModal) toggleSizeGuide(false);
});

function updateNavLinks() {
  const links = document.querySelectorAll('.pub-nav-link');
  const { scrollY } = window;
  links.forEach((link) => {
    const hash = link.getAttribute('href');
    if (!hash || !hash.startsWith('#')) return;
    const section = document.querySelector(hash);
    if (!section) return;
    const offsetTop = section.getBoundingClientRect().top + window.scrollY - 100;
    const offsetBottom = offsetTop + section.offsetHeight;
    if (scrollY >= offsetTop && scrollY < offsetBottom) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

window.addEventListener('scroll', updateNavLinks);
updateNavLinks();

elements.heroPrimary?.addEventListener('click', () => trackEvent('hero_cta_click', { cta: 'catalogo' }));
elements.heroWhatsapp?.addEventListener('click', () => trackEvent('hero_cta_click', { cta: 'whatsapp' }));
elements.navWhatsapp?.addEventListener('click', () => trackEvent('nav_whatsapp_click'));

const copyright = document.getElementById('copyrightYear');
if (copyright) {
  copyright.textContent = String(new Date().getFullYear());
}

function refreshCache(now, data) {
  localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(INVENTORY_CACHE_TS_KEY, String(now));
}

function loadInventory() {
  renderSkeleton();
  const cached = localStorage.getItem(INVENTORY_CACHE_KEY);
  const cachedTime = localStorage.getItem(INVENTORY_CACHE_TS_KEY);
  const now = Date.now();
  const cacheValid = cached && cachedTime && now - Number(cachedTime) < CACHE_TTL_MS;

  if (cached && cacheValid) {
    try {
      rawProducts = JSON.parse(cached);
      afterInventoryLoaded(now, rawProducts, false);
    } catch (err) {
      console.error('Error leyendo cache de inventario', err);
      localStorage.removeItem(INVENTORY_CACHE_KEY);
      localStorage.removeItem(INVENTORY_CACHE_TS_KEY);
    }
  }

  fetch('inventory.json')
    .then((res) => {
      if (!res.ok) throw new Error('Fetch failed');
      return res.json();
    })
    .then((data) => {
      rawProducts = data;
      afterInventoryLoaded(now, data, true);
    })
    .catch((err) => {
      console.error('Error cargando productos', err);
      if (!cached && elements.resultsCount) {
        elements.resultsCount.textContent = 'No pudimos cargar el catálogo en este momento.';
      }
    });
}

function afterInventoryLoaded(timestamp, data, shouldRefreshCache) {
  const normalizedProducts = data.filter(Boolean).map(normalizeProductImages);
  decoratedProducts = normalizedProducts.map(decorateProduct);
  priceBounds = {
    min: Math.min(...decoratedProducts.map((product) => product.price)),
    max: Math.max(...decoratedProducts.map((product) => product.price)),
  };
  if (elements.priceMin) elements.priceMin.placeholder = String(priceBounds.min);
  if (elements.priceMax) elements.priceMax.placeholder = String(priceBounds.max);
  renderFilterOptions();
  applyFiltersAndRender(true);
  if (elements.searchStatus) {
    elements.searchStatus.textContent = `${decoratedProducts.length} modelos activos listos para envío.`;
  }
  if (shouldRefreshCache) refreshCache(timestamp, data);
  trackEvent('inventory_loaded', { total: decoratedProducts.length });
}

elements.downloadCatalogBtn?.addEventListener('click', generateCatalogPDF);

function generateCatalogPDF() {
  if (!decoratedProducts.length) {
    alert('Cargando inventario, intenta en unos segundos.');
    return;
  }
  const disponibles = decoratedProducts.filter((item) => item.status === 'disponible');
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
  let catalogHtml = `
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');</style>
    <div style="font-family:'Inter',sans-serif;padding:1rem;color:#1f2937;">
      <div style="text-align:center;margin-bottom:1rem;">
        <img src="logo.png" alt="Logo" style="width:120px;margin:auto;" />
        <p style="margin:0;font-size:1rem;font-weight:600;">www.tenischidos.xyz</p>
        <p style="margin:0;font-size:0.9rem;">${today}</p>
      </div>
  `;
  Object.keys(grouped).forEach((cat) => {
    catalogHtml += `<h2 style="font-size:1.3rem;margin-top:1rem;border-bottom:1px solid #e5e7eb;">${cat}</h2>`;
    const genders = grouped[cat];
    Object.keys(genders).forEach((gen) => {
      catalogHtml += `<h3 style="font-size:1.1rem;margin-top:0.5rem;">${gen}</h3><ul style="list-style:none;padding-left:0;">`;
      genders[gen].forEach((item) => {
        catalogHtml += `
          <li style="margin:0 auto 0.7rem;width:90%;background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;box-shadow:0 1px 2px rgba(0,0,0,0.05);padding:0.75rem;page-break-inside:avoid;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="width:90px;vertical-align:top;">
                  <img src="${item.foto || 'tenis_default.jpg'}" alt="${item.modelo}" style="width:90px;height:90px;object-fit:cover;border-radius:0.5rem;" />
                </td>
                <td style="font-size:0.9rem;color:#374151;line-height:1.4;vertical-align:top;padding-left:0.75rem;">
                  <div style="font-weight:600;">${item.marca} | ${item.modelo} | (SKU:${item.sku || 'N/A'})</div>
                  <div>Estilo: ${item.estilo || 'N/A'} | Talla: ${item.talla} | Material: ${item.material || 'N/A'}</div>
                  <div style="font-weight:600;">Precio: ${formatCurrency(item.price)}</div>
                </td>
              </tr>
            </table>
          </li>
        `;
      });
      catalogHtml += '</ul>';
    });
  });
  catalogHtml += '</div>';
  downloadPdfFromHtml(catalogHtml, `Catalogo_${today}.pdf`, 'portrait');
  trackEvent('catalog_download', { total: disponibles.length });
}

async function downloadPdfFromHtml(html, filename, orientation = 'portrait') {
  const processedHtml = await convertImagesToDataUrls(html);
  const pdfContent = htmlToPdfmake(processedHtml, { window });
  const docDefinition = {
    pageOrientation: orientation,
    pageMargins: [40, 60, 40, 40],
    content: pdfContent,
  };
  pdfMake.createPdf(docDefinition).download(filename);
}

async function convertImagesToDataUrls(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img');
  for (const img of imgs) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = resolve;
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      img.setAttribute('src', reader.result);
    } catch (err) {
      console.warn('No se pudo convertir imagen para PDF', src, err);
      img.remove();
    }
  }
  return doc.body.innerHTML;
}

loadInventory();
