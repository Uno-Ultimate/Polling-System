if (!state.productImages) {
  state.productImages = [];
}

state.masterOptions = {
  categories: [],
  useCases: [],
  protectionLevels: [],
  resistantTypes: []
};

function normalizeAdminArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function displayAdminList(value) {
  const items = normalizeAdminArray(value);
  return items.length ? items.join(", ") : "";
}

function fillSelectOptions(selectId, values, placeholder = null) {
  const select = $(selectId);
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = placeholder ? `<option value="">${placeholder}</option>` : "";

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = currentValue || "";
}

function fillCheckboxGroup(groupId, values, selectedValues = []) {
  const group = $(groupId);
  if (!group) return;

  const selected = normalizeAdminArray(selectedValues);

  group.innerHTML = values
    .map((value) => {
      const id = `${groupId}_${value.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const checked = selected.includes(value) ? "checked" : "";

      return `
        <label class="checkbox-pill" for="${id}">
          <input type="checkbox" id="${id}" value="${value}" ${checked} />
          <span>${value}</span>
        </label>
      `;
    })
    .join("");
}

function getCheckboxGroupValues(groupId) {
  const group = $(groupId);
  if (!group) return [];

  return Array.from(group.querySelectorAll("input[type='checkbox']:checked"))
    .map((input) => input.value.trim())
    .filter(Boolean);
}

async function loadMasterOptions() {
  const [
    categoriesResult,
    useCasesResult,
    protectionLevelsResult,
    resistantTypesResult
  ] = await Promise.all([
    supabaseClient.from("product_categories").select("name").eq("active", true).order("sort_order").order("name"),
    supabaseClient.from("product_use_cases").select("name").eq("active", true).order("sort_order").order("name"),
    supabaseClient.from("product_protection_levels").select("name").eq("active", true).order("sort_order").order("name"),
    supabaseClient.from("product_resistant_types").select("name").eq("active", true).order("sort_order").order("name")
  ]);

  if (categoriesResult.error) showToast("Failed to load product categories.");
  if (useCasesResult.error) showToast("Failed to load product use cases.");
  if (protectionLevelsResult.error) showToast("Failed to load protection levels.");
  if (resistantTypesResult.error) showToast("Failed to load resistant types.");

  state.masterOptions.categories = (categoriesResult.data || []).map((x) => x.name);
  state.masterOptions.useCases = (useCasesResult.data || []).map((x) => x.name);
  state.masterOptions.protectionLevels = (protectionLevelsResult.data || []).map((x) => x.name);
  state.masterOptions.resistantTypes = (resistantTypesResult.data || []).map((x) => x.name);

  populateProductDropdowns();
}

function populateProductDropdowns() {
  fillSelectOptions("productCategory", state.masterOptions.categories || [], "Select Category");
  fillSelectOptions("productProtectionLevel", state.masterOptions.protectionLevels || [], "Select Protection Level");

  fillCheckboxGroup("productUseCaseGroup", state.masterOptions.useCases || [], []);
  fillCheckboxGroup("productResistantTypeGroup", state.masterOptions.resistantTypes || [], []);
}

function adminGetProductImages(product) {
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
          console.warn("Invalid admin image JSON:", trimmed);
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

async function handleAdminLogin(event) {
  event.preventDefault();

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: $("adminEmail").value.trim(),
    password: $("adminPassword").value
  });

  if (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    showToast("Login failed: " + error.message);
    return;
  }

  state.currentUser = data.user;

  const { data: adminData, error: adminError } = await supabaseClient
    .from("admin_users")
    .select("id, email, role, active")
    .eq("email", state.currentUser.email)
    .eq("active", true)
    .single();

  if (adminError || !adminData) {
    await supabaseClient.auth.signOut();
    state.currentUser = null;
    showToast("This account is not authorized as a UNO admin.");
    return;
  }

  showPage("pageAdmin", "UNO Dashboard");
  await loadAdminDashboard();
}

async function logoutAdmin() {
  await supabaseClient.auth.signOut();
  state.currentUser = null;
  showPage("pageClientEntry", "Client Portal");
}

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });

  if (tabId === "productsAdmin") loadAdminProducts();
  if (tabId === "analysisAdmin") loadAnalysis();
  if (tabId === "clientsAdmin") loadClients();
}

async function loadAdminDashboard() {
  await loadMasterOptions();
  await loadAdminProducts();
  await loadAnalysis();
  await loadClients();
}

async function uploadSingleProductImage(file) {
  if (!file) return null;

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  if (!allowedTypes.includes(file.type)) {
    showToast("Image format must be JPG, PNG, WEBP, or GIF.");
    return null;
  }

  const maxSizeMb = 5;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    showToast(`Maximum image size is ${maxSizeMb}MB.`);
    return null;
  }

  const fileExt = file.name.split(".").pop().toLowerCase();
  const cleanName = file.name
    .replace(/\.[^/.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const randomId = Math.random().toString(36).slice(2, 10);
  const fileName = `${cleanName || "product"}-${Date.now()}-${randomId}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("product-images")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    console.error("UPLOAD IMAGE ERROR:", uploadError);
    showToast("Failed to upload image: " + uploadError.message);
    return null;
  }

  const { data } = supabaseClient.storage
    .from("product-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}

async function uploadMultipleProductImages(files) {
  const uploadedUrls = [];

  for (const file of files) {
    const url = await uploadSingleProductImage(file);
    if (url) uploadedUrls.push(url);
  }

  return uploadedUrls;
}

async function loadAdminProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LOAD ADMIN PRODUCTS ERROR:", error);
    showToast("Failed to load admin products.");
    return;
  }

  state.adminProducts = data || [];

  if (!state.masterOptions.categories.length) {
    await loadMasterOptions();
  } else {
    populateProductDropdowns();
  }

  renderAdminProductTable();
}

function renderAdminProductTable() {
  const keyword = $("adminProductSearch").value.trim().toLowerCase();

  const rows = state.adminProducts.filter((p) => {
    const searchable = [
      p.code,
      p.name,
      p.category,
      ...normalizeAdminArray(p.use_case),
      ...normalizeAdminArray(p.resistant_type),
      p.protection_level
    ]
      .join(" ")
      .toLowerCase();

    return !keyword || searchable.includes(keyword);
  });

  $("adminProductTable").innerHTML = rows
    .map((p) => {
      const imageUrl = adminGetProductImages(p)[0];

      return `
        <tr>
          <td>
            ${
              imageUrl
                ? `<img src="${imageUrl}" class="table-img" onerror="this.replaceWith(Object.assign(document.createElement('div'), {className:'table-img placeholder', textContent:'NO'}))" />`
                : `<div class="table-img placeholder">NO</div>`
            }
          </td>
          <td><b>${safeText(p.code)}</b></td>
          <td>${safeText(p.name)}</td>
          <td>${safeText(p.category)}</td>
          <td>${safeText(displayAdminList(p.resistant_type))}</td>
          <td>${p.active ? "Yes" : "No"}</td>
          <td>
            <div class="table-actions">
              <button class="mini-btn" onclick="editProductAdmin('${p.id}')">
                Edit
              </button>

              <button class="mini-btn danger" onclick="deleteProductAdmin('${p.id}', '${safeText(p.code)}')">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function editProductAdmin(id) {
  const product = state.adminProducts.find((p) => p.id === id);
  if (!product) return;

  fillSelectOptions("productCategory", state.masterOptions.categories || [], "Select Category");
  fillSelectOptions("productProtectionLevel", state.masterOptions.protectionLevels || [], "Select Protection Level");

  fillCheckboxGroup(
    "productUseCaseGroup",
    state.masterOptions.useCases || [],
    normalizeAdminArray(product.use_case)
  );

  fillCheckboxGroup(
    "productResistantTypeGroup",
    state.masterOptions.resistantTypes || [],
    normalizeAdminArray(product.resistant_type)
  );

  $("productFormTitle").textContent = "Edit Product";
  $("productId").value = product.id;
  $("productCode").value = product.code || "";
  $("productName").value = product.name || "";
  $("productCategory").value = product.category || "";
  $("productProtectionLevel").value = product.protection_level || "";
  $("productHighlight").value = product.highlight || "";
  $("productStandards").value = product.standards || "";
  $("productMaterialSpec").value = product.material_spec || "";
  $("productColourSize").value = product.colour_size || "";
  $("productSourcePage").value = product.source_page || "";
  $("productActive").checked = !!product.active;

  if ($("productImageFiles")) {
    $("productImageFiles").value = "";
  }

  state.productImages = adminGetProductImages(product);
  renderImagePreview();

  showToast("Product is ready to edit.");
}

function productPayloadFromForm() {
  return {
    code: $("productCode").value.trim(),
    name: $("productName").value.trim(),
    category: $("productCategory").value,
    use_case: getCheckboxGroupValues("productUseCaseGroup"),
    resistant_type: getCheckboxGroupValues("productResistantTypeGroup"),
    protection_level: $("productProtectionLevel").value,
    highlight: $("productHighlight").value.trim(),
    standards: $("productStandards").value.trim(),
    material_spec: $("productMaterialSpec").value.trim(),
    colour_size: $("productColourSize").value.trim(),
    source_page: $("productSourcePage").value.trim(),
    active: $("productActive").checked,
    updated_at: new Date().toISOString()
  };
}

async function saveProductAdmin(event) {
  event.preventDefault();

  const id = $("productId").value;
  const fileInput = $("productImageFiles");
  const payload = productPayloadFromForm();

  if (!payload.code || !payload.name) {
    showToast("Code and Name are required.");
    return;
  }

  let imageUrls = (state.productImages || [])
    .map((item) => {
      if (typeof item === "string" && item.startsWith("http")) return item;
      if (item && item.url && String(item.url).startsWith("http")) return item.url;
      if (item && item.publicUrl && String(item.publicUrl).startsWith("http")) return item.publicUrl;
      if (item && item.public_url && String(item.public_url).startsWith("http")) return item.public_url;
      if (item && item.image_url && String(item.image_url).startsWith("http")) return item.image_url;
      return null;
    })
    .filter(Boolean);

  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    showToast("Uploading images...");
    const uploadedUrls = await uploadMultipleProductImages(Array.from(fileInput.files));
    imageUrls = [...imageUrls, ...uploadedUrls];
  }

  imageUrls = [...new Set(imageUrls)];

  const finalPayload = {
    ...payload,
    image_urls: imageUrls,
    image_url: imageUrls.length > 0 ? imageUrls[0] : null
  };

  let result;

  if (id) {
    result = await supabaseClient
      .from("products")
      .update(finalPayload)
      .eq("id", id);
  } else {
    result = await supabaseClient
      .from("products")
      .insert(finalPayload);
  }

  if (result.error) {
    console.error("SAVE PRODUCT ERROR:", result.error);
    showToast("Failed to save product: " + result.error.message);
    return;
  }

  resetProductForm();
  await loadAdminProducts();
  await loadProducts();

  showToast("Product saved successfully.");
}

async function deleteProductAdmin(id, code) {
  const confirmed = confirm(
    `Are you sure you want to delete product ${code}?\n\nThis action cannot be undone.`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    showToast("Failed to delete product: " + error.message);
    return;
  }

  if ($("productId").value === id) {
    resetProductForm();
  }

  await loadAdminProducts();
  await loadProducts();

  showToast("Product deleted successfully.");
}

function resetProductForm() {
  $("productForm").reset();
  $("productId").value = "";
  $("productActive").checked = true;
  $("productFormTitle").textContent = "Add New Product";

  state.productImages = [];
  populateProductDropdowns();

  if ($("productImageFiles")) {
    $("productImageFiles").value = "";
  }

  if ($("imagePreview")) {
    $("imagePreview").innerHTML = "";
  }
}

async function loadAnalysis() {
  const { data, error } = await supabaseClient
    .from("vw_polling_analysis")
    .select("*")
    .order("interested_count", { ascending: false });

  if (error) {
    console.error("LOAD ANALYSIS ERROR:", error);
    showToast("Failed to load analysis.");
    return;
  }

  const rows = data || [];

  const totals = rows.reduce(
    (acc, row) => {
      acc.interested += Number(row.interested_count || 0);
      acc.sample += Number(row.need_sample_count || 0);
      acc.quotation += Number(row.need_quotation_count || 0);
      acc.volume += Number(row.total_estimated_volume_per_year || 0);
      return acc;
    },
    { interested: 0, sample: 0, quotation: 0, volume: 0 }
  );

  $("kpiCards").innerHTML = `
    <div class="kpi-card">
      <div class="kpi-value">${totals.interested}</div>
      <div class="kpi-label">Interested</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totals.sample}</div>
      <div class="kpi-label">Need Sample</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totals.quotation}</div>
      <div class="kpi-label">Need Quotation</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-value">${totals.volume.toLocaleString("id-ID")}</div>
      <div class="kpi-label">Est. Annual Volume</div>
    </div>
  `;

  $("analysisTable").innerHTML = rows
    .map(
      (r) => `
        <tr>
          <td><b>${safeText(r.code)}</b></td>
          <td>${safeText(r.name)}</td>
          <td>${safeText(r.category)}</td>
          <td>${Number(r.interested_count || 0)}</td>
          <td>${Number(r.need_sample_count || 0)}</td>
          <td>${Number(r.need_quotation_count || 0)}</td>
          <td>${Number(r.total_estimated_volume_per_year || 0).toLocaleString("id-ID")}</td>
          <td>${r.average_expected_price ? Number(r.average_expected_price).toLocaleString("id-ID") : "-"}</td>
        </tr>
      `
    )
    .join("");
}

async function loadClients() {
  const { data, error } = await supabaseClient
    .from("vw_polling_response_detail")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LOAD CLIENTS ERROR:", error);
    showToast("Failed to load client details.");
    return;
  }

  const grouped = {};

  (data || []).forEach((row) => {
    const key = `${row.company_name}__${row.email || row.full_name}`;

    if (!grouped[key]) {
      grouped[key] = {
        client: row,
        responses: []
      };
    }

    grouped[key].responses.push(row);
  });

  $("clientList").innerHTML =
    Object.values(grouped)
      .map((group) => {
        const client = group.client;

        return `
          <div class="client-card">
            <h3>${safeText(client.company_name)}</h3>
            <div class="client-meta">
              ${safeText(client.full_name)} ·
              ${safeText(client.position_title)} ·
              ${safeText(client.whatsapp)} ·
              ${safeText(client.email)}
            </div>

            <div>
              ${group.responses
                .map(
                  (r) => `
                    <span class="response-chip">
                      ${safeText(r.product_code)}
                      · ${r.interested ? "Interested" : ""}
                      ${r.need_sample ? "Sample" : ""}
                      ${r.need_quotation ? "Quotation" : ""}
                      · Vol: ${r.estimated_volume_per_year || "-"}
                    </span>
                  `
                )
                .join("")}
            </div>
          </div>
        `;
      })
      .join("") || `<p>No client responses yet.</p>`;
}