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

function showNoResponsePopup() {
  alert(
    "You haven’t selected any product yet.\n\nPlease evaluate at least 1 product before leaving."
  );
}

async function logBehavior(eventType, notes = "") {
  try {
    await supabaseClient
      .from("polling_behavior_logs")
      .insert({
        client_id: state.clientId || null,
        submission_id: state.submissionId || null,
        event_type: eventType,
        page_id: document.body.dataset.page || getActivePageId(),
        notes
      });
  } catch (err) {
    console.warn("BEHAVIOR LOG ERROR:", err);
  }
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
        await logBehavior(
          "blocked_back_without_response",
          "User attempted to leave gallery using browser/backpress without submitting any product response."
        );

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

      await logBehavior(
        "allowed_back_after_response",
        "User left gallery using browser/backpress after submitting at least one product response."
      );
    }

    if (!targetState || !targetState.pageId) {
      return;
    }

    showPage(targetState.pageId, targetState.label || "UNO", {
      pushHistory: false
    });
  });

  window.addEventListener("beforeunload", function (event) {
    const currentPageId = document.body.dataset.page || getActivePageId();

    if (currentPageId !== "pageGallery") return;
    if (!state.submissionId) return;

    logBehavior(
      "attempt_beforeunload_gallery",
      "User attempted to refresh, close tab, or leave browser while on gallery page."
    );

    event.preventDefault();
    event.returnValue = "";
  });
}