/** @format */

const SESSION_STORAGE_KEY = "telerealm.sessionToken";
const TRASH_STORAGE_KEY = "telerealm.trashedFileIDs";
const THUMBNAIL_SCALE_KEY = "telerealm.thumbnailScale";
const SNAPSHOT_CACHE_KEY = "telerealm.snapshotCache.v1";

const CACHE_TTL_MS = {
  bots: 90_000,
  chats: 60_000,
  files: 45_000,
};

const state = {
  token: localStorage.getItem(SESSION_STORAGE_KEY) || "",
  user: null,
  isPublicShareMode: false,
  publicShareToken: "",
  publicShare: null,
  bots: [],
  chats: [],
  files: [],
  activeBot: null,
  activeChat: null,

  // Navigation State
  activeSection: "home", // home, workspaces, category, settings, help, trash
  activeCategory: "", // photos, videos, documents, audio, shared
  activeFolder: null, // current browsed folder name

  search: "",
  viewMode: "grid",
  sidebarCollapsed: localStorage.getItem("telerealm.sidebarCollapsed") === "1",
  dateFrom: "",
  dateTo: "",
  folderFilter: "",
  currentPage: 1,
  pageSize: Number(localStorage.getItem("telerealm.pageSize") || "8"),
  thumbnailScale: Number(localStorage.getItem(THUMBNAIL_SCALE_KEY) || "1"),
  selectedFileIDs: new Set(),
  trashedFileIDs: new Set(
    JSON.parse(localStorage.getItem(TRASH_STORAGE_KEY) || "[]"),
  ),

  // Preview
  previewFiles: [],
  previewIndex: 0,
  notifications: [],
  shareSelection: [],
  generatedShareUrl: "",
};

let loadingDepth = 0;
const memorySnapshotCache = new Map();

let pendingUploadFiles = [];
let dragDepth = 0;

// UI Element Selection
const authScreen = document.getElementById("authScreen");
const appScreen = document.getElementById("appScreen");
const authMessage = document.getElementById("authMessage");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const botModal = document.getElementById("botModal");
const fileModal = document.getElementById("fileModal");
const settingsModal = document.getElementById("settingsModal");
const helpModal = document.getElementById("helpModal");

// Workspace Lists & Grids
const botList = document.getElementById("botList");
const chatList = document.getElementById("chatList");
const fileGrid = document.getElementById("fileGrid");
const foldersSection = document.getElementById("foldersSection");
const foldersGrid = document.getElementById("foldersGrid");
const workspacePanel = document.querySelector(".workspace");

// Title, Breadcrumbs, Headers
const workspaceTitle = document.getElementById("workspaceTitle");
const workspaceSub = document.getElementById("workspaceSub");
const backBtn = document.getElementById("backBtn");
const topSectionLabel = document.getElementById("topSectionLabel");
const fileCount = document.getElementById("fileCount");
const selectedChatInfo = document.getElementById("selectedChatInfo");

// Filters & Controls
const dateFromFilter = document.getElementById("dateFromFilter");
const dateToFilter = document.getElementById("dateToFilter");
const folderFilterInput = document.getElementById("folderFilter");
const sizeSlider = document.getElementById("sizeSlider");
const pageSizeSelector = document.getElementById("pageSizeSelector");
const pageNumbersContainer = document.getElementById("pageNumbersContainer");
const selectVisibleBtn = document.getElementById("selectVisibleBtn");
const bulkDownloadBtn = document.getElementById("bulkDownloadBtn");
const shareSelectedBtn = document.getElementById("shareSelectedBtn");
const bulkFolderBtn = document.getElementById("bulkFolderBtn");
const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const selectionSummary = document.getElementById("selectionSummary");
const paginationSummary = document.getElementById("paginationSummary");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");

// Actions & Search
const syncChatsBtn = document.getElementById("syncChatsBtn");
const reloadFilesBtn = document.getElementById("reloadFilesBtn");
const uploadBtn = document.getElementById("uploadBtn");
const fileSearch = document.getElementById("fileSearch");
const gridViewBtn = document.getElementById("gridViewBtn");
const listViewBtn = document.getElementById("listViewBtn");
const sidebarToggle = document.getElementById("sidebarToggle");
const createBotToggle = document.getElementById("createBotToggle");
const logoutBtn = document.getElementById("logoutBtn");

// User Info
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const avatar = document.getElementById("avatar");
const avatarBadge = document.getElementById("avatarBadge");
const userBadgeName = document.getElementById("userBadgeName");

// Loaders & Upload Progress
const loadingOverlay = document.getElementById("loadingOverlay");
const loadingText = document.getElementById("loadingText");
const fileDropzone = document.getElementById("fileDropzone");
const fileInput = document.getElementById("fileInput");
const pickFilesBtn = document.getElementById("pickFilesBtn");
const fileDropHint = document.getElementById("fileDropHint");
const selectedFilesList = document.getElementById("selectedFilesList");
const uploadProgressPopup = document.getElementById("uploadProgressPopup");
const uploadProgressLabel = document.getElementById("uploadProgressLabel");
const uploadProgressMeta = document.getElementById("uploadProgressMeta");
const uploadProgressDetail = document.getElementById("uploadProgressDetail");
const uploadProgressFill = document.getElementById("uploadProgressFill");

// Preview Modal
const previewModal = document.getElementById("previewModal");
const previewImage = document.getElementById("previewImage");
const previewTitle = document.getElementById("previewTitle");
const previewChatInfo = document.getElementById("previewChatInfo");
const previewMeta = document.getElementById("previewMeta");
const previewOpenLink = document.getElementById("previewOpenLink");
const previewPrevBtn = document.getElementById("previewPrevBtn");
const previewNextBtn = document.getElementById("previewNextBtn");
const toast = document.getElementById("toast");
const shareModal = document.getElementById("shareModal");
const shareForm = document.getElementById("shareForm");
const shareTitle = document.getElementById("shareTitle");
const shareRecipients = document.getElementById("shareRecipients");
const shareNote = document.getElementById("shareNote");
const shareFileSummary = document.getElementById("shareFileSummary");
const shareLinkOutput = document.getElementById("shareLinkOutput");
const copyShareLinkBtn = document.getElementById("copyShareLinkBtn");
const shareButton = document.getElementById("shareSelectedBtn");
const notificationsModal = document.getElementById("notificationsModal");
const notificationsList = document.getElementById("notificationsList");
const notificationBadge = document.getElementById("notificationBadge");

// Fetch API Wrapper
function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }

  return fetch(path, {
    ...options,
    headers,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || payload.message || "Request failed");
    }
    return payload;
  });
}

function unwrap(response) {
  return response?.data ?? response;
}

function normalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.results)) return value.results;
  if (Array.isArray(value.files)) return value.files;
  if (Array.isArray(value.chats)) return value.chats;
  if (Array.isArray(value.bots)) return value.bots;
  if (Array.isArray(value.data)) return value.data;
  return [];
}

// Toast Alert System
function showToast(message, tone = "") {
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast show";
  if (tone) toast.classList.add(tone);

  window.clearTimeout(window.toastTimeout);
  window.toastTimeout = window.setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.style.color = isError ? "#ef4444" : "#22c55e";
}

function setLoading(active, message) {
  if (!loadingOverlay) return;
  loadingOverlay.classList.toggle("hidden", !active);
  if (loadingText && message) {
    loadingText.textContent = message;
  }
}

function beginLoading(message) {
  loadingDepth += 1;
  const locale = window.TeleRealmI18n?.getLocale?.() || "vi";
  setLoading(
    true,
    message ||
      (locale === "vi" ? "Đang xử lý yêu cầu..." : "Processing request..."),
  );
}

function endLoading() {
  loadingDepth = Math.max(0, loadingDepth - 1);
  if (loadingDepth === 0) {
    setLoading(false);
  }
}

function getSidebarTooltipLabel(element) {
  if (!element) return "";
  const spanText = element.querySelector("span")?.textContent?.trim();
  if (spanText) return spanText;
  const ariaLabel = element.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;
  return element.textContent?.trim() || "";
}

