const PRODUCT_RENDER_LIMIT = 60;

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
      state.recommendedProducts = [];
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
    `<option value="">All Category</option>` +
    categories.map((c) => `<option value="${safeText(c)}">${safeText(c)}</option>`).join("");

  $("resistantFilter").innerHTML =
    `<option value="">All Resistant Types</option>` +
    resistantTypes.map((r) => `<option value="${safeText(r)}">${safeText(r)}</option>`).join("");

  buildPpeTypeAssessmentOptions(categories);
}

function buildPpeTypeAssessmentOptions(categories) {
  const group = $("ppeTypeGroup");
  if (!group) return;

  group.innerHTML = categories
    .map(
      (category) => `
        <label class="checkbox-pill">
          <input type="checkbox" value="${safeText(category)}" />
          <span>${safeText(category)}</span>
        </label>
      `
    )
    .join("");
}

function getCheckedValues(groupId) {
  const group = $(groupId);
  if (!group) return [];

  return Array.from(group.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value)
    .filter(Boolean);
}

const riskMap = {
  "Chemical": ["Chemical", "Liquid", "Acid", "Oil Resistant"],
  "Heat / Fire": ["Heat", "Flame", "Fire", "Welding"],
  "Impact / Mechanical": ["Impact", "Cut", "Puncture", "Mechanical"],
  "Dust / Respiratory": ["Dust", "Respiratory", "FFP", "Mask", "Respirator"],
  "Working at Height": ["Fall", "Height", "Harness", "Lanyard"]
};

const industryCategoryMap = {
  "Mining": ["Head", "Eye", "Hand", "Foot", "Respiratory", "Hearing", "Body"],
  "Oil & Gas": ["Body", "Hand", "Foot", "Eye", "Head", "Respiratory"],
  "Industrial": ["Hand", "Foot", "Eye", "Head", "Body", "Hearing"],
  "Hospitality": ["Body", "Foot", "Hand"],
  "Healthcare": ["Body", "Hand", "Respiratory", "Eye"],
  "Other": []
};

function getClientIndustry() {
  const input = $("industry");
  return input ? input.value : "";
}

function getRecommendedProducts(answers, products) {
  const selectedCategories = answers.categories || [];
  const selectedEnv = answers.environments || [];
  const selectedRisk = answers.risks || [];
  const priority = answers.priority;

  let filtered = [...products];

  if (selectedCategories.length > 0) {
    filtered = filtered.filter((p) =>
      selectedCategories.includes(p.category)
    );
  }

  if (selectedEnv.length > 0) {
    filtered = filtered.filter((p) => {
      const useCases = normalizeArray(p.use_case);

      return selectedEnv.some((env) => {
        if (env === "Outdoor") return useCases.includes("Oil & Gas") || useCases.includes("Mining");
        if (env === "Indoor") return useCases.includes("Industrial");
        if (env === "Hazardous Site") return useCases.includes("Oil & Gas") || useCases.includes("Mining");
        return false;
      });
    });
  }

  if (selectedRisk.length > 0) {
    filtered = filtered.filter((p) => {
      const resistant = normalizeArray(p.resistant_type);
      const category = String(p.category || "");
      const searchable = [
        p.code,
        p.name,
        p.highlight,
        p.standards,
        p.material_spec,
        ...resistant
      ].join(" ").toLowerCase();

      return selectedRisk.some((risk) => {
        if (risk === "Chemical") return searchable.includes("chemical");
        if (risk === "Heat / Fire") return searchable.includes("heat") || searchable.includes("flame") || searchable.includes("fire");
        if (risk === "Impact / Mechanical") return searchable.includes("impact") || searchable.includes("cut") || searchable.includes("puncture");
        if (risk === "Dust / Respiratory") return category === "Respiratory" || searchable.includes("dust") || searchable.includes("respirator") || searchable.includes("mask");
        if (risk === "Working at Height") return searchable.includes("fall") || searchable.includes("height") || searchable.includes("harness") || searchable.includes("lanyard");
        return false;
      });
    });
  }

  const sorted = filtered.map((p) => {
    let score = 0;

    if (priority === "Compliance" && p.standards) score += 5;
    if (priority === "Comfort" && String(p.highlight || "").toLowerCase().includes("comfort")) score += 5;
    if (priority === "Durability" && String(p.material_spec || "").toLowerCase().includes("durable")) score += 5;
    if (priority === "Cost Efficiency" && String(p.highlight || "").toLowerCase().includes("economy")) score += 5;

    return { ...p, score };
  });

  return sorted.sort((a, b) => b.score - a.score);
}

function applyRecommendation() {
  if (!state.assessment) {
    applyProductFilters();
    return;
  }

  const recommended = getRecommendedProducts(state.assessment, state.products);

  state.recommendedProducts = recommended.length ? recommended : state.products;

  state.renderLimit =
    state.recommendedProducts.length > 150
      ? PRODUCT_RENDER_LIMIT
      : state.recommendedProducts.length;

  state.filteredProducts = state.recommendedProducts.slice(0, state.renderLimit);

  if ($("galleryTitle")) {
    $("galleryTitle").textContent = "Recommended PPE";
  }

  renderProductGrid();
}

function applyProductFilters() {
  const keyword = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const resistant = $("resistantFilter").value;

  state.recommendedProducts = [];
  state.renderLimit = PRODUCT_RENDER_LIMIT;

  state.filteredProducts = state.products.filter((p) => {
    const resistantList = normalizeArray(p.resistant_type);

    const searchable = [
      p.code,
      p.name,
      p.highlight
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!keyword || searchable.includes(keyword)) &&
      (!category || p.category === category) &&
      (!resistant || resistantList.includes(resistant))
    );
  });

  if ($("galleryTitle")) {
    $("galleryTitle").textContent = "Product Gallery";
  }

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

  const totalRecommended =
    state.recommendedProducts && state.recommendedProducts.length
      ? state.recommendedProducts.length
      : state.filteredProducts.length;

  const showingCount = state.filteredProducts.length;

  const hasLoadMore =
    state.recommendedProducts &&
    state.recommendedProducts.length > showingCount;

  grid.innerHTML = `
    <div class="result-summary">
      Showing ${showingCount} of ${totalRecommended} products
    </div>

    ${state.filteredProducts
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
              Evaluate Product
            </button>
          </article>
        `
      )
      .join("")}

    ${
      hasLoadMore
        ? `<button class="ghost-btn load-more-btn" onclick="loadMoreProducts()">Load More Products</button>`
        : ""
    }
  `;
}

function loadMoreProducts() {
  if (!state.recommendedProducts || !state.recommendedProducts.length) return;

  state.renderLimit += PRODUCT_RENDER_LIMIT;
  state.filteredProducts = state.recommendedProducts.slice(0, state.renderLimit);

  renderProductGrid();
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