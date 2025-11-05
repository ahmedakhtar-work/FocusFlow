// FocusFlow content script (v3.1)
// - Filters out non-educational YouTube content (including Shorts, playlists).
// - Smarter text heuristics + entertainment keyword blacklist.
// - Pauses videos + overlays blocked pages.
// - Uses persistent Chrome storage state.
// - Added global Shorts blocking toggle.

const FOCUS_MODE_KEY = "focus_mode_enabled";
const CHANNEL_WHITELIST_KEY = "focus_whitelist_channels";
const KEYWORD_ALLOWLIST_KEY = "focus_allow_keywords";
const BLOCK_SHORTS_KEY = "focus_block_shorts"; // 🔹 NEW: controls Shorts blocking

// allows default keywords (all the good education stuff)
const DEFAULT_ALLOW_KEYWORDS = [
  "lecture", "tutorial", "how to", "course", "class", "lesson",
  "study", "explain", "explanation", "guide", "physics", "chemistry",
  "biology", "math", "mathematics", "algebra", "calculus", "engineering",
  "science", "programming", "coding", "khan academy", "crashcourse",
  "mit", "ocw", "coursera", "edx", "educational", "experiment", "revision",
  "exam", "notes", "concept", "topic", "university", "school"
];

// Default educational channels
const DEFAULT_CHANNEL_WHITELIST = [
  "Khan Academy", "CrashCourse", "MIT OpenCourseWare", "3Blue1Brown",
  "Computerphile", "Numberphile", "freeCodeCamp.org", "TED-Ed",
  "Kurzgesagt", "Veritasium", "MinutePhysics", "SmarterEveryDay"
];

// Entertainment / distraction blacklisted keywords
const ENTERTAINMENT_BLACKLIST = [
  "prank", "challenge", "funny", "vlog", "reaction", "music video",
  "lyrics", "song", "meme", "dance", "gaming", "fortnite", "minecraft",
  "mrbeast", "clips", "shorts", "highlight", "trailer", "movie", "show", 
  "asmr", "podcast", "stream", "celebrity", "tiktok", "standup", "roast" , "roblox"
];

// Video item selectors
const VIDEO_ITEM_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-rich-grid-media",
  "ytd-reel-video-renderer",       // Shorties
  "ytd-compact-video-renderer",
  "ytd-playlist-renderer"          // Playlisties
];

function norm(s = "") {
  return String(s).toLowerCase().trim();
}

function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function isEducationalByText(title, channel, allowKeywords, channelWhitelist) {
  const t = norm(title);
  const c = norm(channel);

  for (const bad of ENTERTAINMENT_BLACKLIST) {
    if (t.includes(norm(bad)) || c.includes(norm(bad))) return false;
  }

  for (const ch of channelWhitelist) {
    if (c.includes(norm(ch))) return true;
  }

  for (const kw of allowKeywords) {
    if (t.includes(norm(kw)) || c.includes(norm(kw))) return true;
  }

  if (t.length < 10 || /[\u{1F300}-\u{1FAFF}]/u.test(t)) return false;

  return false;
}

function extractTitleAndChannel(node) {
  let title = "";
  let channel = "";

  const titleSelectors = [
    "#video-title", "a#video-title",
    "yt-formatted-string#title", "h3 a", "h3.title"
  ];
  for (const sel of titleSelectors) {
    const el = node.querySelector(sel);
    if (el && el.innerText) { title = el.innerText; break; }
  }

  const channelSelectors = [
    "ytd-channel-name", "ytd-channel-name a",
    ".ytd-channel-name", "a.yt-simple-endpoint.yt-formatted-string",
    "span.channel-title"
  ];
  for (const sel of channelSelectors) {
    const el = node.querySelector(sel);
    if (el && el.innerText) { channel = el.innerText; break; }
  }

  if (!title && node.innerText) title = node.innerText.slice(0, 200);
  return { title, channel };
}

function hideNode(node) {
  if (!node) return;
  node.dataset.focusflowHidden = "1";
  node.style.display = "none";
}
function showNode(node) {
  if (!node) return;
  if (node.dataset.focusflowHidden) {
    node.style.display = "";
    delete node.dataset.focusflowHidden;
  }
}