function applySidebarTooltips() {
  const targets = document.querySelectorAll(
    ".drive-nav__item, .workspace-nav-item, .category-nav-item, .sidebar-bottom-item, .add-bot-btn",
  );

  targets.forEach((element) => {
    const label = getSidebarTooltipLabel(element);
    if (!label) return;

    if (state.sidebarCollapsed) {
      element.setAttribute("title", label);
      element.setAttribute("aria-label", label);
      return;
    }

    if (
      element.classList.contains("workspace-nav-item") ||
      element.classList.contains("category-nav-item")
    ) {
      element.removeAttribute("title");
    }
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPageSizeOptions() {
  return [4, 8, 16, 32, 64];
}

function sanitizePageSize(value) {
  const numeric = Number(value);
  return getPageSizeOptions().includes(numeric) ? numeric : 8;
}

function applyViewScale() {
  if (!fileGrid) return;
  const scale = clamp(Number(state.thumbnailScale) || 1, 0.75, 1.6);
  fileGrid.style.setProperty("--grid-thumb-scale", String(scale));
  fileGrid.style.setProperty("--list-row-scale", String(scale));
  if (sizeSlider && Number(sizeSlider.value) !== scale) {
    sizeSlider.value = String(scale);
  }
}

function getPagedFiles(files) {
  const totalPages = Math.max(1, Math.ceil(files.length / state.pageSize));
  state.currentPage = clamp(state.currentPage, 1, totalPages);
  const start = (state.currentPage - 1) * state.pageSize;
  return {
    totalPages,
    pageFiles: files.slice(start, start + state.pageSize),
  };
}

function buildPageButtons(totalPages, currentPage) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  for (let offset = -1; offset <= 1; offset += 1) {
    const page = currentPage + offset;
    if (page > 1 && page < totalPages) pages.add(page);
  }

  const orderedPages = Array.from(pages).sort((a, b) => a - b);
  const result = [];
  for (let index = 0; index < orderedPages.length; index += 1) {
    const page = orderedPages[index];
    const previous = orderedPages[index - 1];
    if (index > 0 && page - previous > 1) {
      if (page - previous === 2) {
        result.push(previous + 1);
      } else {
        result.push("...");
      }
    }
    result.push(page);
  }
  return result;
}

function renderPageNumbers(totalPages, currentPage) {
  if (!pageNumbersContainer) return;

  pageNumbersContainer.innerHTML = "";
  const pageSequence = buildPageButtons(totalPages, currentPage);

  pageSequence.forEach((item) => {
    if (item === "...") {
      const ellipsis = document.createElement("span");
      ellipsis.className = "page-number-ellipsis";
      ellipsis.textContent = "...";
      pageNumbersContainer.appendChild(ellipsis);
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `page-number-btn${item === currentPage ? " active" : ""}`;
    button.dataset.page = String(item);
    button.textContent = String(item);
    pageNumbersContainer.appendChild(button);
  });
}

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function tokenScopeFrom(token) {
  return token ? token.slice(0, 24) : "anon";
}

function getCurrentTokenScope() {
  return tokenScopeFrom(state.token);
}

function buildSnapshotCacheKey(scope, suffix = "") {
  return `${getCurrentTokenScope()}:${scope}:${suffix}`;
}

function readSnapshotStore() {
  const raw = sessionStorage.getItem(SNAPSHOT_CACHE_KEY);
  return safeJsonParse(raw || "{}", {});
}

function writeSnapshotStore(store) {
  sessionStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(store));
}

function readSnapshotCache(cacheKey, ttlMs) {
  const now = Date.now();

  const memoryEntry = memorySnapshotCache.get(cacheKey);
  if (memoryEntry && now - memoryEntry.ts <= ttlMs) {
    return memoryEntry.data;
  }
  if (memoryEntry) {
    memorySnapshotCache.delete(cacheKey);
  }

  const store = readSnapshotStore();
  const entry = store[cacheKey];
  if (!entry) return null;

  if (now - entry.ts > ttlMs) {
    delete store[cacheKey];
    writeSnapshotStore(store);
    return null;
  }

  memorySnapshotCache.set(cacheKey, entry);
  return entry.data;
}

function writeSnapshotCache(cacheKey, data) {
  const entry = { ts: Date.now(), data };
  memorySnapshotCache.set(cacheKey, entry);

  const store = readSnapshotStore();
  store[cacheKey] = entry;
  writeSnapshotStore(store);
}

function removeSnapshotCacheBy(predicate) {
  const store = readSnapshotStore();
  let changed = false;

  Object.keys(store).forEach((key) => {
    if (!predicate(key)) return;
    delete store[key];
    changed = true;
  });

  if (changed) {
    writeSnapshotStore(store);
  }

  Array.from(memorySnapshotCache.keys()).forEach((key) => {
    if (predicate(key)) {
      memorySnapshotCache.delete(key);
    }
  });
}

function invalidateSnapshotScope(scope, suffixPrefix = "") {
  const prefix = `${getCurrentTokenScope()}:${scope}:`;
  removeSnapshotCacheBy(
    (key) =>
      key.startsWith(prefix) &&
      (!suffixPrefix || key.startsWith(`${prefix}${suffixPrefix}`)),
  );
}

function clearSnapshotCacheForToken(token) {
  const scopePrefix = `${tokenScopeFrom(token)}:`;
  removeSnapshotCacheBy((key) => key.startsWith(scopePrefix));
}

async function fetchWithSnapshotCache({
  scope,
  suffix = "",
  ttlMs,
  force = false,
  loader,
}) {
  const cacheKey = buildSnapshotCacheKey(scope, suffix);

  if (!force) {
    const cached = readSnapshotCache(cacheKey, ttlMs);
    if (cached !== null) {
      return cached;
    }
  }

  const freshData = await loader();
  writeSnapshotCache(cacheKey, freshData);
  return freshData;
}

async function withLoading(message, task) {
  beginLoading(message);
  try {
    return await task();
  } finally {
    endLoading();
  }
}

// Sidebar toggle collapsing
function setSidebarCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  localStorage.setItem("telerealm.sidebarCollapsed", collapsed ? "1" : "0");
  appScreen.classList.toggle("sidebar-collapsed", collapsed);
  if (sidebarToggle) {
    sidebarToggle.textContent = collapsed ? "☰" : "⟨⟩";
  }
  applySidebarTooltips();
}

// Helper formats
function prettyBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isPreviewableImage(file) {
  const extension = String(file.format || "")
    .trim()
    .toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(
    extension,
  );
}

// Simulated Trash logic via LocalStorage
function saveTrash() {
  localStorage.setItem(
    TRASH_STORAGE_KEY,
    JSON.stringify(Array.from(state.trashedFileIDs)),
  );
  renderFiles();
}

// Redesigned active navigation view routing
function setViewSection(section, category = "") {
  state.activeSection = section;
  state.activeCategory = category;
  state.activeFolder = null;
  state.currentPage = 1;
  state.selectedFileIDs.clear();

  // Highlight sidebar item active status
  document
    .querySelectorAll(
      ".drive-nav__item, .workspace-nav-item, .category-nav-item",
    )
    .forEach((el) => {
      el.classList.remove("active");
    });

  if (section === "home") {
    document.getElementById("navHome")?.classList.add("active");
    topSectionLabel.textContent = "Home";
  } else if (section === "workspaces") {
    document.getElementById("navWorkspaces")?.classList.add("active");
    topSectionLabel.textContent = "Workspaces";
    if (state.activeChat) {
      const activeEl = document.querySelector(
        `.workspace-nav-item[data-chat-id="${state.activeChat.chat_id}"]`,
      );
      if (activeEl) activeEl.classList.add("active");
    }
  } else if (section === "category") {
    const id = "cat" + category.charAt(0).toUpperCase() + category.slice(1);
    document.getElementById(id)?.classList.add("active");
    topSectionLabel.textContent =
      category.charAt(0).toUpperCase() + category.slice(1);
  } else if (section === "trash") {
    document.getElementById("catTrash")?.classList.add("active");
    topSectionLabel.textContent = "Trash";
  } else if (section === "sharing") {
    topSectionLabel.textContent = "Sharing";
  }

  // Load workspace folders and files
  renderFiles();
}

// Unified dynamic file filtering
function getFilteredFiles() {
  const searchTerm = state.search.toLowerCase();
  const folderTerm = state.folderFilter.toLowerCase();
  const fromDate = dateFromFilter ? dateFromFilter.value : "";
  const toDate = dateToFilter ? dateToFilter.value : "";

  if (state.activeSection === "sharing") {
    return state.files.slice().filter((file) => {
      const haystack =
        `${file.original_name || ""} ${file.file_id || ""} ${file.chat_title || ""} ${file.folder_name || ""}`.toLowerCase();
      if (searchTerm && !haystack.includes(searchTerm)) return false;
      if (
        folderTerm &&
        !(file.folder_name || "").toLowerCase().includes(folderTerm)
      )
        return false;
      const dateValue = file.created_at ? file.created_at.slice(0, 10) : "";
      if (fromDate && dateValue && dateValue < fromDate) return false;
      if (toDate && dateValue && dateValue > toDate) return false;
      return true;
    });
  }

  return state.files.slice().filter((file) => {
    // 1. Trash filter check
    const isTrashed = state.trashedFileIDs.has(file.record_id);
    if (state.activeSection === "trash") {
      if (!isTrashed) return false;
    } else {
      if (isTrashed) return false;
    }

    // 2. Chat filter check
    if (state.activeSection === "workspaces" && state.activeChat) {
      if (file.chat_id !== state.activeChat.chat_id) return false;
    }

    // 3. Categories format check
    if (state.activeSection === "category") {
      const ext = String(file.format || "")
        .trim()
        .toLowerCase();
      if (state.activeCategory === "photos") {
        if (!["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext))
          return false;
      } else if (state.activeCategory === "videos") {
        if (!["mp4", "mkv", "avi", "mov", "webm", "flv"].includes(ext))
          return false;
      } else if (state.activeCategory === "documents") {
        if (
          ![
            "pdf",
            "docx",
            "doc",
            "xls",
            "xlsx",
            "ppt",
            "pptx",
            "txt",
            "zip",
            "rar",
            "tar",
            "gz",
          ].includes(ext)
        )
          return false;
      } else if (state.activeCategory === "audio") {
        if (!["mp3", "wav", "flac", "m4a", "ogg"].includes(ext)) return false;
      }
    }

    // 4. Folder deep navigation filter
    if (state.activeFolder) {
      if ((file.folder_name || "").trim() !== state.activeFolder) return false;
    }

    // 5. Normal search keyword filters
    const haystack =
      `${file.original_name || ""} ${file.file_id || ""} ${file.chat_title || ""} ${file.folder_name || ""}`.toLowerCase();
    if (searchTerm && !haystack.includes(searchTerm)) return false;

    // 6. Secondary folder input filters
    if (
      folderTerm &&
      !(file.folder_name || "").toLowerCase().includes(folderTerm)
    )
      return false;

    // 7. Date interval filters
    const dateValue = file.created_at ? file.created_at.slice(0, 10) : "";
    if (fromDate && dateValue && dateValue < fromDate) return false;
    if (toDate && dateValue && dateValue > toDate) return false;

    return true;
  });
}

// File Thumbnail design matching reference formats
function renderFileThumb(file) {
  const format = escapeHtml((file.format || "FILE").toUpperCase());
  if (file.secure_url && isPreviewableImage(file)) {
    return `
      <div class="thumb" data-preview-id="${file.record_id}">
        <img src="${escapeHtml(file.secure_url)}" alt="${escapeHtml(file.original_name || file.record_id)}" loading="lazy" />
        <span class="thumb-overlay">Preview</span>
      </div>
    `;
  }

  // Visual icons for non-images
  let iconColor = "var(--text-muted)";
  if (["PDF"].includes(format)) iconColor = "var(--danger)";
  else if (["XLSX", "XLS"].includes(format)) iconColor = "var(--success)";
  else if (["DOCX", "DOC"].includes(format)) iconColor = "#2563eb";
  else if (["ZIP", "RAR"].includes(format)) iconColor = "var(--warning)";

  return `
    <div class="thumb">
      <div class="thumb-badge" style="color: ${iconColor};">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${format}</span>
      </div>
    </div>
  `;
}

// Workspace UI Folder / File renderer
function renderFiles() {
  fileGrid.innerHTML = "";
  fileGrid.className =
    state.viewMode === "list" ? "files-grid list-mode" : "files-grid";
  applyViewScale();

  const allFiltered = getFilteredFiles();
  const { totalPages, pageFiles } = getPagedFiles(allFiltered);
  fileCount.textContent = `${allFiltered.length} file(s)`;

  // Back button breadcrumbs controls
  if (state.activeFolder) {
    backBtn.classList.remove("hidden");
  } else {
    backBtn.classList.add("hidden");
  }

  // Breadcrumbs title rendering
  if (state.activeSection === "home") {
    workspaceTitle.innerHTML = `Home <span class="subtitle">Quick access files overview</span>`;
  } else if (state.activeSection === "workspaces" && state.activeChat) {
    const parentPath = escapeHtml(
      state.activeChat.title || state.activeChat.chat_id,
    );
    if (state.activeFolder) {
      workspaceTitle.innerHTML = `${parentPath} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline; margin: 0 4px;"><polyline points="9 18 15 12 9 6"/></svg> <span style="font-weight: 500; color: var(--primary);">${escapeHtml(state.activeFolder)}</span>`;
    } else {
      workspaceTitle.innerHTML = `${parentPath} <span class="subtitle">Telegram chat workspace storage</span>`;
    }
  } else if (state.activeSection === "category") {
    workspaceTitle.innerHTML = `${state.activeCategory.charAt(0).toUpperCase() + state.activeCategory.slice(1)} <span class="subtitle">Filtered file assets category</span>`;
  } else if (state.activeSection === "trash") {
    workspaceTitle.innerHTML = `Trash <span class="subtitle">Recently trashed workspace files</span>`;
  } else if (state.activeSection === "sharing") {
    const title = state.publicShare?.title || "Shared workspace";
    const note = state.publicShare?.note || "Files shared with you";
    workspaceTitle.innerHTML = `${escapeHtml(title)} <span class="subtitle">${escapeHtml(note)}</span>`;
  }

  // Dynamic Folders Section setup
  if (
    state.activeSection === "workspaces" &&
    state.activeChat &&
    !state.activeFolder
  ) {
    // Collect unique non-empty folder names in this chat
    const folders = Array.from(
      new Set(
        state.files
          .filter(
            (f) =>
              f.chat_id === state.activeChat.chat_id &&
              f.folder_name &&
              !state.trashedFileIDs.has(f.record_id),
          )
          .map((f) => f.folder_name.trim()),
      ),
    ).filter(Boolean);

    if (folders.length > 0) {
      foldersSection.classList.remove("hidden");
      foldersGrid.innerHTML = folders
        .map(
          (folder) => `
        <div class="folder-card" data-folder-click="${escapeHtml(folder)}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>
          <span title="${escapeHtml(folder)}">${escapeHtml(folder)}</span>
        </div>
      `,
        )
        .join("");

      // Bind click on folder card
      foldersGrid.querySelectorAll("[data-folder-click]").forEach((card) => {
        card.addEventListener("click", () => {
          state.activeFolder = card.getAttribute("data-folder-click");
          state.currentPage = 1;
          renderFiles();
        });
      });
    } else {
      foldersSection.classList.add("hidden");
    }
  } else {
    foldersSection.classList.add("hidden");
  }

  // Dynamic File card rendering
  renderPagination(totalPages, allFiltered.length, pageFiles.length);

  if (pageFiles.length === 0) {
    fileGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 12px; display: block;"><circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="12" y2="12"/></svg>
        <strong style="display:block; margin-bottom: 4px; color: var(--text-main);">No items found</strong>
        <span>This section is empty. Try connecting a bot or uploading files.</span>
      </div>
    `;
    return;
  }

  pageFiles.forEach((file) => {
    const card = document.createElement("article");
    const isChecked = state.selectedFileIDs.has(file.record_id);
    card.className = `file-card ${isChecked ? "selected" : ""} is-entering`;
    card.setAttribute("data-record-id", file.record_id);

    const isTrashed = state.activeSection === "trash";
    const isSharingWorkspace = state.activeSection === "sharing";
    card.draggable = !isTrashed && !isSharingWorkspace;

    card.innerHTML = `
      <input type="checkbox" class="file-card__check" ${isChecked ? "checked" : ""} />
      ${renderFileThumb(file)}
      <div class="file-card-info">
        <strong title="${escapeHtml(file.original_name || file.record_id)}">${escapeHtml(file.original_name || file.record_id)}</strong>
        <div class="file-card-meta">
          <span class="size">${prettyBytes(file.bytes || 0)}</span>
          ${file.folder_name ? `<span class="folder-pill" title="${escapeHtml(file.folder_name)}">${escapeHtml(file.folder_name)}</span>` : ""}
        </div>
      </div>
      <div class="file-card-actions">
        ${
          isTrashed ?
            `
          <button class="open-btn restore-btn" type="button">Restore</button>
          <button class="delete-btn perm-delete-btn" type="button">Delete</button>
        `
          : isSharingWorkspace ?
            `
          ${file.secure_url ? `<a class="open-btn" href="${escapeHtml(file.secure_url)}" target="_blank" rel="noreferrer">Open</a>` : ""}
        `
          : `
          ${file.secure_url ? `<a class="open-btn" href="${escapeHtml(file.secure_url)}" target="_blank" rel="noreferrer">Open</a>` : ""}
          <button class="action-btn rename-btn" type="button">Rename</button>
          <button class="delete-btn trash-btn" type="button">Trash</button>
        `
        }
      </div>
    `;

    // Event binding
    const checkEl = card.querySelector(".file-card__check");
    checkEl.addEventListener("change", (e) => {
      toggleSelectedFile(file.record_id, e.target.checked);
    });

    card.addEventListener("dragstart", (event) => {
      if (!card.draggable) return;
      event.dataTransfer?.setData("text/plain", file.record_id);
      event.dataTransfer?.setData(
        "application/x-telerealm-file-id",
        file.record_id,
      );
      event.dataTransfer?.setDragImage(card, 24, 24);
    });

    const previewEl = card.querySelector(".thumb");
    if (previewEl && isPreviewableImage(file)) {
      previewEl.addEventListener("click", () => {
        openPreviewModal(file, allFiltered);
      });
    }

    if (isTrashed) {
      card.querySelector(".restore-btn").addEventListener("click", () => {
        state.trashedFileIDs.delete(file.record_id);
        saveTrash();
        showToast("File restored successfully", "success");
      });
      card
        .querySelector(".perm-delete-btn")
        .addEventListener("click", async () => {
          if (
            !confirm(
              "Are you sure you want to permanently delete this file? This action is irreversible.",
            )
          )
            return;
          try {
            await withLoading("Deleting file permanently...", async () => {
              await api(`/api/files/${file.record_id}`, { method: "DELETE" });
              state.trashedFileIDs.delete(file.record_id);
              localStorage.setItem(
                TRASH_STORAGE_KEY,
                JSON.stringify(Array.from(state.trashedFileIDs)),
              );
              invalidateSnapshotScope(
                "files",
                `${state.activeBot?.id || ""}:${state.activeChat?.chat_id || ""}`,
              );
              await reloadFiles({ force: true });
            });
            showToast("File permanently deleted", "success");
          } catch (err) {
            showToast(err.message, "error");
          }
        });
    } else {
      card.querySelector(".rename-btn").addEventListener("click", async () => {
        const currentName = file.original_name || "";
        const nextName = prompt("Enter new name for the file:", currentName);
        if (!nextName || nextName.trim() === "" || nextName === currentName)
          return;
        try {
          await withLoading("Renaming file...", async () => {
            await api(`/api/files/${file.record_id}`, {
              method: "PATCH",
              body: JSON.stringify({ original_name: nextName.trim() }),
            });
            invalidateSnapshotScope(
              "files",
              `${state.activeBot?.id || ""}:${state.activeChat?.chat_id || ""}`,
            );
            await reloadFiles({ force: true });
          });
          showToast("File renamed successfully", "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      card.querySelector(".trash-btn").addEventListener("click", () => {
        state.trashedFileIDs.add(file.record_id);
        saveTrash();
        showToast("File moved to Trash", "success");
      });
    }

    fileGrid.appendChild(card);
  });
}

// Bulk & Selection Operations
function toggleSelectedFile(fileID, checked) {
  if (checked) {
    state.selectedFileIDs.add(fileID);
  } else {
    state.selectedFileIDs.delete(fileID);
  }
  renderSelectionSummary();

  // Highlight active selected state on card
  const card = document.querySelector(`.file-card[data-record-id="${fileID}"]`);
  if (card) {
    card.classList.toggle("selected", checked);
  }
}

function renderSelectionSummary() {
  const count = state.selectedFileIDs.size;
  if (selectionSummary) {
    selectionSummary.textContent =
      count ? `${count} file(s) selected.` : "No files selected.";
  }
  if (clearSelectionBtn) {
    clearSelectionBtn.classList.toggle("hidden", count === 0);
  }
  const disabled = count === 0;
  const shareDisabled =
    disabled || state.activeSection === "sharing" || state.isPublicShareMode;
  [bulkDownloadBtn, bulkFolderBtn, bulkDeleteBtn].forEach((btn) => {
    if (btn) btn.disabled = disabled || state.isPublicShareMode;
  });
  if (shareSelectedBtn) shareSelectedBtn.disabled = shareDisabled;
}

function parseRecipientEmails(text) {
  return String(text || "")
    .split(/[,\n;]/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function getPublicShareTokenFromPath() {
  const match = window.location.pathname.match(/^\/sharing\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function updateShareSelectionSummary() {
  if (!shareFileSummary) return;
  const selected = state.files.filter((file) =>
    state.selectedFileIDs.has(file.record_id),
  );
  if (selected.length === 0) {
    shareFileSummary.textContent =
      "Select at least one file to create a share link.";
    return;
  }
  const preview = selected
    .slice(0, 3)
    .map((file) => file.original_name || file.record_id)
    .join(", ");
  shareFileSummary.textContent =
    selected.length > 3 ?
      `${selected.length} files selected: ${preview}, ...`
    : `${selected.length} files selected: ${preview}`;
}

function openShareModal() {
  const selected = state.files.filter((file) =>
    state.selectedFileIDs.has(file.record_id),
  );
  if (selected.length === 0) {
    showToast("Select at least one file first", "error");
    return;
  }
  state.shareSelection = selected.map((file) => file.record_id);
  state.generatedShareUrl = "";
  if (shareForm) shareForm.reset();
  if (shareLinkOutput) shareLinkOutput.value = "";
  if (copyShareLinkBtn) copyShareLinkBtn.disabled = true;
  updateShareSelectionSummary();
  openModal(shareModal);
}

async function submitShareLink(event) {
  event.preventDefault();
  const fileIDs =
    state.shareSelection.length ?
      state.shareSelection
    : Array.from(state.selectedFileIDs);
  if (!fileIDs.length) {
    showToast("Select at least one file first", "error");
    return;
  }

  const payload = {
    file_ids: fileIDs,
    recipient_emails: parseRecipientEmails(shareRecipients?.value || ""),
    title: shareTitle?.value?.trim() || "Shared workspace",
    note: shareNote?.value?.trim() || "",
  };

  try {
    const response = await api("/api/share-links", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = unwrap(response) || {};
    const share = data.share || {};
    const shareURL = share.share_url || `/sharing/${share.token || ""}`;
    state.generatedShareUrl = shareURL;
    if (shareLinkOutput)
      shareLinkOutput.value = new URL(
        shareURL,
        window.location.origin,
      ).toString();
    if (copyShareLinkBtn) copyShareLinkBtn.disabled = false;
    if (notificationBadge) {
      const notificationCount =
        Array.isArray(data.notifications) ? data.notifications.length : 0;
      if (notificationCount > 0) {
        notificationBadge.textContent = String(notificationCount);
        notificationBadge.style.display = "inline-block";
      }
    }
    showToast("Share link created successfully", "success");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function copyGeneratedShareLink() {
  if (!shareLinkOutput?.value) return;
  try {
    await navigator.clipboard.writeText(shareLinkOutput.value);
    showToast("Share link copied", "success");
  } catch (_error) {
    showToast("Failed to copy share link", "error");
  }
}

async function loadNotifications() {
  if (!state.token) return [];
  const response = await api("/api/notifications");
  const notifications = normalizeCollection(unwrap(response));
  state.notifications = notifications;
  if (notificationBadge) {
    const unread = notifications.filter((item) => !item.read_at).length;
    if (unread > 0) {
      notificationBadge.textContent = String(unread);
      notificationBadge.style.display = "inline-block";
    } else {
      notificationBadge.style.display = "none";
    }
  }
  return notifications;
}

function renderNotifications() {
  if (!notificationsList) return;
  if (!state.notifications.length) {
    notificationsList.innerHTML = "No notifications yet.";
    return;
  }

  notificationsList.innerHTML = state.notifications
    .map((notification) => {
      const unread = !notification.read_at;
      return `
        <button class="notification-item ${unread ? "is-unread" : ""}" type="button" data-target-url="${escapeHtml(notification.target_url || "")}" data-notification-id="${escapeHtml(notification.id || "")}" style="width: 100%; text-align: left; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); padding: 12px 14px; border-radius: 12px; margin-bottom: 10px; cursor: pointer;">
          <strong style="display:block; margin-bottom: 4px;">${escapeHtml(notification.title || "Notification")}</strong>
          <span style="display:block; color: var(--text-muted); font-size: 13px; margin-bottom: 4px;">${escapeHtml(notification.message || "")}</span>
          <small style="color: var(--text-muted);">${escapeHtml(notification.target_url || "")}</small>
        </button>
      `;
    })
    .join("");

  notificationsList.querySelectorAll("[data-target-url]").forEach((item) => {
    item.addEventListener("click", async () => {
      const targetUrl = item.getAttribute("data-target-url") || "/";
      const notificationID = item.getAttribute("data-notification-id") || "";
      if (notificationID) {
        try {
          await api(`/api/notifications/${notificationID}/read`, {
            method: "POST",
          });
        } catch (_error) {
          // ignore mark-read failures
        }
      }
      window.location.assign(targetUrl);
    });
  });
}

async function openNotificationsModal() {
  if (!state.token) return;
  try {
    await loadNotifications();
    renderNotifications();
    openModal(notificationsModal);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function loadPublicShare(token) {
  const response = await fetch(`/api/share-links/${encodeURIComponent(token)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Share link not found");
  }
  const data = unwrap(payload) || {};
  const files = normalizeCollection(data.files || data);
  state.isPublicShareMode = true;
  state.publicShareToken = token;
  state.publicShare = data.share || { token };
  state.activeSection = "sharing";
  state.files = files;
  state.selectedFileIDs.clear();
  state.activeBot = null;
  state.activeChat = null;
  renderFiles();
}

function clearSelection() {
  state.selectedFileIDs.clear();
  state.shareSelection = [];
  renderSelectionSummary();
  updateShareSelectionSummary();
  document
    .querySelectorAll(".file-card__check")
    .forEach((cb) => (cb.checked = false));
  document
    .querySelectorAll(".file-card")
    .forEach((card) => card.classList.remove("selected"));
}

// Pagination Controls
function renderPagination(totalPages, totalItems, shownItems = 0) {
  if (!totalItems) {
    if (paginationSummary) paginationSummary.textContent = "";
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    if (pageNumbersContainer) pageNumbersContainer.innerHTML = "";
    return;
  }

  if (paginationSummary) {
    paginationSummary.textContent =
      (window.TeleRealmI18n?.getLocale?.() || "vi") === "vi" ?
        `Trang ${state.currentPage} / ${totalPages} (${totalItems} tệp)`
      : `Page ${state.currentPage} of ${totalPages} (${totalItems} items)`;
  }
  if (prevPageBtn) {
    prevPageBtn.textContent =
      (window.TeleRealmI18n?.getLocale?.() || "vi") === "vi" ? "Trước" : "Prev";
    prevPageBtn.disabled = state.currentPage <= 1;
  }
  if (nextPageBtn) {
    nextPageBtn.textContent =
      (window.TeleRealmI18n?.getLocale?.() || "vi") === "vi" ? "Sau" : "Next";
    nextPageBtn.disabled = state.currentPage >= totalPages;
  }
  renderPageNumbers(totalPages, state.currentPage);
}

// Image Gallery Slider controls
function openPreviewModal(file, filesList) {
  const images = filesList.filter((f) => isPreviewableImage(f) && f.secure_url);
  if (images.length === 0) return;
  state.previewFiles = images;
  state.previewIndex = Math.max(
    0,
    images.findIndex((img) => img.record_id === file.record_id),
  );
  renderPreviewModal();
  openModal(previewModal);
}

function renderPreviewModal() {
  const file = state.previewFiles[state.previewIndex];
  if (!file) return;
  previewImage.src = file.secure_url;
  previewImage.alt = file.original_name || file.record_id;
  previewTitle.textContent = file.original_name || "Preview";
  previewMeta.textContent = `${state.previewIndex + 1} of ${state.previewFiles.length} · ${prettyBytes(file.bytes || 0)}`;
  previewOpenLink.href = file.secure_url;
  previewPrevBtn.disabled = state.previewIndex <= 0;
  previewNextBtn.disabled = state.previewIndex >= state.previewFiles.length - 1;
}

function previewStep(delta) {
  const nextIdx = state.previewIndex + delta;
  if (nextIdx < 0 || nextIdx >= state.previewFiles.length) return;
  state.previewIndex = nextIdx;
  renderPreviewModal();
}

function openModal(modal) {
  modal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

// File dropzone handlers
function syncPendingUploadFiles(files) {
  pendingUploadFiles = Array.from(files || []).filter(Boolean);
  if (fileInput) {
    const dt = new DataTransfer();
    pendingUploadFiles.forEach((f) => dt.items.add(f));
    fileInput.files = dt.files;
  }
  renderSelectedUploadFiles();
}

function renderSelectedUploadFiles() {
  if (fileDropHint) {
    const count = pendingUploadFiles.length;
    fileDropHint.textContent =
      count ? `${count} file(s) selected.` : "No files selected yet.";
  }
  if (!selectedFilesList) return;
  selectedFilesList.innerHTML = pendingUploadFiles
    .map(
      (f) => `
      <div class="selected-file-chip">
        <span>${escapeHtml(f.name)}</span>
        <span class="size">${prettyBytes(f.size || 0)}</span>
      </div>
    `,
    )
    .join("");
}

function clearUploadSelection() {
  pendingUploadFiles = [];
  dragDepth = 0;
  if (fileInput) fileInput.value = "";
  if (fileDropzone) fileDropzone.classList.remove("is-dragover");
  renderSelectedUploadFiles();
}

// Upload progress pop-ups
function updateUploadProgress(percent, file, index, total, detail) {
  uploadProgressPopup.classList.remove("hidden");
  if (uploadProgressLabel)
    uploadProgressLabel.textContent =
      (window.TeleRealmI18n?.getLocale?.() || "vi") === "vi" ?
        `Đang tải ${index} / ${total}`
      : `Uploading ${index} of ${total}`;
  if (uploadProgressMeta) uploadProgressMeta.textContent = `${percent}%`;
  if (uploadProgressFill) uploadProgressFill.style.width = `${percent}%`;
  if (uploadProgressDetail)
    uploadProgressDetail.textContent =
      detail || `${file.name} · ${prettyBytes(file.size)}`;
}

function uploadFileWithProgress(file, index, total) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("document", file, file.name);

    // Auto-fill folder context
    const folderInputVal =
      document.getElementById("folderNameInput")?.value?.trim() || "";
    if (folderInputVal) {
      formData.append("folder_name", folderInputVal);
    }

    xhr.open(
      "POST",
      `/api/bots/${state.activeBot.id}/chats/${encodeURIComponent(state.activeChat.chat_id)}/files`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);

    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      updateUploadProgress(pct, file, index, total);
    };

    xhr.onerror = () => reject(new Error(`Failed to upload ${file.name}`));
    xhr.onload = () => {
      let payload = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch (_e) {}
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(
          new Error(
            payload.error ||
              payload.message ||
              `Upload failed for ${file.name}`,
          ),
        );
        return;
      }
      resolve(payload);
    };
    xhr.send(formData);
  });
}

