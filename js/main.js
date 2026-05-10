document.addEventListener("DOMContentLoaded", async () => {
  setupBrowserBackNavigation();
  bindEvents();

  const restored = await restoreSavedClient();
  if (restored) {
    console.log("Saved client restored with new submission.");
  }

  console.log("UNO Polling System ready");
});

function bindEvents() {
  $("clientForm").addEventListener("submit", handleClientSubmit);

  $("searchInput").addEventListener("input", applyProductFilters);
  $("categoryFilter").addEventListener("change", applyProductFilters);
  $("resistantFilter").addEventListener("change", applyProductFilters);

  $("finishPollingBtn").addEventListener("click", finishPolling);
  $("closeModalBtn").addEventListener("click", closeProductModal);
  $("responseForm").addEventListener("submit", saveResponse);

  $("brandLogo").addEventListener("click", handleLogoClick);

  $("adminLoginForm").addEventListener("submit", handleAdminLogin);

  $("backToClientBtn").addEventListener("click", () => {
    showPage("pageClientEntry", "Client Portal");
  });

  $("logoutBtn").addEventListener("click", logoutAdmin);

  $("startRecommendationBtn").addEventListener("click", async () => {
    const risks = getCheckedValues("riskGroup");
    const environments = getCheckedValues("envGroup");
    const categories = getCheckedValues("ppeTypeGroup");

    if (!risks.length) {
      showToast("Please select at least one Primary Risk.");
      return;
    }

    state.assessment = {
      risks,
      environments,
      priority: $("prioritySelect").value,
      categories,
      industry: $("industry").value
    };

    const { error: assessmentError } = await supabaseClient
  .from("polling_submissions")
  .update({
    assessment_risks: risks,
    assessment_environments: environments,
    assessment_priority: $("prioritySelect").value,
    assessment_categories: categories,
    assessment_industry: $("industry").value
  })
  .eq("id", state.submissionId);

if (assessmentError) {
  console.error("SAVE ASSESSMENT ERROR:", assessmentError);
  showToast("Failed to save assessment data.");
  return;
}

    showPage("pageGallery", "Recommended Products");

    if (!state.products.length) {
      await loadProducts();
    }

    applyRecommendation();
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  $("productForm").addEventListener("submit", saveProductAdmin);
  $("resetProductFormBtn").addEventListener("click", resetProductForm);
  $("adminProductSearch").addEventListener("input", renderAdminProductTable);

  bindProductImagePreview();
  bindFormattedResponseInputs();
}

function onlyDigits(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatRupiah(value) {
  const digits = onlyDigits(value);

  if (!digits) return "";

  return "Rp " + Number(digits).toLocaleString("id-ID");
}

function formatThousands(value) {
  const digits = onlyDigits(value);

  if (!digits) return "";

  return Number(digits).toLocaleString("id-ID");
}

function bindFormattedResponseInputs() {
  const expectedPriceInput = $("respExpectedPrice");
  const estimatedVolumeInput = $("respEstimatedVolume");

  if (expectedPriceInput) {
    expectedPriceInput.addEventListener("input", () => {
      expectedPriceInput.value = formatRupiah(expectedPriceInput.value);
    });
  }

  if (estimatedVolumeInput) {
    estimatedVolumeInput.addEventListener("input", () => {
      estimatedVolumeInput.value = formatThousands(estimatedVolumeInput.value);
    });
  }
}

function bindProductImagePreview() {
  const fileInput = $("productImageFiles");

  if (!fileInput) return;

  fileInput.addEventListener("change", function () {
    const files = Array.from(this.files || []);

    if (!files.length) return;

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        showToast("Some files are not images and were skipped.");
        continue;
      }

      const previewUrl = URL.createObjectURL(file);

      state.productImages.push({
        type: "local",
        previewUrl,
        fileName: file.name
      });
    }

    renderImagePreview();
  });
}

function normalizeImageItem(item) {
  if (typeof item === "string") {
    return {
      type: "remote",
      url: item,
      previewUrl: item,
      fileName: "Current image"
    };
  }

  return item;
}

function renderImagePreview() {
  const container = $("imagePreview");

  if (!container) return;

  const images = (state.productImages || []).map(normalizeImageItem);

  if (!images.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = images
    .map(
      (img, index) => `
        <div class="img-item">
          <img src="${img.previewUrl || img.url}" alt="${img.fileName || "Product image"}" />
          <button type="button" onclick="removeProductImage(${index})">×</button>
          <small>${img.fileName || "Image"}</small>
        </div>
      `
    )
    .join("");
}

function removeProductImage(index) {
  if (!Array.isArray(state.productImages)) return;

  const item = normalizeImageItem(state.productImages[index]);

  if (item && item.type === "local" && item.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }

  state.productImages.splice(index, 1);
  renderImagePreview();
}