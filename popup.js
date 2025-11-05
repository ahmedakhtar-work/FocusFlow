// popup.js (v4 — Shorts Slayer Edition)

const toggleBtn = document.getElementById("toggle");
const statusText = document.querySelector("#status span");
const passwordSection = document.getElementById("password-section");
const passwordInput = document.getElementById("password");
const unlockBtn = document.getElementById("unlock");
const shortsCheckbox = document.getElementById("block-shorts");

const STORAGE_KEY = "focus_mode_enabled";
const PASSWORD_KEY = "focus_password";
const SHORTS_BLOCK_KEY = "block_shorts";

// Helper wrappers for async Chrome storage
function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setStorage(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// this checks if the password is alright okay? conditions: 6 minimum, 9 maximum, cannot be empty
function validatePassword(pwd) {
  if (!pwd) return { valid: false, message: "Password cannot be empty." };
  if (!/^\d+$/.test(pwd)) return { valid: false, message: "Password must contain digits only (0–9)." };
  if (pwd.length < 6) return { valid: false, message: "Password must be at least 6 digits long." };
  if (pwd.length > 9) return { valid: false, message: "Password cannot exceed 9 digits." };
  return { valid: true };
}

// Start the UI State
(async function init() {
  const data = await getStorage([STORAGE_KEY, SHORTS_BLOCK_KEY]);
  const active = data[STORAGE_KEY] || false;
  const shortsBlocked = data[SHORTS_BLOCK_KEY] || false;
  updateUI(active);
  if (shortsCheckbox) shortsCheckbox.checked = shortsBlocked;
})();

function updateUI(isActive) {
  statusText.textContent = isActive ? "On" : "Off";
  toggleBtn.textContent = isActive ? "Enter Password to Disable Focus Mode" : "Enable Focus Mode";
  toggleBtn.style.background = isActive ? "#d73a49" : "#238636";
  if (passwordSection) passwordSection.style.display = isActive ? "block" : "none";
  if (shortsCheckbox) shortsCheckbox.disabled = !isActive; // shorts toggle only works when focus mode is ON
}

// Toggle Button on or off
toggleBtn.addEventListener("click", async () => {
  const data = await getStorage([STORAGE_KEY, PASSWORD_KEY]);
  const active = data[STORAGE_KEY] || false;

  if (!active) {
    // this should be self explanatory but it asks you a password
    const password = prompt("Set a numeric password (minimum 6 digits) to disable Focus Mode later:");

    const check = validatePassword(password);
    if (!check.valid) return alert(check.message);

    await setStorage({ [STORAGE_KEY]: true, [PASSWORD_KEY]: password });
    updateUI(true);

    // Notify all tabs like at that moment
    chrome.tabs.query({}, tabs => {
      for (const t of tabs) {
        chrome.tabs.sendMessage(t.id, { type: "focusflow:enabled" }, () => {});
      }
    });

    alert("Focus Mode enabled successfully!");
  } else {
    // Already active — show password input area
    if (passwordSection) passwordSection.style.display = "block";
  }
});

// safe attach: only if open-options exists
const openOptionsBtn = document.getElementById("open-options");
if (openOptionsBtn) {
  openOptionsBtn.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// show / hide password button (safe attach)
const pwToggle = document.getElementById("pw-toggle");
if (pwToggle && passwordInput) {
  pwToggle.addEventListener("click", () => {
    const type = passwordInput.getAttribute("type") === "password" ? "text" : "password";
    passwordInput.setAttribute("type", type);
  });
}

// Handle unlock / disable button
if (unlockBtn) {
  unlockBtn.addEventListener("click", async () => {
    const input = passwordInput && passwordInput.value ? passwordInput.value.trim() : "";
    if (!input) return alert("Please enter your password to disable Focus Mode.");

    // Always freshly fetch the stored password AND current mode
    const data = await getStorage([PASSWORD_KEY, STORAGE_KEY]);
    const storedPassword = data[PASSWORD_KEY];
    const isActive = data[STORAGE_KEY];

    if (!isActive) {
      alert("Focus Mode is already off.");
      updateUI(false);
      return;
    }

    if (storedPassword && input === storedPassword) {
      await setStorage({ [STORAGE_KEY]: false });
      updateUI(false);
      if (passwordInput) passwordInput.value = "";

      chrome.tabs.query({ url: "*://*.youtube.com/*" }, tabs => {
        for (const t of tabs) {
          chrome.tabs.sendMessage(t.id, { type: "focusflow:disabled" }, () => {});
        }
      });

      alert("Focus Mode disabled.");
    } else {
      alert("Incorrect password. Try again.");
      if (passwordInput) { passwordInput.value = ""; passwordInput.focus(); }
    }
  });
}

// Shorts blocker toggle logic
 if (shortsCheckbox) {
  shortsCheckbox.addEventListener("change", async () => {
    const enabled = shortsCheckbox.checked;
    await setStorage({ [SHORTS_BLOCK_KEY]: enabled });
    chrome.tabs.query({ url: "*://*.youtube.com/*" }, tabs => {
      for (const t of tabs) {
        chrome.tabs.sendMessage(t.id, { type: "focusflow:update_shorts_block" }, () => {});
      }
    });


  });
 // --- Shorts Block Toggle ---
 const shortsToggle = document.getElementById("shorts-toggle");

 // Load initial Shorts setting
 (async function initShorts() {
  const data = await getStorage(["block_shorts_enabled"]);
  const shortsActive = data["block_shorts_enabled"] || false;
  shortsToggle.checked = shortsActive;
})();

 // Listen for changes
 shortsToggle.addEventListener("change", async () => {
  const enabled = shortsToggle.checked;
  await setStorage({ block_shorts_enabled: enabled });

  chrome.tabs.query({}, tabs => {
    for (const t of tabs) {
      chrome.tabs.sendMessage(t.id, {
        type: "focusflow:shorts_toggle",
        enabled
      });
    }
  });

  alert(enabled ? "YouTube Shorts are now blocked." : "YouTube Shorts are now visible.");
});

}

