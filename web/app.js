const appStatus = document.querySelector("#app-status");
const serverCheck = document.querySelector("#server-check");
const versionLabel = document.querySelector("#version-label");

async function checkHealth() {
  try {
    const response = await fetch("/api/health");

    if (!response.ok) {
      throw new Error(`Health check returned ${response.status}`);
    }

    const health = await response.json();
    appStatus.textContent = "Local app ready";
    appStatus.classList.add("is-ready");
    serverCheck.textContent = "Ready";
    versionLabel.textContent = `Version ${health.version}`;
  } catch (error) {
    appStatus.textContent = "Local app unavailable";
    appStatus.classList.add("is-error");
    serverCheck.textContent = "Unavailable";
    console.error("Could not reach the ReproProof health endpoint:", error);
  }
}

checkHealth();