function showBlockedOverlay(reason = "Blocked by FocusFlow") {
  if (document.getElementById("focusflow-block-overlay")) return;
  const overlay = document.createElement("div");
  overlay.id = "focusflow-block-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.85)",
    color: "#fff",
    zIndex: 999999,
    padding: "20px",
    textAlign: "center",
    fontFamily: "sans-serif"
  });
  overlay.innerHTML = `
    <div style="max-width:720px;">
      <h2 style="margin:0 0 8px 0">⛔ FocusFlow — video blocked</h2>
      <p style="margin:0 0 12px 0; opacity:0.95;">This video doesn’t match your study filters.</p>
      <button id="focusflow-unblock-temporary" style="padding:8px 12px;border-radius:6px;border:none;cursor:pointer;">Allow once</button>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("focusflow-unblock-temporary").addEventListener("click", () => {
    overlay.remove();
    document.querySelector("video")?.play();
  });
}
function removeBlockedOverlay() {
  const el = document.getElementById("focusflow-block-overlay");
  if (el) el.remove();
}

async function processVideoItems() {
  const cfg = await getStorage([
    FOCUS_MODE_KEY,
    CHANNEL_WHITELIST_KEY,
    KEYWORD_ALLOWLIST_KEY,
    BLOCK_SHORTS_KEY // 🔹 include shorts preference
  ]);
  
  const focusMode = cfg[FOCUS_MODE_KEY];
  const blockShorts = cfg[BLOCK_SHORTS_KEY]; // 🔹 new config flag

  if (!focusMode) {
    document.querySelectorAll("[data-focusflow-hidden]").forEach(showNode);
    removeBlockedOverlay();
    return;
  }

  const allowKeywords = cfg[KEYWORD_ALLOWLIST_KEY]?.length
    ? cfg[KEYWORD_ALLOWLIST_KEY]
    : DEFAULT_ALLOW_KEYWORDS;
  const channelWhitelist = cfg[CHANNEL_WHITELIST_KEY]?.length
    ? cfg[CHANNEL_WHITELIST_KEY]
    : DEFAULT_CHANNEL_WHITELIST;

  const allNodes = [];
  for (const sel of VIDEO_ITEM_SELECTORS) {
    document.querySelectorAll(sel).forEach(n => allNodes.push(n));
  }
  const uniqueNodes = Array.from(new Set(allNodes));

  uniqueNodes.forEach(node => {
    // 🔹 NEW: detect Shorts explicitly via link or class
    const link = node.querySelector("a#thumbnail")?.href || "";
    if (blockShorts && (link.includes("/shorts/") || node.tagName.toLowerCase().includes("reel"))) {
      hideNode(node);
      return;
    }

    const { title, channel } = extractTitleAndChannel(node);
    const ok = isEducationalByText(title, channel, allowKeywords, channelWhitelist);
    if (!ok) hideNode(node); else showNode(node);
  });

  // Shorts shelves & trending
  document.querySelectorAll("ytd-rich-section-renderer").forEach(section => {
    const header = section.querySelector("#title")?.innerText?.toLowerCase() || "";
    if (header.includes("shorts") || header.includes("trending") || (blockShorts && header.includes("popular"))) hideNode(section);
  });

  // Playlist pages
  if (location.pathname.includes("/playlist")) {
    document.querySelectorAll("ytd-playlist-video-renderer").forEach(node => {
      const { title, channel } = extractTitleAndChannel(node);
      const ok = isEducationalByText(title, channel, allowKeywords, channelWhitelist);
      if (!ok) hideNode(node); else showNode(node);
    });
  }

  // Watch page filtering
  if (location.pathname.includes("/watch") || location.pathname.includes("/shorts")) {
    // 🔹 Block Shorts pages directly
    if (blockShorts && location.pathname.includes("/shorts")) {
      showBlockedOverlay("Shorts are blocked by FocusFlow");
      document.querySelector("video")?.pause();
      return;
    }

    let watchTitle = "";
    let watchChannel = "";

    const titleSel = ["h1.title yt-formatted-string", "meta[name='title']"];
    for (const s of titleSel) {
      const el = document.querySelector(s);
      if (el) { watchTitle = el.innerText || el.getAttribute("content") || ""; break; }
    }

    const channelSel = ["ytd-channel-name a", "ytd-channel-name"];
    for (const s of channelSel) {
      const el = document.querySelector(s);
      if (el) { watchChannel = el.innerText || ""; break; }
    }

    const allowed = isEducationalByText(watchTitle, watchChannel, allowKeywords, channelWhitelist);
    const v = document.querySelector("video");
    if (!allowed && v) {
      v.pause();
      showBlockedOverlay();
    } else {
      removeBlockedOverlay();
    }
  }
}

// Observe dynamic page changes
let processTimeout = null;
const mo = new MutationObserver(() => {
  if (processTimeout) clearTimeout(processTimeout);
  processTimeout = setTimeout(() => processVideoItems().catch(console.error), 350);
});
mo.observe(document.body, { childList: true, subtree: true });

// Initial run
chrome.storage.local.get([FOCUS_MODE_KEY], data => {
  if (data[FOCUS_MODE_KEY]) processVideoItems().catch(console.error);
});

// Respond to popup.js messages
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "focusflow:enabled") processVideoItems();
  if (msg.type === "focusflow:disabled") {
    document.querySelectorAll("[data-focusflow-hidden]").forEach(showNode);
    removeBlockedOverlay();
  }
});