async function uploadSelectedFiles() {
  const files =
    pendingUploadFiles.length ? pendingUploadFiles : (
      Array.from(fileInput?.files || [])
    );
  if (!files.length) return;

  closeModal(fileModal);
  let completed = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    updateUploadProgress(
      0,
      file,
      i + 1,
      files.length,
      `Preparing ${file.name}`,
    );
    try {
      await uploadFileWithProgress(file, i + 1, files.length);
      completed++;
    } catch (err) {
      failed++;
      showToast(err.message, "error");
    }
  }

  invalidateSnapshotScope(
    "files",
    `${state.activeBot?.id || ""}:${state.activeChat?.chat_id || ""}`,
  );
  await reloadFiles({ force: true });
  clearUploadSelection();
  uploadProgressPopup.classList.add("hidden");

  if (failed) {
    showToast(`${completed} uploaded, ${failed} failed.`, "error");
  } else {
    showToast(`All ${completed} files uploaded successfully.`, "success");
  }
}

// Render Left Sidebar Connected Bots list
function renderBots() {
  botList.innerHTML = "";
  if (!state.bots.length) {
    botList.innerHTML =
      '<span class="sidebar-section-header" style="text-transform:none; padding-left:12px;">No bots. Click add.</span>';
    return;
  }

  state.bots.forEach((bot) => {
    const active = state.activeBot?.id === bot.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `workspace-nav-item ${active ? "active" : ""}`;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/><path d="M12 6v6l4 2"/></svg>
      <span>${escapeHtml(bot.name || bot.username)}</span>
    `;
    btn.addEventListener("click", () => selectBot(bot));
    botList.appendChild(btn);
  });

  applySidebarTooltips();
}

// Render Sidebar Chats under Workspaces category
function renderChats() {
  chatList.innerHTML = "";
  if (!state.activeBot) return;

  if (!state.chats.length) {
    chatList.innerHTML =
      '<span class="sidebar-section-header" style="text-transform:none; padding-left:12px;">No workspaces synced.</span>';
    return;
  }

  state.chats.forEach((chat) => {
    const isSelected = state.activeChat?.chat_id === chat.chat_id;
    const item = document.createElement("button");
    item.type = "button";
    item.className = `workspace-nav-item ${isSelected && state.activeSection === "workspaces" ? "active" : ""}`;
    item.setAttribute("data-chat-id", chat.chat_id);

    // Choose professional icon based on workspace name
    const title = (chat.title || chat.chat_id).toLowerCase();
    let svgIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>`;
    if (title.includes("work") || title.includes("drive")) {
      svgIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`;
    } else if (
      title.includes("college") ||
      title.includes("class") ||
      title.includes("study")
    ) {
      svgIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 2.5 3 6 3s6-1 6-3v-5"/></svg>`;
    } else if (title.includes("family") || title.includes("home")) {
      svgIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
    }

    item.innerHTML = `
      ${svgIcon}
      <span>${escapeHtml(chat.title || chat.chat_id)}</span>
    `;

    item.addEventListener("click", () => {
      selectChat(chat);
    });

    chatList.appendChild(item);
  });

  applySidebarTooltips();
}

