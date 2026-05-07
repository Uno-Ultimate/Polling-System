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

  if (!payload.full_name || !payload.company_name) {
    setClientStatus("Full Name and Company are required.", "error");
    return;
  }

  setClientStatus("Processing client data...", "info");

  let clientData = null;

  const savedClient = getSavedClient();

  if (savedClient) {
    clientData = savedClient;
  } else {
    let existing = null;

    if (payload.email && payload.company_name) {
      const { data, error } = await supabaseClient
        .from("polling_clients")
        .select("id, full_name")
        .eq("email", payload.email)
        .eq("company_name", payload.company_name)
        .maybeSingle();

      if (error) {
        console.error("CHECK CLIENT ERROR:", error);
      } else {
        existing = data;
      }
    }

    if (existing) {
      clientData = existing;
    } else {
      const { data, error } = await supabaseClient
        .from("polling_clients")
        .insert(payload)
        .select("id, full_name")
        .single();

      if (error) {
        console.error("CLIENT INSERT ERROR:", error);
        setClientStatus("Failed to save client: " + error.message, "error");
        showToast("Failed to enter product catalog.");
        return;
      }

      clientData = data;
    }

    saveClientToLocal(clientData);
  }

  state.clientId = clientData.id;
  state.clientName = clientData.full_name;

  state.submissionId = await createPollingSubmission(state.clientId);

  if (!state.submissionId) {
    setClientStatus("Failed to create polling session.", "error");
    return;
  }

  $("clientGreeting").textContent =
    `Hello ${state.clientName}, please choose products and share your feedback.`;

  showPage("pageGallery", "Product Gallery");
  await loadProducts();

  showToast("Successfully entered product catalog.");
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