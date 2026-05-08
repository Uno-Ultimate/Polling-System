function normalizeArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function renderBadges(value, className = "") {
  const items = normalizeArray(value);

  if (!items.length) return "";

  return items
    .map((item) => `<span class="badge ${className}">${safeText(item)}</span>`)
    .join("");
}

function displayList(value) {
  const items = normalizeArray(value);
  return items.length ? items.join(", ") : "-";
}

function getProductImages(product) {
  const images = [];

  function pushImage(value) {
    if (!value) return;

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        images.push(trimmed);
        return;
      }

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          pushImage(JSON.parse(trimmed));
        } catch (err) {
          console.warn("Invalid image JSON:", trimmed);
        }
        return;
      }

      if (trimmed.includes(",")) {
        trimmed.split(",").forEach((part) => pushImage(part));
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => pushImage(item));
      return;
    }

    if (typeof value === "object") {
      pushImage(value.url);
      pushImage(value.publicUrl);
      pushImage(value.public_url);
      pushImage(value.image_url);
      pushImage(value.src);
    }
  }

  pushImage(product.image_urls);
  pushImage(product.image_url);

  return [...new Set(images)];
}

function productInitial(product) {
  return safeText(product.code || product.category || "UNO").slice(0, 12);
}

function imageBlock(product, mode = "card") {
  const images = getProductImages(product);
  const imageUrl = images[0];

  if (imageUrl) {
    return `
      <div class="product-photo-frame ${mode}">
        <img
          src="${imageUrl}"
          alt="${safeText(product.name)}"
          loading="lazy"
          onerror="this.closest('.product-photo-frame').classList.add('empty'); this.remove();"
        />
        ${
          mode === "card" && images.length > 1
            ? `<div class="photo-count-badge">+${images.length - 1} images</div>`
            : ""
        }
      </div>
    `;
  }

  return `
    <div class="product-photo-frame ${mode} empty">
      <span>${productInitial(product)}</span>
    </div>
  `;
}

function productGalleryBlock(product) {
  const images = getProductImages(product);

  if (!images.length) {
    return `
      <div class="uno-product-media">
        <div class="product-photo-frame modal empty">
          <span>${productInitial(product)}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="uno-product-media">
      <div class="product-photo-frame modal">
        <img id="modalMainImage" src="${images[0]}" alt="${safeText(product.name)}" />
      </div>

      ${
        images.length > 1
          ? `
            <div class="modal-thumb-row">
              ${images
                .map(
                  (url, index) => `
                    <button
                      type="button"
                      class="modal-thumb ${index === 0 ? "active" : ""}"
                      data-image-url="${url}"
                      onclick="changeModalImageFromButton(this)"
                    >
                      <img src="${url}" alt="Product image ${index + 1}" />
                    </button>
                  `
                )
                .join("")}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function changeModalImageFromButton(button) {
  const mainImage = $("modalMainImage");
  if (!mainImage || !button) return;

  const url = button.dataset.imageUrl;
  if (!url) return;

  mainImage.src = url;

  document.querySelectorAll(".modal-thumb").forEach((thumb) => {
    thumb.classList.remove("active");
  });

  button.classList.add("active");
}

async function loadProducts() {
  const pageSize = 1000;
  let from = 0;
  let allProducts = [];
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseClient
      .from("products")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true })
      .order("code", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("LOAD PRODUCTS ERROR:", error);
      showToast("Failed to load products from database.");
      state.products = [];
      state.filteredProducts = [];
      renderProductGrid();
      return;
    }

    const rows = data || [];
    allProducts = allProducts.concat(rows);

    hasMore = rows.length === pageSize;
    from += pageSize;
  }

  state.products = allProducts;

  if (state.products.length === 0) {
    showToast("No products found. Please ensure data has been imported.");
  }

  buildFilters();
  applyProductFilters();
}

function buildFilters() {
  const categories = [
    ...new Set(state.products.map((p) => p.category).filter(Boolean))
  ].sort();

  const resistantTypes = [
    ...new Set(
      state.products
        .flatMap((p) => normalizeArray(p.resistant_type))
        .filter(Boolean)
    )
  ].sort();

  $("categoryFilter").innerHTML =
    `<option value="">All Categories</option>` +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("");

  $("resistantFilter").innerHTML =
    `<option value="">All Resistant Types</option>` +
    resistantTypes.map((r) => `<option value="${r}">${r}</option>`).join("");
}

function applyProductFilters() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const resistant = $("resistantFilter").value;

  state.filteredProducts = state.products.filter((p) => {
    const resistantList = normalizeArray(p.resistant_type);
    const useCaseList = normalizeArray(p.use_case);

    const searchable = [
      p.code,
      p.name,
      p.category,
      p.highlight,
      p.protection_level,
      ...resistantList,
      ...useCaseList
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchable.includes(keyword)) &&
      (!category || p.category === category) &&
      (!resistant || resistantList.includes(resistant))
    );
  });

  renderProductGrid();
}

function renderProductGrid() {
  const grid = $("productGrid");

  if (!state.filteredProducts.length) {
    grid.innerHTML = `
      <div class="table-card">
        <h2>No products found</h2>
        <p>Try adjusting your search keyword or filters.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = state.filteredProducts
    .map(
      (p) => `
        <article class="product-card">
          ${imageBlock(p, "card")}

          <div class="badge-row">
            <span class="badge">${safeText(p.code)}</span>
            <span class="badge aqua">${safeText(p.category)}</span>
            ${renderBadges(p.resistant_type, "yellow")}
          </div>

          <h3>${safeText(p.name)}</h3>
          <p>${safeText(p.highlight || displayList(p.use_case))}</p>

          <button class="primary-btn" onclick="openProductModal('${p.id}')">
            View Details & Respond
          </button>
        </article>
      `
    )
    .join("");
}

function openProductModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  state.selectedProduct = product;

  $("modalProductContent").innerHTML = `
    <section class="uno-product-detail-card">
      <div class="uno-product-detail-layout">
        ${productGalleryBlock(product)}

        <div class="uno-product-info">
          <div class="badge-row">
            <span class="badge">${safeText(product.code)}</span>
            <span class="badge aqua">${safeText(product.category)}</span>
            ${renderBadges(product.resistant_type, "yellow")}
          </div>

          <h2>${safeText(product.name)}</h2>

          <div class="detail-list">
            <p><b>Use Case:</b> ${renderBadges(product.use_case, "aqua") || "-"}</p>
            <p><b>Protection Level:</b> ${safeText(product.protection_level)}</p>
            <p><b>Highlight:</b> ${safeText(product.highlight)}</p>
            <p><b>Standards:</b> ${safeText(product.standards)}</p>
            <p><b>Material / Spec:</b> ${safeText(product.material_spec)}</p>
            <p><b>Colour / Size:</b> ${safeText(product.colour_size)}</p>
            <p><b>Source Page:</b> ${safeText(product.source_page)}</p>
          </div>
        </div>
      </div>
    </section>
  `;

  $("respInterested").checked = false;
  $("respNeedSample").checked = false;
  $("respNeedQuotation").checked = false;
  $("respExpectedPrice").value = "";
  $("respEstimatedVolume").value = "";
  $("respNotes").value = "";

  $("productModal").classList.add("active");
}

function closeProductModal() {
  $("productModal").classList.remove("active");
  state.selectedProduct = null;
}