async function selectBot(bot) {
  return withLoading("Opening bot workspace...", async () => {
    state.activeBot = bot;
    state.activeChat = null;
    state.chats = [];
    state.files = [];
    state.currentPage = 1;

    syncChatsBtn.disabled = false;
    reloadFilesBtn.disabled = true;
    uploadBtn.disabled = true;

    renderBots();
    renderChats();
    renderFiles();

    await loadChats();
    const selected = state.chats.find((chat) => chat.selected);
    if (selected) {
      state.activeChat = selected;
      uploadBtn.disabled = false;
      reloadFilesBtn.disabled = false;
      await reloadFiles();
      setViewSection("workspaces");
    }
  });
}

async function selectChat(chat) {
  if (!state.activeBot) return;
  return withLoading("Selecting chat...", async () => {
    await api(
      `/api/bots/${state.activeBot.id}/chats/${encodeURIComponent(chat.chat_id)}/select`,
      {
        method: "POST",
      },
    );
    state.activeChat = chat;
    state.chats = state.chats.map((item) => ({
      ...item,
      selected: item.chat_id === chat.chat_id,
    }));
    state.currentPage = 1;

    uploadBtn.disabled = false;
    reloadFilesBtn.disabled = false;

    await reloadFiles();
    setViewSection("workspaces");
  });
}

