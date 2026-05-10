function parseFormattedNumber(value) {
  const digits = String(value || "").replace(/[^\d]/g, "");

  if (!digits) return null;

  const numberValue = Number(digits);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function saveResponse(event) {
  event.preventDefault();

  if (!state.clientId) {
    showToast("Client data has not been saved. Please enter again.");
    return;
  }

  if (!state.submissionId) {
    showToast("Polling session has not been created. Please enter again.");
    return;
  }

  if (!state.selectedProduct) {
    showToast("No product selected.");
    return;
  }

  const payload = {
    client_id: state.clientId,
    submission_id: state.submissionId,
    product_id: state.selectedProduct.id,
    interested: $("respInterested").checked,
    need_sample: $("respNeedSample").checked,
    need_quotation: $("respNeedQuotation").checked,
    expected_price: parseFormattedNumber($("respExpectedPrice").value),
    estimated_volume_per_year: parseFormattedNumber($("respEstimatedVolume").value),
    notes: $("respNotes").value.trim()
  };

  const { error } = await supabaseClient
    .from("polling_responses")
    .upsert(payload, {
      onConflict: "submission_id,product_id"
    });

  if (error) {
    console.error("SAVE RESPONSE ERROR:", error);
    showToast("Failed to save response: " + error.message);
    return;
  }

  await logBehavior(
    "response_saved",
    `Product response saved for product_id: ${state.selectedProduct.id}`
  );

  updateFinishButtonState(true);

  closeProductModal();
  showToast("Response saved successfully.");
}