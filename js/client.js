function saveClientToLocal(client) {
  localStorage.setItem("uno_polling_client_id", client.id);
  localStorage.setItem("uno_polling_client_name", client.full_name);
}

function getSavedClient() {
  const id = localStorage.getItem("uno_polling_client_id");
  const name = localStorage.getItem("uno_polling_client_name");

  if (!id || !name) return null;

  return {
    id,
    full_name: name
  };
}

function clearSavedClient() {
  localStorage.removeItem("uno_polling_client_id");
  localStorage.removeItem("uno_polling_client_name");
}

async function createPollingSubmission(clientId) {
  const payload = {
    client_id: clientId,
    submission_code: `SUB-${Date.now()}`,
    submission_title: "Product Polling",
    status: "active"
  };

  const { data, error } = await supabaseClient
    .from("polling_submissions")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("CREATE SUBMISSION ERROR:", error);
    showToast("Failed to create polling session: " + error.message);
    return null;
  }

  return data.id;
}

async function restoreSavedClient() {
  const savedClient = getSavedClient();

  if (!savedClient) return false;

  state.clientId = savedClient.id;
  state.clientName = savedClient.full_name;

  state.submissionId = await createPollingSubmission(state.clientId);

  if (!state.submissionId) {
    return false;
  }

  $("clientGreeting").textContent =
    `Hello ${state.clientName}, please select products and submit your responses.`;

  showPage("pageGallery", "Product Gallery");
  await loadProducts();

  return true;
}

async function handleClientSubmit(event) {
  event.preventDefault();

  const payload = {
    full_name: $("fullName").value.trim(),
    position_title: $("positionTitle").value.trim(),
    whatsapp: $("whatsapp").value.trim(),
    email: $("email").value.trim(),
    company_name: $("companyName").value.trim()
  };

  // VALIDASI WAJIB
  if (
    !payload.full_name ||
    !payload.position_title ||
    !payload.whatsapp ||
    !payload.email ||
    !payload.company_name
  ) {
    setClientStatus("All fields are required.", "error");
    showToast("Please complete all fields.");
    return;
  }

  // VALIDASI EMAIL
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email)) {
    setClientStatus("Invalid email format.", "error");
    showToast("Please enter a valid email.");
    return;
  }

  // VALIDASI WHATSAPP (opsional tapi bagus)
  if (payload.whatsapp.length < 8) {
    setClientStatus("Invalid WhatsApp number.", "error");
    showToast("Please enter a valid WhatsApp number.");
    return;
  }

  setClientStatus("Processing client data...", "info");
}

function finishPolling() {
  state.selectedProduct = null;

  showPage("pageClientEntry", "Client Portal");
  showToast("Your data is محفوظ. Reopening will take you directly to the catalog.");
}

async function enterCatalogAgain() {
  const savedClient = getSavedClient();

  if (!savedClient) {
    showToast("No saved client data found.");
    return;
  }

  state.clientId = savedClient.id;
  state.clientName = savedClient.full_name;

  state.submissionId = await createPollingSubmission(state.clientId);

  if (!state.submissionId) {
    return;
  }

  $("clientGreeting").textContent =
    `Hello ${state.clientName}, please select products and submit your responses.`;

  showPage("pageGallery", "Product Gallery");
  await loadProducts();
}