async function reloadFiles({ force = false } = {}) {
  if (!state.activeBot || !state.activeChat) return;
  return withLoading("Loading files...", async () => {
    const chatID = encodeURIComponent(state.activeChat.chat_id);
    const data = await fetchWithSnapshotCache({
      scope: "files",
      suffix: `${state.activeBot.id}:${state.activeChat.chat_id}`,
      ttlMs: CACHE_TTL_MS.files,
      force,
      loader: async () => {
        const payload = await api(
          `/api/bots/${state.activeBot.id}/chats/${chatID}/files`,
        );
        return unwrap(payload) || [];
      },
    });
    state.files = normalizeCollection(data);
    renderFiles();
  });
}

async function loadBots({ force = false } = {}) {
  return withLoading("Loading connected bots...", async () => {
    const data = await fetchWithSnapshotCache({
      scope: "bots",
      ttlMs: CACHE_TTL_MS.bots,
      force,
      loader: async () => {
        const payload = await api("/api/bots");
        return unwrap(payload) || [];
      },
    });
    state.bots = normalizeCollection(data);
    renderBots();

    if (state.bots.length) {
      const preferred =
        state.bots.find((bot) => bot.active_chat_id) || state.bots[0];
      await selectBot(preferred);
    } else {
      state.activeBot = null;
      state.activeChat = null;
      state.chats = [];
      state.files = [];
      renderChats();
      renderFiles();
      workspaceTitle.innerHTML =
        "Select a bot and chat <span class='subtitle'>Connect your first bot to start storing files.</span>";
    }
  });
}

