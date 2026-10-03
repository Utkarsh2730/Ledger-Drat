// This function runs on Netlify's servers, never in the visitor's browser.
// API keys are read from environment variables set in the Netlify dashboard —
// never present in this file or anywhere in the deployed frontend code.

const DOC_TYPES = {
  compliance_reminder: {
    provider: "groq",
    system: `Draft a short, clear compliance reminder letter (under 200 words) from a CA firm to a client. State exactly what's due, by when, what the client needs to provide/approve, and what happens if missed — in plain language, no invented penalty figures unless given. Sign off as "Team [FIRM NAME]" (leave as a placeholder). If supporting document text is provided, use it to fill in specifics accurately.`,
    buildUser: (f) => `Client Name: ${f.clientName || "[fill in]"}
Compliance type: ${f.complianceType || "[fill in]"}
Due date: ${f.dueDate || "[fill in]"}
Specific details: ${f.specificDetails || "none provided"}
Tone: ${f.tone || "Standard reminder"}

Draft the reminder now.`,
  },
  gst_notice_reply: {
    provider: "groq",
    system: `You are drafting a FIRST-DRAFT reply to a GST department notice on behalf of a Chartered Accountant firm. Write in formal Indian tax-correspondence style: respectful, factual, precise, no hedging language. Structure: (1) reference line citing the notice, (2) brief acknowledgment, (3) point-by-point response to each issue raised, citing the facts and supporting documents given, (4) a closing paragraph requesting the notice be considered disposed of / closed. Do NOT invent facts, section numbers, or figures not given — use [INSERT SECTION REFERENCE] as a placeholder instead of guessing. End with: "DRAFT FOR REVIEW — verify all figures, section references and enclosures before signing."`,
    buildUser: (f) => `Client / Business Name: ${f.clientName || "[fill in]"}
GSTIN: ${f.gstin || "not provided"}
Notice Reference: ${f.noticeReference || "not provided"}

Notice summary:
${f.noticeSummary || "[fill in]"}

Client's position / facts to include:
${f.clientPosition || "[fill in]"}

Supporting documents available:
${f.attachmentsAvailable || "none listed"}

Draft the formal reply letter now.`,
  },
  income_tax_reply: {
    provider: "groq",
    system: `You are drafting a FIRST-DRAFT reply to an Income Tax Department notice on behalf of a Chartered Accountant firm. Write in formal Indian tax-correspondence style: respectful, factual, precise, no hedging language. Structure: (1) reference line citing the notice section and number (e.g. 143(1), 148, 142(1)), (2) brief acknowledgment, (3) point-by-point response to each query raised, citing the facts and supporting documents given, (4) a closing paragraph requesting the matter be considered closed, or stating clear next steps if pending. Do NOT invent section numbers, assessment years, or figures not given — use [INSERT DETAIL] as a placeholder instead of guessing. End with: "DRAFT FOR REVIEW — verify all figures, section references and enclosures before signing."`,
    buildUser: (f) => `Client Name: ${f.clientName || "[fill in]"}
PAN: ${f.pan || "not provided"}
Notice section / number: ${f.noticeSection || "[fill in]"}
Assessment Year: ${f.assessmentYear || "[fill in]"}

Notice summary:
${f.noticeSummary || "[fill in]"}

Client's position / facts to include:
${f.clientPosition || "[fill in]"}

Supporting documents available:
${f.attachmentsAvailable || "none listed"}

Draft the formal reply letter now.`,
  },
  icm: {
    provider: "gemini",
    system: `Convert these raw audit notes into a formal Internal Control Memorandum (ICM) entry structured as: Observation, Risk/Implication, Recommendation. Use neutral, professional audit language. Do not invent financial impact figures if none given — write "financial impact not quantified" instead. If a supporting document (working papers, ledger extract, etc.) is attached, read it and incorporate relevant specifics. End with: "DRAFT FOR REVIEW — to be finalized by the engagement partner before inclusion in the management letter."`,
    buildUser: (f) => `Client / Entity: ${f.clientName || "[fill in]"}
Area audited: ${f.areaAudited || "[fill in]"}
Risk level stated: ${f.riskLevel || "[fill in]"}

Raw observation notes:
${f.observationRaw || "[fill in]"}

Draft the formal ICM entry now.`,
  },
  document_summary: {
    provider: "gemini",
    system: `Translate these raw figures/notes — or the attached document, if one is provided — into a short, plain-language summary for a business-owner client who is NOT finance-literate. Structure: (1) headline one-liner on overall position, (2) 3-5 bullet highlights, (3) direct answer to the client's specific question if given, (4) one suggested next action. Flag anything needing the CA's direct input as [CA TO CONFIRM].`,
    buildUser: (f) => `Client Name: ${f.clientName || "[fill in]"}
Period: ${f.period || "[fill in]"}

Raw figures / notes:
${f.rawFigures || "[fill in]"}

Client's specific question: ${f.keyConcern || "none provided"}

Draft the summary now.`,
  },
  income_tax_return: {
    provider: "gemini",
    system: `Draft a plain, structured Income Tax Computation Summary — a covering computation note a CA shares with a client alongside the filed return, NOT the official return form itself. Structure: (1) Assessee name & PAN, (2) Heads of income with amounts (salary, house property, business/profession, capital gains, other sources — include only what's given or shown in an attached document), (3) Deductions claimed, (4) Gross total income, taxable income, and tax computed, (5) Net tax payable or refund due. Do NOT invent figures, slabs, or deduction amounts not provided — use [TO BE CONFIRMED] as a placeholder for anything missing. End with: "DRAFT FOR REVIEW — figures to be verified against the final return before filing."`,
    buildUser: (f) => `Client Name: ${f.clientName || "[fill in]"}
PAN: ${f.pan || "not provided"}
Assessment Year: ${f.assessmentYear || "[fill in]"}

Income details:
${f.incomeDetails || "[fill in, or see attached document]"}

Deductions claimed:
${f.deductionsClaimed || "none provided"}

Additional notes: ${f.additionalNotes || "none"}

Draft the computation summary now.`,
  },
};

async function callGroq(system, user, file) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in Netlify environment variables.");

  let finalUser = user;
  let fileNote = "";

  if (file && file.base64) {
    if (file.mimeType && file.mimeType.startsWith("text/")) {
      const decoded = Buffer.from(file.base64, "base64").toString("utf-8").slice(0, 8000);
      finalUser += `\n\nSupporting document (${file.name}) content:\n${decoded}`;
    } else {
      fileNote = `\n\n[Note: a file named "${file.name}" was attached, but this document type can only automatically read plain text files. Its content was not included — please add relevant details from it into the text fields above if needed.]`;
    }
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: system },
        { role: "user", content: finalUser },
      ],
      max_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "") + fileNote;
}

async function callGemini(system, user, file) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Netlify environment variables.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

  const parts = [{ text: `${system}\n\n${user}` }];

  if (file && file.base64 && file.mimeType) {
    // Gemini can read images and PDFs directly as inline data.
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64,
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { docType, fields, file } = JSON.parse(event.body || "{}");

    const config = DOC_TYPES[docType];
    if (!config) {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown document type." }) };
    }

    const systemPrompt = config.system;
    const userPrompt = config.buildUser(fields || {});

    let draft;
    if (config.provider === "groq") {
      draft = await callGroq(systemPrompt, userPrompt, file);
    } else {
      draft = await callGemini(systemPrompt, userPrompt, file);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft, provider: config.provider }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "Something went wrong generating the draft." }),
    };
  }
};
