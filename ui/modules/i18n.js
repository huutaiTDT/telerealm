/** @format */

const LOCALE_STORAGE_KEY = "telerealm.locale";
const DEFAULT_LOCALE = "vi";

let translations = null;
let observer = null;
let pendingApply = false;

const fallbackTranslations = {
  defaultLocale: "vi",
  locales: {
    vi: "Tiếng Việt",
    en: "English",
  },
  text: {
    "#navHome span": { vi: "Trang chủ", en: "Home" },
    "#navWorkspaces span": { vi: "Không gian làm việc", en: "Workspaces" },
    "#navSearch span": { vi: "Tìm kiếm", en: "Search" },
    "#navNotifications span": { vi: "Thông báo", en: "Notifications" },
    "#sidebarWorkspacesLabel": { vi: "Không gian làm việc", en: "Workspaces" },
    "#sidebarWorkspacesSectionLabel": {
      vi: "Không gian làm việc",
      en: "Workspaces",
    },
    "#sidebarCategoriesLabel": { vi: "Danh mục", en: "Categories" },
    "#createBotToggle span": { vi: "Thêm bot token", en: "Add bot token" },
    "#btnSettings span": { vi: "Cài đặt", en: "Settings" },
    "#btnHelp span": { vi: "Trợ giúp & hỗ trợ", en: "Help & support" },
    "#themeToggle span": { vi: "Giao diện", en: "Theme" },
    "#uploadBtn": { vi: "Tải tệp lên", en: "Upload file" },
    "#backBtn": { vi: "Quay lại", en: "Back" },
    "#topSectionLabel": { vi: "Không gian làm việc", en: "Workspaces" },
    "#workspaceTitle": { vi: "Chọn bot và chat", en: "Select a bot and chat" },
    "#workspaceSub": {
      vi: "Chọn bot, đồng bộ chat, rồi chọn một chat để xem kho tệp.",
      en: "Pick a bot, sync chats, then choose one chat to view file storage.",
    },
    "#syncChatsBtn": { vi: "Tải chat", en: "Load chats" },
    "#reloadFilesBtn": { vi: "Tải lại tệp", en: "Reload files" },
    "#selectVisibleBtn": { vi: "Chọn trang hiện tại", en: "Select visible" },
    "#gridViewBtn": { vi: "Lưới", en: "Grid" },
    "#listViewBtn": { vi: "Danh sách", en: "List" },
    "#clearSelectionBtn": { vi: "Bỏ chọn", en: "Clear selection" },
    "#bulkDownloadBtn": { vi: "Tải xuống", en: "Download" },
    "#bulkFolderBtn": { vi: "Đổi thư mục", en: "Move folder" },
    "#bulkDeleteBtn": { vi: "Xoá", en: "Delete" },
    "#loadingText": {
      vi: "Đang xử lý yêu cầu...",
      en: "Processing request...",
    },
    "#uploadProgressLabel": { vi: "Đang tải tệp", en: "Uploading files" },
    "#uploadProgressDetail": {
      vi: "Đang chuẩn bị tệp...",
      en: "Preparing files...",
    },
    "#previewTitle": { vi: "Xem trước", en: "Preview" },
    "#previewOpenLink": { vi: "Mở bản gốc", en: "Open original" },
    "#btnSettings span": { vi: "Cài đặt", en: "Settings" },
    "#btnHelp span": { vi: "Trợ giúp & hỗ trợ", en: "Help & support" },
    "#themeToggle span": { vi: "Giao diện", en: "Theme" },
    "#settingsModal h2": { vi: "Cài đặt", en: "Settings" },
    "#settingsModal .settings-card:nth-of-type(1) h3": {
      vi: "Lưu trữ TeleRealm Drive",
      en: "TeleRealm Drive Storage",
    },
    "#settingsModal .settings-card:nth-of-type(1) p": {
      vi: "Tệp được lưu trực tiếp trên hạ tầng đám mây an toàn của Telegram theo giới hạn cập nhật của bot.",
      en: "Files are stored directly on Telegram's secured cloud architecture under your bot's updates limits.",
    },
    "#settingsModal .settings-card:nth-of-type(1) .pagination-summary": {
      vi: "Đang dùng 1.2 GB trong không gian lưu trữ không giới hạn",
      en: "Using 1.2 GB of Unlimited Storage",
    },
    "#settingsModal .settings-card:nth-of-type(2) h3": {
      vi: "Thông tin tài khoản",
      en: "Account Credentials",
    },
    "#settingsModal .settings-card:nth-of-type(2) label": {
      vi: "Tên hiển thị",
      en: "Display Name",
    },
    "#btnSaveSettings": { vi: "Lưu hồ sơ", en: "Save Profile" },
    "#helpModal h2": { vi: "Trợ giúp & hỗ trợ", en: "Help & support" },
    "#helpModal .settings-card:nth-of-type(1) h3": {
      vi: "Cách kết nối bot?",
      en: "How to connect bots?",
    },
    "#helpModal .settings-card:nth-of-type(1) p": {
      vi: "1. Mở ứng dụng Telegram và chat với @BotFather. 2. Gửi lệnh /newbot và đặt tên cho bot. 3. Sao chép Bot API Token và dán vào mục Thêm bot ở đây. 4. Thêm bot vào nhóm hoặc nhắn cho bot, sau đó bấm Tải chat.",
      en: "1. Open Telegram app and chat with @BotFather. 2. Send /newbot command and name your bot. 3. Copy the Bot API Token key and paste it via Add Bot here. 4. Add your bot to a group chat or message it, then click Load chats.",
    },
    "#helpModal .settings-card:nth-of-type(2) h3": {
      vi: "Cách duyệt thư mục?",
      en: "How to browse Folders?",
    },
    "#helpModal .settings-card:nth-of-type(2) p": {
      vi: "Khi tải tệp lên, chỉ cần đặt tên thẻ thư mục (ví dụ: Travel 2026). Hệ thống sẽ tự tạo thư mục cao cấp và sắp xếp lại cấu trúc bảng điều khiển của bạn.",
      en: "When uploading files, simply specify a folder tag name (e.g. Travel 2026). The system will automatically build premium folders and organize your dashboard hierarchy.",
    },
    "#loginForm .primary-btn": { vi: "Đăng nhập", en: "Sign in" },
    "#registerForm .primary-btn": { vi: "Tạo tài khoản", en: "Create account" },
    ".auth-tabs .tab[data-auth-tab='login']": { vi: "Đăng nhập", en: "Login" },
    ".auth-tabs .tab[data-auth-tab='register']": {
      vi: "Đăng ký",
      en: "Register",
    },
    ".auth-card .lede": {
      vi: "Đăng ký tài khoản, kết nối bot token, tải chat và quản lý tệp trong một không gian kiểu Drive.",
      en: "Register an account, connect a bot token, load chats, and manage file storage in a Drive-like workspace.",
    },
    "#languageToggleBtn": { vi: "VI | EN", en: "EN | VI" },
    "#botModal h2": { vi: "Kết nối Telegram bot", en: "Connect Telegram bot" },
    "#fileModal h2": { vi: "Tải tệp lên", en: "Upload file" },
    "#fileModal .file-dropzone strong": {
      vi: "Kéo tệp vào đây hoặc chọn nhiều tệp",
      en: "Drag files here or choose multiple files",
    },
    "#btnSaveSettings": { vi: "Lưu hồ sơ", en: "Save Profile" },
  },
  attributes: {
    "#sidebarToggle": {
      title: {
        vi: "Thu gọn hoặc mở rộng thanh bên",
        en: "Toggle sidebar",
      },
      "aria-label": {
        vi: "Thu gọn hoặc mở rộng thanh bên",
        en: "Toggle sidebar",
      },
    },
    "#fileSearch": {
      placeholder: { vi: "Tìm tệp...", en: "Search files..." },
      "aria-label": { vi: "Tìm tệp", en: "Search files" },
    },
    "#folderFilter": {
      placeholder: { vi: "Lọc thư mục...", en: "Filter folder..." },
    },
  },
};