async function loadChats({ force = false } = {}) {
  if (!state.activeBot) return;
  return withLoading("Loading chats...", async () => {
    const data = await fetchWithSnapshotCache({
      scope: "chats",
      suffix: String(state.activeBot.id),
      ttlMs: CACHE_TTL_MS.chats,
      force,
      loader: async () => {
        const payload = await api(`/api/bots/${state.activeBot.id}/chats`);
        return unwrap(payload) || [];
      },
    });
    state.chats = normalizeCollection(data);
    renderChats();
  });
}

function applyTheme(isDark) {
  const theme = isDark ? "dark" : "light";
  state.theme = theme;
  localStorage.setItem("telerealm.theme", theme);
  document.body.classList.toggle("dark-mode", isDark);
}

function applyUser() {
  if (!state.user) return;
  const nameVal = state.user.name || "User";
  const emailVal = state.user.email || "user@example.com";

  userName.textContent = nameVal;
  userEmail.textContent = emailVal;

  const initial = nameVal.trim().charAt(0).toUpperCase();
  avatar.textContent = initial;
  avatarBadge.textContent = initial;
  userBadgeName.textContent = nameVal;

  document.getElementById("settingsUserName").value = nameVal;

  if (state.user.theme) {
    applyTheme(state.user.theme === "dark");
  }
}

function clearSession() {
  const previousToken = state.token;
  state.token = "";
  state.user = null;
  state.isPublicShareMode = false;
  state.publicShareToken = "";
  state.publicShare = null;
  state.bots = [];
  state.chats = [];
  state.files = [];
  state.activeBot = null;
  state.activeChat = null;
  state.notifications = [];
  state.shareSelection = [];
  state.generatedShareUrl = "";
  localStorage.removeItem(SESSION_STORAGE_KEY);
  clearSnapshotCacheForToken(previousToken);
}

