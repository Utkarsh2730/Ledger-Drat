// Field definitions only — the actual prompt text and API calls live server-side
// in netlify/functions/generate.js, where the API keys are kept safe.
const DOC_TYPES = {
  compliance_reminder: {
    label: "Compliance Reminder Letter",
    provider: "groq",
    fields: [
      { name: "clientName", label: "Client name" },
      { name: "complianceType", label: "Compliance type (e.g. TDS return, ROC filing)" },
      { name: "dueDate", label: "Due date" },
      { name: "specificDetails", label: "Specific details / amounts / forms" },
      { name: "tone", label: "Tone (Standard / Urgent / Friendly early)" },
    ],
  },
  gst_notice_reply: {
    label: "GST Notice Reply",
    provider: "groq",
    fields: [
      { name: "clientName", label: "Client / business name" },
      { name: "gstin", label: "GSTIN" },
      { name: "noticeReference", label: "Notice reference no. / date" },
      { name: "noticeSummary", label: "What does the notice say?" },
      { name: "clientPosition", label: "Client's position / facts to include" },
      { name: "attachmentsAvailable", label: "Supporting documents available" },
    ],
  },
  income_tax_reply: {
    label: "Income Tax Reply Letter",
    provider: "groq",
    fields: [
      { name: "clientName", label: "Client name" },
      { name: "pan", label: "PAN" },
      { name: "noticeSection", label: "Notice section / number (e.g. 143(1), 148)" },
      { name: "assessmentYear", label: "Assessment year" },
      { name: "noticeSummary", label: "What does the notice say?" },
      { name: "clientPosition", label: "Client's position / facts to include" },
      { name: "attachmentsAvailable", label: "Supporting documents available" },
    ],
  },
  icm: {
    label: "Internal Control Memorandum (ICM)",
    provider: "gemini",
    fields: [
      { name: "clientName", label: "Client / entity name" },
      { name: "areaAudited", label: "Area / process audited" },
      { name: "riskLevel", label: "Risk level (Low / Medium / High)" },
      { name: "observationRaw", label: "Raw observation notes" },
    ],
  },
  document_summary: {
    label: "Document Summary",
    provider: "gemini",
    fields: [
      { name: "clientName", label: "Client name" },
      { name: "period", label: "Period covered (e.g. Q1 FY25–26)" },
      { name: "rawFigures", label: "Raw figures / notes to summarize" },
      { name: "keyConcern", label: "Client's specific question (if any)" },
    ],
  },
  income_tax_return: {
    label: "Income Tax Return (Computation Summary)",
    provider: "gemini",
    fields: [
      { name: "clientName", label: "Client name" },
      { name: "pan", label: "PAN" },
      { name: "assessmentYear", label: "Assessment year" },
      { name: "incomeDetails", label: "Income details" },
      { name: "deductionsClaimed", label: "Deductions claimed" },
      { name: "additionalNotes", label: "Additional notes" },
    ],
  },
};

const MAX_FILE_MB = 4;

const docTypeSelect = document.getElementById("docType");
const fieldsForm = document.getElementById("fieldsForm");
const buildBtn = document.getElementById("buildBtn");
const outputText = document.getElementById("outputText");
const copyBtn = document.getElementById("copyBtn");
const statusMsg = document.getElementById("statusMsg");

function init() {
  docTypeSelect.innerHTML = Object.entries(DOC_TYPES)
    .map(([key, val]) => `<option value="${key}">${val.label}</option>`)
    .join("");
  renderFields(docTypeSelect.value);
}

docTypeSelect.addEventListener("change", () => renderFields(docTypeSelect.value));

function renderFields(key) {
  const config = DOC_TYPES[key];
  const fieldsHtml = config.fields
    .map((f) => `<label for="${f.name}">${f.label}</label><textarea id="${f.name}" rows="2"></textarea>`)
    .join("");

  const fileHint = config.provider === "gemini"
    ? "PDF or image files are read directly. Other file types will be attached but not read."
    : "Only plain text (.txt) files are read automatically for this document type.";

  fieldsForm.innerHTML = `
    ${fieldsHtml}
    <label for="supportingFile">Supporting document (optional)</label>
    <input type="file" id="supportingFile" />
    <p class="file-hint">${fileHint} Max ${MAX_FILE_MB}MB.</p>
  `;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // result looks like "data:<mime>;base64,<data>" — strip the prefix
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

buildBtn.addEventListener("click", async () => {
  const key = docTypeSelect.value;
  const config = DOC_TYPES[key];
  const fields = {};
  config.fields.forEach((f) => { fields[f.name] = document.getElementById(f.name).value; });

  outputText.value = "";
  statusMsg.textContent = "Generating draft…";
  buildBtn.disabled = true;

  try {
    let filePayload = null;
    const fileInput = document.getElementById("supportingFile");
    const chosenFile = fileInput.files[0];

    if (chosenFile) {
      if (chosenFile.size > MAX_FILE_MB * 1024 * 1024) {
        throw new Error(`File is too large — please keep it under ${MAX_FILE_MB}MB.`);
      }
      const base64 = await readFileAsBase64(chosenFile);
      filePayload = {
        name: chosenFile.name,
        mimeType: chosenFile.type || "application/octet-stream",
        base64,
      };
    }

    const res = await fetch("/.netlify/functions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docType: key, fields, file: filePayload }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Something went wrong.");
    }

    outputText.value = data.draft;
    statusMsg.textContent = `Draft generated (${data.provider}). Review carefully before sending.`;
  } catch (err) {
    statusMsg.textContent = `Error: ${err.message}`;
  } finally {
    buildBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  if (!outputText.value) {
    statusMsg.textContent = "Nothing to copy yet — generate a draft first.";
    return;
  }
  await navigator.clipboard.writeText(outputText.value);
  statusMsg.textContent = "Copied.";
});

function scrollToId(id) {
  document.getElementById(id).scrollIntoView({ behavior: "smooth", block: "start" });
}
document.getElementById("heroBuildBtn").addEventListener("click", () => scrollToId("tool"));
document.getElementById("heroHowBtn").addEventListener("click", () => scrollToId("how"));
document.getElementById("navHowBtn").addEventListener("click", () => scrollToId("how"));
document.getElementById("navToolBtn").addEventListener("click", () => scrollToId("tool"));

init();
