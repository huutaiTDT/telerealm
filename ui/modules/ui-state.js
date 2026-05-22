/** @format */

export function showToast(toastEl, message, tone = "") {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = "toast show";
  if (tone) toastEl.classList.add(tone);

  window.clearTimeout(window.toastTimeout);
  window.toastTimeout = window.setTimeout(() => {
    toastEl.className = "toast";
  }, 3000);
}