function getLocale() {
  const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
  return saved === "en" ? "en" : DEFAULT_LOCALE;
}

function setLocale(locale) {
  const nextLocale = locale === "en" ? "en" : DEFAULT_LOCALE;
  localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
  applyLocale(nextLocale);
}

function toggleLocale() {
  setLocale(getLocale() === "vi" ? "en" : "vi");
}

function getBundle() {
  return translations || fallbackTranslations;
}

function getValueEntry(entry, locale) {
  if (!entry) return "";
  return entry[locale] || entry[DEFAULT_LOCALE] || entry.en || "";
}

function setElementText(element, label) {
  const textNode = Array.from(element.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE,
  );
  if (textNode) {
    textNode.nodeValue = label;
    return;
  }

  element.textContent = label;
}

function applyText(selector, value) {
  document.querySelectorAll(selector).forEach((element) => {
    setElementText(element, value);
  });
}

function applyAttribute(selector, attributeName, value) {
  document.querySelectorAll(selector).forEach((element) => {
    element.setAttribute(attributeName, value);
  });
}

function updateLanguageToggle(locale) {
  const button = document.getElementById("languageToggleBtn");
  if (!button) return;
  const label = locale === "vi" ? "VI | EN" : "EN | VI";
  button.textContent = label;
  button.title =
    locale === "vi" ? "Chuyển sang English" : "Chuyển sang Tiếng Việt";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", locale === "en" ? "true" : "false");
}

function applyLocale(locale = getLocale()) {
  const bundle = getBundle();
  const nextLocale = bundle.locales?.[locale] ? locale : DEFAULT_LOCALE;

  document.documentElement.lang = nextLocale;

  Object.entries(bundle.text || {}).forEach(([selector, values]) => {
    const value = getValueEntry(values, nextLocale);
    if (value) {
      applyText(selector, value);
    }
  });

  Object.entries(bundle.attributes || {}).forEach(([selector, attributes]) => {
    Object.entries(attributes).forEach(([attributeName, values]) => {
      const value = getValueEntry(values, nextLocale);
      if (value) {
        applyAttribute(selector, attributeName, value);
      }
    });
  });

  updateLanguageToggle(nextLocale);
}

async function loadTranslations() {
  if (translations) return translations;

  try {
    const response = await fetch("/ui/modules/i18n.json", {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to load translations");
    translations = await response.json();
  } catch (_error) {
    translations = fallbackTranslations;
  }

  return translations;
}

function scheduleApply() {
  if (pendingApply) return;
  pendingApply = true;
  window.requestAnimationFrame(() => {
    pendingApply = false;
    applyLocale();
  });
}

function startObserver() {
  if (observer || !document.body) return;

  observer = new MutationObserver(() => {
    scheduleApply();
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function bindControls() {
  const toggle = document.getElementById("languageToggleBtn");
  if (toggle && !toggle.dataset.i18nBound) {
    toggle.dataset.i18nBound = "1";
    toggle.addEventListener("click", () => {
      toggleLocale();
    });
  }
}

async function bootstrapI18n() {
  await loadTranslations();
  bindControls();
  applyLocale();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapI18n, { once: true });
} else {
  bootstrapI18n();
}

window.TeleRealmI18n = {
  getLocale,
  setLocale,
  toggleLocale,
  applyLocale,
};
