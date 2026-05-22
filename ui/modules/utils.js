/** @format */

import { fileGrid, sizeSlider } from "./dom.js";
import { state } from "./state.js";

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getPageSizeOptions() {
  return [4, 8, 16, 32, 64];
}

export function sanitizePageSize(value) {
  const numeric = Number(value);
  return getPageSizeOptions().includes(numeric) ? numeric : 8;
}

export function prettyBytes(bytes) {
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

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function isPreviewableImage(file) {
  const extension = String(file.format || "")
    .trim()
    .toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(
    extension,
  );
}

export function applyViewScale() {
  if (!fileGrid) return;
  const scale = clamp(Number(state.thumbnailScale) || 1, 0.75, 1.6);
  fileGrid.style.setProperty("--grid-thumb-scale", String(scale));
  fileGrid.style.setProperty("--list-row-scale", String(scale));
  if (sizeSlider && Number(sizeSlider.value) !== scale) {
    sizeSlider.value = String(scale);
  }
}
