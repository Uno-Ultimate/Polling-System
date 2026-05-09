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
    `Hello ${state.clientName}, based on your assessment we will recommend relevant PPE products.`;

  showPage("pageAssessment", "PPE Assessment");

  if (!state.products.length) {
    await loadProducts();
  }

  updateFinishButtonState(false);

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

  if (payload.full_name.length < 3) {
    setClientStatus("Full name is too short.", "error");
    showToast("Please enter your real name.");
    return;
  }

  const invalidCompany = ["test", "abc", "asdf", "qwerty"];

  if (
    payload.company_name.length < 3 ||
    invalidCompany.includes(payload.company_name.toLowerCase())
  ) {
    setClientStatus("Invalid company name.", "error");
    showToast("Please enter a valid company name.");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(payload.email)) {
    setClientStatus("Invalid email format.", "error");
    showToast("Please enter a valid email.");
    return;
  }

  const phoneRegex = /^(\+62|62|08)[0-9]{8,13}$/;

  if (!phoneRegex.test(payload.whatsapp)) {
    setClientStatus("Invalid WhatsApp number.", "error");
    showToast("Use valid format (08xxxx / +62xxxx)");
    return;
  }

  if (!payload.industry) {
    setClientStatus("Please select industry.", "error");
    showToast("Industry is required.");
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
    showToast("Successfully entered PPE assessment.");
  }
}

async function hasAtLeastOneResponse(submissionId) {
  const { data, error } = await supabaseClient
    .from("polling_responses")
    .select("id")
    .eq("submission_id", submissionId)
    .limit(1);

  if (error) {
    console.error("CHECK RESPONSE ERROR:", error);
    return false;
  }

  return data && data.length > 0;
}

function updateFinishButtonState(enabled) {
  const btn = $("finishPollingBtn");
  if (!btn) return;

  btn.disabled = !enabled;
  btn.style.opacity = enabled ? "1" : "0.55";
  btn.style.cursor = enabled ? "pointer" : "not-allowed";
}

function showNoResponsePopup() {
  alert("You haven’t selected any product yet.\n\nPlease evaluate at least 1 product before finishing.");
}

async function finishPolling() {
  if (!state.submissionId) {
    showToast("No active session.");
    return;
  }

  const hasResponse = await hasAtLeastOneResponse(state.submissionId);

  if (!hasResponse) {
    showNoResponsePopup();
    showToast("Please select at least 1 product before finishing.");
    updateFinishButtonState(false);
    return;
  }

  state.selectedProduct = null;
  state.assessment = null;

  showPage("pageClientEntry", "Client Portal");
  showToast("Thank you. Your responses have been saved.");
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