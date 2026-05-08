function saveClientToLocal(client) {
  localStorage.setItem("uno_polling_client_id", client.id);
  localStorage.setItem("uno_polling_client_name", client.full_name);
}

function getSavedClient() {
  const id = localStorage.getItem("uno_polling_client_id");
  const name = localStorage.getItem("uno_polling_client_name");

  if (!id || !name) return null;

  return { id, full_name: name };
}

function clearSavedClient() {
  localStorage.removeItem("uno_polling_client_id");
  localStorage.removeItem("uno_polling_client_name");
}

async function validateSavedClient(clientId) {
  const { data, error } = await supabaseClient
    .from("polling_clients")
    .select("id, full_name")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !data) {
    clearSavedClient();
    return null;
  }

  return data;
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

async function goToCatalog(clientData) {
  state.clientId = clientData.id;
  state.clientName = clientData.full_name;

  state.submissionId = await createPollingSubmission(state.clientId);

  if (!state.submissionId) {
    setClientStatus("Failed to create polling session.", "error");
    return false;
  }

  $("clientGreeting").textContent =
    `Hello ${state.clientName}, please select products and submit your responses.`;

  showPage("pageGallery", "Product Gallery");
  await loadProducts();

  return true;
}

async function restoreSavedClient() {
  const savedClient = getSavedClient();

  if (!savedClient) return false;

  const validClient = await validateSavedClient(savedClient.id);

  if (!validClient) return false;

  return await goToCatalog(validClient);
}

async function handleClientSubmit(event) {
  event.preventDefault();

  const payload = {
    full_name: $("fullName").value.trim(),
    position_title: $("positionTitle").value.trim(),
    whatsapp: $("whatsapp").value.trim(),
    email: $("email").value.trim(),
    company_name: $("companyName").value.trim(),
    industry: $("industry").value.trim()
  };

  if (
    !payload.full_name ||
    !payload.position_title ||
    !payload.whatsapp ||
    !payload.email ||
    !payload.company_name ||
    !payload.industry
  ) {
    setClientStatus("All fields are required.", "error");
    showToast("Please complete all fields.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email)) {
    setClientStatus("Invalid email format.", "error");
    showToast("Please enter a valid email.");
    return;
  }

  if (payload.whatsapp.length < 8) {
    setClientStatus("Invalid WhatsApp number.", "error");
    showToast("Please enter a valid WhatsApp number.");
    return;
  }

  setClientStatus("Processing client data...", "info");

  let clientData = null;

  const { data: existing, error: checkError } = await supabaseClient
    .from("polling_clients")
    .select("id, full_name")
    .eq("email", payload.email)
    .eq("company_name", payload.company_name)
    .maybeSingle();

  if (checkError) {
    console.error("CHECK CLIENT ERROR:", checkError);
    setClientStatus("Failed to check client data.", "error");
    showToast("Failed to check client data.");
    return;
  }

  if (existing) {
    clientData = existing;

    const { error: updateError } = await supabaseClient
      .from("polling_clients")
      .update({
        full_name: payload.full_name,
        position_title: payload.position_title,
        whatsapp: payload.whatsapp,
        industry: payload.industry
      })
      .eq("id", existing.id);

    if (updateError) {
      console.error("CLIENT UPDATE ERROR:", updateError);
      setClientStatus("Failed to update client: " + updateError.message, "error");
      showToast("Failed to update client data.");
      return;
    }
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

  const success = await goToCatalog(clientData);

  if (success) {
    setClientStatus("", "info");
    showToast("Successfully entered product catalog.");
  }
}

function finishPolling() {
  state.selectedProduct = null;
  showPage("pageClientEntry", "Client Portal");
  showToast("Your client data remains saved.");
}

async function enterCatalogAgain() {
  const savedClient = getSavedClient();

  if (!savedClient) {
    showToast("No saved client data found.");
    return;
  }

  const validClient = await validateSavedClient(savedClient.id);

  if (!validClient) {
    showToast("Saved client data is no longer valid. Please fill the form again.");
    return;
  }

  await goToCatalog(validClient);
}