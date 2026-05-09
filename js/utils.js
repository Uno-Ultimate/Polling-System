function $(id) {
  return document.getElementById(id);
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
  $("currentPageLabel").textContent = label;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (shouldPushHistory) {
    const currentState = history.state || {};
    if (currentState.pageId !== pageId) {
      history.pushState({ pageId, label }, "", window.location.href);
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

function setupBrowserBackNavigation() {
  history.replaceState(
    { pageId: "pageClientEntry", label: "Client Portal" },
    "",
    window.location.href
  );

  window.addEventListener("popstate", (event) => {
    const stateData = event.state;

    if (!stateData || !stateData.pageId) return;

    showPage(stateData.pageId, stateData.label, {
      pushHistory: false
    });
  });
}