// Unified Event Bindings
function bindEvents() {
  // Authentication tab switches
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const mode = button.dataset.authTab;
      document
        .querySelectorAll("[data-auth-tab]")
        .forEach((btn) => btn.classList.toggle("active", btn === button));
      loginForm.classList.toggle("hidden", mode !== "login");
      registerForm.classList.toggle("hidden", mode !== "register");
    });
  });

  // Login Submit handler
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    try {
      await withLoading("Signing in...", async () => {
        const res = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(formData.entries())),
        });
        const payload = unwrap(res);
        state.token = payload.token;
        state.user = payload.user;
        localStorage.setItem(SESSION_STORAGE_KEY, state.token);
        applyUser();
        appScreen.classList.remove("hidden");
        authScreen.classList.add("hidden");
        await loadBots();
      });
      showToast("Login successful", "success");
    } catch (err) {
      showAuthMessage(err.message, true);
    }
  });

  // Register Submit handler
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    try {
      await withLoading("Creating account...", async () => {
        const res = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(formData.entries())),
        });
        const payload = unwrap(res);
        state.token = payload.token;
        state.user = payload.user;
        localStorage.setItem(SESSION_STORAGE_KEY, state.token);
        applyUser();
        appScreen.classList.remove("hidden");
        authScreen.classList.add("hidden");
        await loadBots();
      });
      showToast("Account created successfully", "success");
    } catch (err) {
      showAuthMessage(err.message, true);
    }
  });

  // Sidebar controls
  sidebarToggle.addEventListener("click", () =>
    setSidebarCollapsed(!state.sidebarCollapsed),
  );
  createBotToggle.addEventListener("click", () => openModal(botModal));

  // Theme toggle
  const themeToggle = document.getElementById("themeToggle");
  // Initialize theme from storage
  const storedTheme = localStorage.getItem("telerealm.theme") || "light";
  applyTheme(storedTheme === "dark");
  themeToggle.addEventListener("click", async () => {
    const isDark = document.body.classList.contains("dark-mode");
    const nextDark = !isDark;
    const nextTheme = nextDark ? "dark" : "light";

    applyTheme(nextDark);

    if (state.token) {
      try {
        await api("/api/users/theme", {
          method: "PUT",
          body: JSON.stringify({ theme: nextTheme }),
        });
        state.sidebarCollapsed = false;
        setSidebarCollapsed(false);
      } catch (err) {
        console.error("Failed to update theme on backend:", err);
        showToast("Failed to sync theme with server", "error");
      }
    }
  });

  // Navigation View switching

  createBotToggle.addEventListener("click", () => openModal(botModal));

  // Navigation View switching
  document
    .getElementById("navHome")
    .addEventListener("click", () => setViewSection("home"));
  document
    .getElementById("navWorkspaces")
    .addEventListener("click", () => setViewSection("workspaces"));
  document.getElementById("navSearch").addEventListener("click", () => {
    setViewSection("home");
    fileSearch.focus();
  });
  document.getElementById("navNotifications").addEventListener("click", () => {
    openNotificationsModal();
  });

  // Categories buttons triggers
  document
    .getElementById("catPhotos")
    .addEventListener("click", () => setViewSection("category", "photos"));
  document
    .getElementById("catVideos")
    .addEventListener("click", () => setViewSection("category", "videos"));
  document
    .getElementById("catDocuments")
    .addEventListener("click", () => setViewSection("category", "documents"));
  document
    .getElementById("catAudio")
    .addEventListener("click", () => setViewSection("category", "audio"));
  document
    .getElementById("catShared")
    .addEventListener("click", () => setViewSection("category", "shared"));
  document
    .getElementById("catTrash")
    .addEventListener("click", () => setViewSection("trash"));

  // Settings & Help Support Modal click triggers
  document
    .getElementById("btnSettings")
    .addEventListener("click", () => openModal(settingsModal));
  document
    .getElementById("userBadge")
    .addEventListener("click", () => openModal(settingsModal));
  document
    .getElementById("btnHelp")
    .addEventListener("click", () => openModal(helpModal));

  // Breadcrumbs folder navigation Back link
  backBtn.addEventListener("click", () => {
    state.activeFolder = null;
    renderFiles();
  });

  // Topbar Upload File Modal
  uploadBtn.addEventListener("click", () => {
    clearUploadSelection();
    // Auto-fill folder context
    const fInput = document.getElementById("folderNameInput");
    if (fInput) {
      fInput.value = state.activeFolder || "";
    }
    openModal(fileModal);
  });

  if (pickFilesBtn)
    pickFilesBtn.addEventListener("click", () => fileInput?.click());
  if (fileInput) {
    fileInput.addEventListener("change", (e) =>
      syncPendingUploadFiles(e.target.files),
    );
  }

  // Uploader Drag and drop
  if (fileDropzone) {
    fileDropzone.addEventListener("click", (e) => {
      if (e.target !== pickFilesBtn) fileInput?.click();
    });

    fileDropzone.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragDepth++;
      fileDropzone.classList.add("is-dragover");
    });
    fileDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      fileDropzone.classList.add("is-dragover");
    });
    fileDropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) fileDropzone.classList.remove("is-dragover");
    });
    fileDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dragDepth = 0;
      fileDropzone.classList.remove("is-dragover");
      syncPendingUploadFiles(e.dataTransfer?.files || []);
    });
  }

  // Load Chats, Reload Files triggers
  syncChatsBtn.addEventListener("click", async () => {
    if (!state.activeBot) return;
    try {
      await withLoading("Syncing chats...", async () => {
        await api(`/api/bots/${state.activeBot.id}/sync`, { method: "POST" });
        invalidateSnapshotScope("chats", String(state.activeBot.id));
        invalidateSnapshotScope("files", `${state.activeBot.id}:`);
        await loadChats({ force: true });
      });
      showToast("Workspace synced successfully", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  reloadFilesBtn.addEventListener("click", async () => {
    try {
      await reloadFiles({ force: true });
      showToast("Storage refreshed", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  logoutBtn.addEventListener("click", () => {
    clearSession();
    appScreen.classList.add("hidden");
    authScreen.classList.remove("hidden");
    showToast("Logged out successfully", "success");
  });

  // Search filter
  fileSearch.addEventListener("input", (e) => {
    state.search = e.target.value || "";
    state.currentPage = 1;
    renderFiles();
  });

  // Dates Range & Folder filters inputs
  dateFromFilter?.addEventListener("change", () => {
    state.currentPage = 1;
    renderFiles();
  });
  dateToFilter?.addEventListener("change", () => {
    state.currentPage = 1;
    renderFiles();
  });
  folderFilterInput?.addEventListener("input", (e) => {
    state.folderFilter = e.target.value || "";
    state.currentPage = 1;
    renderFiles();
  });

  sizeSlider?.addEventListener("input", (e) => {
    state.thumbnailScale = clamp(Number(e.target.value) || 1, 0.75, 1.6);
    localStorage.setItem(THUMBNAIL_SCALE_KEY, String(state.thumbnailScale));
    applyViewScale();
  });

  pageSizeSelector?.addEventListener("change", (e) => {
    state.pageSize = sanitizePageSize(e.target.value);
    localStorage.setItem("telerealm.pageSize", String(state.pageSize));
    state.currentPage = 1;
    renderFiles();
  });

  pageNumbersContainer?.addEventListener("click", (e) => {
    const button = e.target.closest("[data-page]");
    if (!button) return;
    const nextPage = Number(button.dataset.page);
    if (!Number.isFinite(nextPage)) return;
    if (nextPage === state.currentPage) return;
    state.currentPage = nextPage;
    renderFiles();
  });

  // Grid/List Modes switches
  gridViewBtn.addEventListener("click", () => {
    state.viewMode = "grid";
    gridViewBtn.classList.add("active");
    listViewBtn.classList.remove("active");
    renderFiles();
  });
  listViewBtn.addEventListener("click", () => {
    state.viewMode = "list";
    listViewBtn.classList.add("active");
    gridViewBtn.classList.remove("active");
    renderFiles();
  });

  // Selection controls
  selectVisibleBtn.addEventListener("click", () => {
    const visible = getPagedFiles(getFilteredFiles()).pageFiles;
    if (visible.length === 0) return;
    visible.forEach((f) => state.selectedFileIDs.add(f.record_id));
    renderSelectionSummary();
    renderFiles();
  });

  shareSelectedBtn?.addEventListener("click", () => {
    if (state.activeSection === "sharing" || state.isPublicShareMode) return;
    openShareModal();
  });

  shareSelectedBtn?.addEventListener("dragover", (event) => {
    event.preventDefault();
    shareSelectedBtn.classList.add("is-dragover");
  });

  shareSelectedBtn?.addEventListener("dragleave", () => {
    shareSelectedBtn.classList.remove("is-dragover");
  });

  shareSelectedBtn?.addEventListener("drop", (event) => {
    event.preventDefault();
    shareSelectedBtn.classList.remove("is-dragover");
    const droppedID =
      event.dataTransfer?.getData("application/x-telerealm-file-id") ||
      event.dataTransfer?.getData("text/plain");
    if (droppedID) {
      state.selectedFileIDs.add(droppedID);
      renderSelectionSummary();
      renderFiles();
    }
    openShareModal();
  });

  clearSelectionBtn?.addEventListener("click", () => clearSelection());

  // Bulk Operations
  bulkDownloadBtn.addEventListener("click", () => {
    const selected = state.files.filter((f) =>
      state.selectedFileIDs.has(f.record_id),
    );
    selected.forEach((f, idx) => {
      window.setTimeout(() => {
        if (f.secure_url)
          window.open(f.secure_url, "_blank", "noopener,noreferrer");
      }, idx * 150);
    });
    showToast("Opening selected shareable URLs", "success");
  });

  shareForm?.addEventListener("submit", submitShareLink);
  copyShareLinkBtn?.addEventListener("click", copyGeneratedShareLink);

  bulkFolderBtn.addEventListener("click", async () => {
    const selected = state.files.filter((f) =>
      state.selectedFileIDs.has(f.record_id),
    );
    const nextF = prompt(
      "Enter destination folder tag name:",
      state.activeFolder || "",
    );
    if (nextF === null) return;
    const tag = nextF.trim();
    try {
      await withLoading("Updating folder tags...", async () => {
        for (const file of selected) {
          await api(`/api/files/${file.record_id}`, {
            method: "PATCH",
            body: JSON.stringify({ folder_name: tag }),
          });
        }
        invalidateSnapshotScope(
          "files",
          `${state.activeBot?.id || ""}:${state.activeChat?.chat_id || ""}`,
        );
        await reloadFiles({ force: true });
        clearSelection();
      });
      showToast("Files updated successfully", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  bulkDeleteBtn.addEventListener("click", () => {
    const count = state.selectedFileIDs.size;
    if (state.activeSection === "trash") {
      if (
        !confirm(
          `Are you sure you want to permanently delete these ${count} selected file(s)?`,
        )
      )
        return;
      withLoading("Deleting files permanently...", async () => {
        try {
          for (const id of state.selectedFileIDs) {
            await api(`/api/files/${id}`, { method: "DELETE" });
            state.trashedFileIDs.delete(id);
          }
          localStorage.setItem(
            TRASH_STORAGE_KEY,
            JSON.stringify(Array.from(state.trashedFileIDs)),
          );
          clearSelection();
          invalidateSnapshotScope(
            "files",
            `${state.activeBot?.id || ""}:${state.activeChat?.chat_id || ""}`,
          );
          await reloadFiles({ force: true });
          showToast("Files deleted permanently", "success");
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    } else {
      if (!confirm(`Move ${count} selected file(s) to Trash?`)) return;
      state.selectedFileIDs.forEach((id) => state.trashedFileIDs.add(id));
      saveTrash();
      clearSelection();
      showToast("Files moved to Trash", "success");
    }
  });

  // Pagination clicks
  prevPageBtn.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      renderFiles();
    }
  });
  nextPageBtn.addEventListener("click", () => {
    const totalPages = Math.max(
      1,
      Math.ceil(getFilteredFiles().length / state.pageSize),
    );
    if (state.currentPage < totalPages) {
      state.currentPage++;
      renderFiles();
    }
  });

  let resizeTimer;
  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        renderFiles();
      }, 120);
    },
    { passive: true },
  );

  // Modal closers
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      closeModal(botModal);
      closeModal(fileModal);
      closeModal(settingsModal);
      closeModal(helpModal);
      closeModal(previewModal);
      closeModal(shareModal);
      closeModal(notificationsModal);
      clearUploadSelection();
    });
  });

  // Form submits
  document.getElementById("botForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await withLoading("Saving bot token...", async () => {
        await api("/api/bots", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(formData.entries())),
        });
        invalidateSnapshotScope("bots");
        invalidateSnapshotScope("chats");
        invalidateSnapshotScope("files");
        closeModal(botModal);
        e.target.reset();
        await loadBots({ force: true });
      });
      showToast("Bot connected successfully", "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  document.getElementById("fileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await uploadSelectedFiles();
      e.target.reset();
    } catch (err) {
      showToast(err.message, "error");
    }
  });

  // Settings Save profile profile form
  document
    .getElementById("btnSaveSettings")
    .addEventListener("click", async () => {
      const inputVal = document.getElementById("settingsUserName").value.trim();
      if (!inputVal) return;
      try {
        // Mock/save user name local display
        state.user.name = inputVal;
        applyUser();
        closeModal(settingsModal);
        showToast("Profile settings updated locally", "success");
      } catch (err) {
        showToast(err.message, "error");
      }
    });

  // Image Preview gallery sliding keys
  previewPrevBtn.addEventListener("click", () => previewStep(-1));
  previewNextBtn.addEventListener("click", () => previewStep(1));
  document.addEventListener("keydown", (e) => {
    if (previewModal.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") previewStep(-1);
    else if (e.key === "ArrowRight") previewStep(1);
    else if (e.key === "Escape") closeModal(previewModal);
  });
}

