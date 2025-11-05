const KEYWORD_ALLOWLIST_KEY = "focus_allow_keywords";
const CHANNEL_WHITELIST_KEY = "focus_whitelist_channels";
const PASSWORD_KEY = "focus_password";

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}
function removeStorage(keys) {
  return new Promise(resolve => chrome.storage.local.remove(keys, resolve));
}

async function init() {
  const data = await getStorage([KEYWORD_ALLOWLIST_KEY, CHANNEL_WHITELIST_KEY]);
  document.getElementById("keywords").value = (data[KEYWORD_ALLOWLIST_KEY] || []).join(", ");
  document.getElementById("channels").value = (data[CHANNEL_WHITELIST_KEY] || []).join(", ");
}

document.getElementById("save-keywords").addEventListener("click", async () => {
  const val = document.getElementById("keywords").value.trim();
  const list = val ? val.split(",").map(x => x.trim()).filter(Boolean) : [];
  await setStorage({ [KEYWORD_ALLOWLIST_KEY]: list });
  alert("✅ Keywords saved successfully.");
});

document.getElementById("save-channels").addEventListener("click", async () => {
  const val = document.getElementById("channels").value.trim();
  const list = val ? val.split(",").map(x => x.trim()).filter(Boolean) : [];
  await setStorage({ [CHANNEL_WHITELIST_KEY]: list });
  alert("✅ Whitelisted channels saved successfully.");
});

document.getElementById("save-password").addEventListener("click", async () => {
  const newPass = document.getElementById("new-password").value.trim();
  if (newPass.length < 6) {
    alert("❌ Password must be at least 6 characters long.");
    return;
  }
  await setStorage({ [PASSWORD_KEY]: newPass });
  alert("🔒 Password updated successfully.");
  document.getElementById("new-password").value = "";
});

document.getElementById("reset-all").addEventListener("click", async () => {
  if (confirm("Are you sure you want to reset all FocusFlow settings?")) {
    await removeStorage([KEYWORD_ALLOWLIST_KEY, CHANNEL_WHITELIST_KEY, PASSWORD_KEY]);
    alert("♻️ All settings have been reset.");
    document.getElementById("keywords").value = "";
    document.getElementById("channels").value = "";
    document.getElementById("new-password").value = "";
  }
});

// start the page coders
init().catch(console.error);
