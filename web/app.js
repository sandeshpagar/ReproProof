const appStatus = document.querySelector("#app-status");
const serverCheck = document.querySelector("#server-check");
const dockerCheck = document.querySelector("#docker-check");
const dockerCheckDot = document.querySelector("#docker-check-dot");
const versionLabel = document.querySelector("#version-label");
const auditForm = document.querySelector("#audit-form");
const repositoryPath = document.querySelector("#repository-path");
const runAuditButton = document.querySelector("#run-audit");
const pathError = document.querySelector("#path-error");
const auditProgress = document.querySelector("#audit-progress");
const progressTitle = document.querySelector("#progress-title");
const progressDetail = document.querySelector("#progress-detail");
const progressBar = document.querySelector("#progress-bar");
const resultsSection = document.querySelector("#results-section");
const repositoryName = document.querySelector("#repository-name");
const scoreValue = document.querySelector("#score-value");
const scoreDescription = document.querySelector("#score-description");
const scoreStatus = document.querySelector("#score-status");
const passedCount = document.querySelector("#passed-count");
const warningCount = document.querySelector("#warning-count");
const blockerCount = document.querySelector("#blocker-count");
const findingsList = document.querySelector("#findings-list");
const runTestButton = document.querySelector("#run-test");
const runRehearsalButton = document.querySelector("#run-rehearsal");
const executionOutput = document.querySelector("#execution-output");
const verificationStatus = document.querySelector("#verification-status");
const exportMarkdownButton = document.querySelector("#export-markdown");
const exportJsonButton = document.querySelector("#export-json");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

const state = {
  audit: null,
  execution: null,
  rehearsal: null,
  filter: "all",
  busy: false,
};

const stageOrder = ["scanning", "checking", "complete"];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error ?? `Request failed with status ${response.status}`);
  }

  return body;
}

function setApplicationStatus(label, type = "") {
  appStatus.textContent = label;
  appStatus.classList.remove("is-ready", "is-error", "is-busy");
  if (type) {
    appStatus.classList.add(`is-${type}`);
  }
}

function setProgress(stage, title, detail) {
  auditProgress.hidden = false;
  progressBar.classList.remove("is-error");
  progressTitle.textContent = title;
  progressDetail.textContent = detail;
  const activeIndex = stageOrder.indexOf(stage);
  progressBar.style.width = `${Math.max(12, ((activeIndex + 1) / stageOrder.length) * 100)}%`;

  document.querySelectorAll("[data-stage]").forEach((element) => {
    const stageIndex = stageOrder.indexOf(element.dataset.stage);
    element.classList.toggle("is-active", stageIndex === activeIndex);
    element.classList.toggle("is-complete", stageIndex < activeIndex || stage === "complete");
  });
}

function setBusy(isBusy) {
  state.busy = isBusy;
  repositoryPath.disabled = isBusy;
  runAuditButton.disabled = isBusy;
  runAuditButton.textContent = isBusy ? "Auditing repository…" : "Run static audit";
  if (isBusy) {
    runTestButton.disabled = true;
    runRehearsalButton.disabled = true;
  } else if (state.audit) {
    runTestButton.disabled = false;
    runRehearsalButton.disabled = false;
  }
}

function renderScore() {
  const findings = state.audit.findings;
  const passed = findings.filter((finding) => finding.status === "pass").length;
  const warnings = findings.filter((finding) => finding.status === "warning").length;
  const blockers = findings.filter((finding) => finding.status === "fail").length;
  const score = state.audit.score;

  scoreValue.textContent = score;
  scoreValue.className = `score-number ${score >= 90 ? "score-good" : score >= 70 ? "score-warning" : "score-danger"}`;
  scoreValue.parentElement.setAttribute("aria-label", `Readiness score ${score} out of 100`);
  scoreDescription.textContent = `${state.audit.repository.displayName} · audited ${new Date(state.audit.finishedAt).toLocaleTimeString()}`;
  scoreStatus.textContent = blockers > 0 ? "Needs attention" : score >= 90 ? "Ready to share" : "Review suggested";
  scoreStatus.className = `score-caption ${blockers > 0 ? "status-warning" : "status-success"}`;
  passedCount.textContent = passed;
  warningCount.textContent = warnings;
  blockerCount.textContent = blockers;
  repositoryName.textContent = state.audit.repository.displayName;
}

function evidenceMarkup(finding) {
  if (!finding.evidence?.length) {
    return "<li>No evidence was returned.</li>";
  }

  return finding.evidence
    .map((item) => {
      const location = item.file ? `${item.file}${item.line ? `:${item.line}` : ""}` : "Repository";
      return `<li><code>${escapeHtml(location)}</code><span>${escapeHtml(item.detail)}</span></li>`;
    })
    .join("");
}