// Main Bootstrap Loader
async function bootstrap() {
  if (!Number.isFinite(state.thumbnailScale)) {
    state.thumbnailScale = 1;
  }
  state.thumbnailScale = clamp(state.thumbnailScale, 0.75, 1.6);
  localStorage.setItem(THUMBNAIL_SCALE_KEY, String(state.thumbnailScale));
  state.pageSize = sanitizePageSize(state.pageSize);
  localStorage.setItem("telerealm.pageSize", String(state.pageSize));

  bindEvents();
  if (sizeSlider) sizeSlider.value = String(state.thumbnailScale);
  if (pageSizeSelector) pageSizeSelector.value = String(state.pageSize);
  applyViewScale();
  setSidebarCollapsed(state.sidebarCollapsed);
  setViewSection("home");

  const publicShareToken = getPublicShareTokenFromPath();
  if (publicShareToken) {
    try {
      await loadPublicShare(publicShareToken);
      await loadNotifications().catch(() => []);
      appScreen.classList.remove("hidden");
      authScreen.classList.add("hidden");
      if (shareSelectedBtn) shareSelectedBtn.disabled = true;
      if (bulkDownloadBtn) bulkDownloadBtn.disabled = true;
      if (bulkFolderBtn) bulkFolderBtn.disabled = true;
      if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
      if (uploadBtn) uploadBtn.disabled = true;
      if (syncChatsBtn) syncChatsBtn.disabled = true;
      return;
    } catch (err) {
      authScreen.classList.remove("hidden");
      appScreen.classList.add("hidden");
      showAuthMessage(err.message, true);
      return;
    }
  }

  if (!state.token) {
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    return;
  }

  try {
    const me = await api("/api/me");
    state.user = unwrap(me);
    applyUser();

    appScreen.classList.remove("hidden");
    authScreen.classList.add("hidden");

    await loadBots();
    await loadNotifications().catch(() => []);
  } catch (err) {
    clearSession();
    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    showAuthMessage(err.message, true);
  }
}

bootstrap();
