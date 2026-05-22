/** @format */

export const STORAGE_KEY = "telerealm.sessionToken";
export const TRASH_STORAGE_KEY = "telerealm.trashedFileIDs";
export const THUMBNAIL_SCALE_KEY = "telerealm.thumbnailScale";
export const SNAPSHOT_CACHE_KEY = "telerealm.snapshotCache.v1";

export const CACHE_TTL_MS = {
  bots: 90_000,
  chats: 60_000,
  files: 45_000,
};

export const state = {
  token: localStorage.getItem(STORAGE_KEY) || "",
  user: null,
  bots: [],
  chats: [],
  files: [],
  activeBot: null,
  activeChat: null,

  activeSection: "home",
  activeCategory: "",
  activeFolder: null,

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

  previewFiles: [],
  previewIndex: 0,
};
