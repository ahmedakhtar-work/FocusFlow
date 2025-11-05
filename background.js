// (future expansion) rn it just checks status
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.local.set({ showOnboarding: true });
  }
});
