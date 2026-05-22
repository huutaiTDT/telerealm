/** @format */

const STORAGE_KEY = "telerealm.locale";
const DEFAULT_LOCALE = "vi";

let translations = null;
let pendingApply = false;
let observer = null;

function getLocale() {
  return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : DEFAULT_LOCALE;
}

function setLocale(locale) {
  const nextLocale = locale === "en" ? "en" : DEFAULT_LOCALE;
  localStorage.setItem(STORAGE_KEY, nextLocale);
  applyLocale(nextLocale);
}

function toggleLocale() {
  setLocale(getLocale() === "vi" ? "en" : "vi");
}

function getBundle() {
  return (
    translations || {
      defaultLocale: DEFAULT_LOCALE,
      locales: {},
      common: {},
      pages: {},
    }
  );
}

function getCurrentPageKey() {
  if (location.pathname === "/") return "/";
  return location.pathname.replace(/\/$/, "") || "/";
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

function applyMap(map, locale) {
  Object.entries(map?.text || {}).forEach(([selector, values]) => {
    const value = getValueEntry(values, locale);
    if (!value) return;
    document.querySelectorAll(selector).forEach((element) => {
      setElementText(element, value);
    });
  });

  Object.entries(map?.attributes || {}).forEach(([selector, attributes]) => {
    document.querySelectorAll(selector).forEach((element) => {
      Object.entries(attributes).forEach(([attributeName, values]) => {
        const value = getValueEntry(values, locale);
        if (value) {
          element.setAttribute(attributeName, value);
        }
      });
    });
  });
}

function updateLanguageToggle(locale) {
  const button = document.getElementById("staticLanguageToggleBtn");
  if (!button) return;
  button.textContent = locale === "vi" ? "VI | EN" : "EN | VI";
  button.title =
    locale === "vi" ? "Chuyển sang English" : "Chuyển sang Tiếng Việt";
  button.setAttribute("aria-label", button.title);
  button.setAttribute("aria-pressed", locale === "en" ? "true" : "false");
}

function applyLocale(locale = getLocale()) {
  const bundle = getBundle();
  const nextLocale = bundle.locales?.[locale] ? locale : DEFAULT_LOCALE;
  document.documentElement.lang = nextLocale;
  applyMap(bundle.common, nextLocale);
  applyMap(bundle.pages?.[getCurrentPageKey()], nextLocale);
  updateLanguageToggle(nextLocale);
}

async function loadTranslations() {
  if (translations) return translations;
  try {
    const response = await fetch("/static/i18n.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load static translations");
    translations = await response.json();
  } catch (_error) {
    translations = {
      defaultLocale: DEFAULT_LOCALE,
      locales: {},
      common: {},
      pages: {},
    };
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

function bindControls() {
  const button = document.getElementById("staticLanguageToggleBtn");
  if (button && !button.dataset.i18nBound) {
    button.dataset.i18nBound = "1";
    button.addEventListener("click", toggleLocale);
  }
}

function startObserver() {
  if (observer || !document.body) return;
  observer = new MutationObserver(() => scheduleApply());
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

async function bootstrap() {
  await loadTranslations();
  bindControls();
  applyLocale();
  startObserver();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
} else {
  bootstrap();
}

window.TeleRealmStaticI18n = {
  getLocale,
  setLocale,
  toggleLocale,
  applyLocale,
};
