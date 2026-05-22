/** @format */

import {
  nextPageBtn,
  pageNumbersContainer,
  paginationSummary,
  prevPageBtn,
} from "./dom.js";
import { state } from "./state.js";

export function getPagedFiles(files) {
  const totalPages = Math.max(1, Math.ceil(files.length / state.pageSize));
  state.currentPage = Math.min(state.currentPage, totalPages);
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

  buildPageButtons(totalPages, currentPage).forEach((item) => {
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

export function renderPagination(totalPages, totalItems) {
  if (!totalItems) {
    if (paginationSummary) paginationSummary.textContent = "";
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    if (pageNumbersContainer) pageNumbersContainer.innerHTML = "";
    return;
  }

  if (paginationSummary) {
    paginationSummary.textContent = `Page ${state.currentPage} of ${totalPages} (${totalItems} items)`;
  }
  if (prevPageBtn) {
    prevPageBtn.textContent = "Prev";
    prevPageBtn.disabled = state.currentPage <= 1;
  }
  if (nextPageBtn) {
    nextPageBtn.textContent = "Next";
    nextPageBtn.disabled = state.currentPage >= totalPages;
  }

  renderPageNumbers(totalPages, state.currentPage);
}