function findingMarkup(finding) {
  const statusLabel = finding.status === "fail" ? "Blocker" : finding.status === "warning" ? "Warning" : "Passed";
  const statusClass = finding.status === "fail" ? "status-fail" : finding.status === "warning" ? "status-warning" : "status-pass";
  const open = finding.status !== "pass" ? " open" : "";

  return `
    <details class="finding-card ${statusClass}"${open}>
      <summary>
        <span class="finding-icon" aria-hidden="true">${finding.status === "pass" ? "✓" : "!"}</span>
        <span class="finding-title"><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.id)}</small></span>
        <span class="finding-severity">${escapeHtml(finding.severity)}</span>
        <span class="finding-status">${statusLabel}</span>
      </summary>
      <div class="finding-details">
        <p>${escapeHtml(finding.description)}</p>
        <h4>Evidence</h4>
        <ul class="evidence-list">${evidenceMarkup(finding)}</ul>
        <h4>Suggested remediation</h4>
        <p class="remediation">${escapeHtml(finding.remediation)}</p>
        ${finding.blocking ? '<span class="blocking-note">Blocks clean-room readiness</span>' : ""}
      </div>
    </details>
  `;
}

function renderFindings() {
  const filtered = state.audit.findings.filter((finding) => state.filter === "all" || finding.status === state.filter);

  findingsList.innerHTML = filtered.length
    ? filtered.map(findingMarkup).join("")
    : '<div class="empty-state"><strong>No findings in this view.</strong><span>Try another filter.</span></div>';

  filterButtons.forEach((button) => {
    const selected = button.dataset.filter === state.filter;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function formatExecution(execution, heading) {
  if (!execution) {
    return "";
  }

  const output = [execution.stdout, execution.stderr].filter(Boolean).join("\n");
  return `
    <div class="output-heading"><strong>${escapeHtml(heading)}</strong><span>${escapeHtml(execution.status)}</span></div>
    <div class="execution-meta">
      <span>Exit ${execution.exitCode ?? "—"}</span>
      <span>${execution.durationMs}ms</span>
      <span>Network: ${escapeHtml(execution.networkMode)}</span>
      ${execution.outputTruncated ? "<span>Output truncated</span>" : ""}
    </div>
    ${output ? `<pre>${escapeHtml(output)}</pre>` : '<p class="muted-output">No command output.</p>'}
  `;
}

function renderExecutionOutput() {
  const sections = [];

  if (state.execution) {
    sections.push(formatExecution(state.execution, "Local project test"));
  }

  if (state.rehearsal) {
    const rehearsal = state.rehearsal;
    sections.push(`<div class="output-heading"><strong>Clean-room rehearsal</strong><span>${escapeHtml(rehearsal.status)}</span></div>`);
    sections.push(`<div class="execution-meta"><span>Docker: ${rehearsal.dockerAvailable ? "available" : "unavailable"}</span><span>Network: ${escapeHtml(rehearsal.networkMode)}</span></div>`);
    if (rehearsal.reason) {
      sections.push(`<p class="muted-output">${escapeHtml(rehearsal.reason)}</p>`);
    }
    sections.push(formatExecution(rehearsal.build, "Image build"));
    sections.push(formatExecution(rehearsal.test, "Network-isolated test"));
  }

  executionOutput.innerHTML = sections.join("");
  executionOutput.hidden = sections.length === 0;
}

function renderAudit() {
  renderScore();
  renderFindings();
  resultsSection.hidden = false;
  runTestButton.disabled = false;
  runRehearsalButton.disabled = false;
  exportMarkdownButton.disabled = false;
  exportJsonButton.disabled = false;
  executionOutput.hidden = true;
  verificationStatus.textContent = "Not run";
  verificationStatus.className = "verification-badge";
  setApplicationStatus("Audit complete", "ready");
}

function updateDockerStatus(rehearsal) {
  dockerCheck.textContent = rehearsal.dockerAvailable ? rehearsal.status === "passed" ? "Passed" : "Available" : "Unavailable";
  dockerCheckDot.classList.remove("check-dot-muted", "check-dot-fail");
  dockerCheckDot.textContent = rehearsal.status === "passed" ? "✓" : rehearsal.dockerAvailable ? "!" : "·";
  if (rehearsal.status !== "passed") {
    dockerCheckDot.classList.add(rehearsal.dockerAvailable ? "check-dot-fail" : "check-dot-muted");
  }
}

function updateVerificationStatus(status) {
  verificationStatus.textContent = status;
  verificationStatus.className = `verification-badge verification-${status}`;
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportReport(format, filename, contentType) {
  if (!state.audit) return;

  try {
    const response = await fetch(`/api/audits/${state.audit.auditId}/report?format=${format}`);
    const content = await response.text();

    if (!response.ok) {
      let message = `Report request failed with status ${response.status}`;
      try {
        message = JSON.parse(content).error ?? message;
      } catch {
        // Keep the HTTP error when the server did not return JSON.
      }
      throw new Error(message);
    }

    downloadFile(filename, content, contentType);
    setApplicationStatus(`${format} report exported`, "ready");
  } catch (error) {
    setApplicationStatus("Report export failed", "error");
    pathError.textContent = error instanceof Error ? error.message : "Report export failed.";
    pathError.hidden = false;
  }
}

function exportJson() {
  return exportReport("json", "reproproof-report.json", "application/json");
}

function exportMarkdown() {
  return exportReport("markdown", "reproproof-report.md", "text/markdown");
}

async function runAudit(event) {
  event.preventDefault();
  const path = repositoryPath.value.trim();
  pathError.hidden = true;

  if (!path) {
    pathError.textContent = "Enter a repository directory path.";
    pathError.hidden = false;
    repositoryPath.focus();
    return;
  }

  state.audit = null;
  state.execution = null;
  state.rehearsal = null;
  setBusy(true);
  setApplicationStatus("Auditing locally…", "busy");
  setProgress("scanning", "Scanning repository…", "Reading safe text metadata");

  try {
    await wait(120);
    setProgress("checking", "Checking reproducibility…", "Building evidence-backed findings");
    const audit = await requestJson("/api/audits", {
      method: "POST",
      body: JSON.stringify({ repositoryPath: path }),
    });
    state.audit = audit;
    setProgress("complete", "Audit complete", `${audit.findings.length} checks evaluated`);
    renderAudit();
  } catch (error) {
    setProgress("complete", "Audit could not run", "Check the repository path and try again");
    progressBar.classList.add("is-error");
    pathError.textContent = error instanceof Error ? error.message : "Audit failed.";
    pathError.hidden = false;
    setApplicationStatus("Audit failed", "error");
  } finally {
    setBusy(false);
  }
}

async function runProjectTest() {
  if (!state.audit || state.busy) return;
  setBusy(true);
  setApplicationStatus("Running project tests…", "busy");
  updateVerificationStatus("running");

  try {
    const response = await requestJson(`/api/audits/${state.audit.auditId}/test`, { method: "POST" });
    state.execution = response.execution;
    renderExecutionOutput();
    updateVerificationStatus(state.execution.status);
    setApplicationStatus("Project test finished", state.execution.status === "passed" ? "ready" : "error");
  } catch (error) {
    updateVerificationStatus("failed");
    executionOutput.hidden = false;
    executionOutput.innerHTML = `<p class="inline-error">${escapeHtml(error instanceof Error ? error.message : "Project test failed.")}</p>`;
    setApplicationStatus("Project test failed", "error");
  } finally {
    setBusy(false);
  }
}

async function runRehearsal() {
  if (!state.audit || state.busy) return;
  setBusy(true);
  setApplicationStatus("Running clean-room rehearsal…", "busy");
  updateVerificationStatus("running");

  try {
    const response = await requestJson(`/api/audits/${state.audit.auditId}/rehearsal`, { method: "POST" });
    state.rehearsal = response.rehearsal;
    renderExecutionOutput();
    updateDockerStatus(state.rehearsal);
    updateVerificationStatus(state.rehearsal.status);
    const rehearsalType = state.rehearsal.status === "passed" ? "ready" : state.rehearsal.status === "failed" ? "error" : "";
    setApplicationStatus(`Rehearsal ${state.rehearsal.status}`, rehearsalType);
  } catch (error) {
    updateVerificationStatus("failed");
    executionOutput.hidden = false;
    executionOutput.innerHTML = `<p class="inline-error">${escapeHtml(error instanceof Error ? error.message : "Clean-room rehearsal failed.")}</p>`;
    setApplicationStatus("Rehearsal failed", "error");
  } finally {
    setBusy(false);
  }
}

async function checkHealth() {
  try {
    const health = await requestJson("/api/health");
    setApplicationStatus("Local app ready", "ready");
    serverCheck.textContent = "Ready";
    versionLabel.textContent = `Version ${health.version}`;
  } catch (error) {
    setApplicationStatus("Local app unavailable", "error");
    serverCheck.textContent = "Unavailable";
    console.error("Could not reach the ReproProof health endpoint:", error);
  }
}

auditForm.addEventListener("submit", runAudit);
runTestButton.addEventListener("click", runProjectTest);
runRehearsalButton.addEventListener("click", runRehearsal);
exportJsonButton.addEventListener("click", exportJson);
exportMarkdownButton.addEventListener("click", exportMarkdown);
filterButtons.forEach((button) => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  renderFindings();
}));

checkHealth();
