function $(id) {
  return document.getElementById(id);
}

function getActivePageId() {
  const activePage = document.querySelector(".page.active");
  return activePage ? activePage.id : "pageClientEntry";
}

function showPage(pageId, label, options = {}) {
  const shouldPushHistory = options.pushHistory !== false;

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const target = $(pageId);

  if (!target) {
    alert("Page tidak ditemukan: " + pageId);
    return;
  }

  target.classList.add("active");
  document.body.dataset.page = pageId;

  $("currentPageLabel").textContent = label;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (shouldPushHistory) {
    const currentState = history.state || {};

    if (currentState.pageId !== pageId) {
      history.pushState(
        { pageId, label },
        "",
        window.location.href
      );
    }
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("active");

  setTimeout(() => {
    toast.classList.remove("active");
  }, 2800);
}

function setClientStatus(message, type = "info") {
  const status = $("clientStatus");
  if (!status) return;

  status.textContent = message || "";
  status.className = `form-status ${type}`;
}

function safeText(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return String(value);
}

function safeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function handleLogoClick() {
  state.logoClickCount += 1;
  clearTimeout(state.logoTimer);

  if (state.logoClickCount >= 5) {
    state.logoClickCount = 0;
    showPage("pageAdminLogin", "UNO Login");
    return;
  }

  state.logoTimer = setTimeout(() => {
    state.logoClickCount = 0;
  }, 1200);
}

function showNoResponsePopup() {
  alert(
    "You haven’t selected any product yet.\n\nPlease evaluate at least 1 product before leaving."
  );
}

async function setupBrowserBackNavigation() {
  history.replaceState(
    { pageId: "pageClientEntry", label: "Client Portal" },
    "",
    window.location.href
  );

  document.body.dataset.page = getActivePageId();

  window.addEventListener("popstate", async (event) => {
    const currentPageId = document.body.dataset.page || getActivePageId();
    const targetState = event.state;

    if (currentPageId === "pageGallery") {
      const hasResponse = state.submissionId
        ? await hasAtLeastOneResponse(state.submissionId)
        : false;

      if (!hasResponse) {
        showNoResponsePopup();
        showToast("Please select at least 1 product before leaving.");

        history.pushState(
          { pageId: "pageGallery", label: "Recommended Products" },
          "",
          window.location.href
        );

        showPage("pageGallery", "Recommended Products", {
          pushHistory: false
        });

        return;
      }
    }

    if (!targetState || !targetState.pageId) {
      return;
    }

    showPage(targetState.pageId, targetState.label || "UNO", {
      pushHistory: false
    });
  });
}