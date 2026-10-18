import {
  createExperienceReport,
  deleteExperienceReport,
  getExperienceReport,
  getExperienceReports,
  getExperienceSummary,
  getMyExperienceReports,
  updateExperienceReport,
} from "./experiencesAPI.js";
import { searchProviders } from "./providersAPI.js";

const elements = {
  viewMyReports: document.querySelector("#view-my-reports"),
  myReportsPanel: document.querySelector("#my-reports-panel"),
  closeMyReports: document.querySelector("#close-my-reports"),
  myReportsStatus: document.querySelector("#my-reports-status"),
  myReportsList: document.querySelector("#my-reports-list"),
  providerSearchForm: document.querySelector("#provider-search-form"),
  providerSearchInput: document.querySelector("#provider-search"),
  providerSearchStatus: document.querySelector("#provider-search-status"),
  providerResults: document.querySelector("#provider-results"),
  providerWorkspace: document.querySelector("#provider-workspace"),
  selectedProviderName: document.querySelector("#selected-provider-name"),
  selectedProviderDetails: document.querySelector("#selected-provider-details"),
  averageRating: document.querySelector("#average-rating"),
  reportCount: document.querySelector("#report-count"),
  filterForm: document.querySelector("#report-filter-form"),
  clearFilters: document.querySelector("#clear-filters"),
  reportsStatus: document.querySelector("#reports-status"),
  reportsList: document.querySelector("#reports-list"),
  pagination: document.querySelector("#pagination"),
  previousPage: document.querySelector("#previous-page"),
  nextPage: document.querySelector("#next-page"),
  pageStatus: document.querySelector("#page-status"),
  experienceForm: document.querySelector("#experience-form"),
  reportId: document.querySelector("#report-id"),
  providerId: document.querySelector("#provider-id"),
  therapyType: document.querySelector("#therapy-type"),
  visitFormat: document.querySelector("#visit-format"),
  rating: document.querySelector("#rating"),
  wouldRecommend: document.querySelector("#would-recommend"),
  experiencedAt: document.querySelector("#experienced-at"),
  experienceSummary: document.querySelector("#experience-summary"),
  summaryCount: document.querySelector("#summary-count"),
  formMessage: document.querySelector("#form-message"),
  formHeading: document.querySelector("#report-form-heading"),
  submitReport: document.querySelector("#submit-report"),
  cancelEdit: document.querySelector("#cancel-edit"),
};

const state = {
  selectedProvider: null,
  page: 1,
  pages: 0,
  itemsOnPage: 0,
};

function setStatus(element, message, type = "") {
  element.textContent = message;
  element.className = type ? `status ${type}` : "status";
}

function appendTextElement(parent, tagName, text, className = "") {
  const element = document.createElement(tagName);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  parent.append(element);
  return element;
}

function getLocalDateString() {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

function resetReportForm() {
  elements.experienceForm.reset();
  elements.reportId.value = "";
  elements.providerId.value = state.selectedProvider?._id || "";
  elements.experiencedAt.max = getLocalDateString();
  elements.formHeading.textContent = "Share your experience";
  elements.submitReport.textContent = "Submit report";
  elements.cancelEdit.hidden = true;
  elements.summaryCount.textContent = "0/300";
  setStatus(elements.formMessage, "");
}

function getFilters() {
  const data = new FormData(elements.filterForm);
  const recommendation = data.get("wouldRecommend");

  return {
    providerId: state.selectedProvider._id,
    therapyType: data.get("therapyType"),
    visitFormat: data.get("visitFormat"),
    rating: data.get("rating"),
    wouldRecommend: recommendation === "" ? "" : recommendation === "true",
    page: state.page,
  };
}

function renderProviderResults(providers) {
  elements.providerResults.replaceChildren();

  for (const provider of providers) {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "provider-result-button";

    appendTextElement(button, "strong", provider.name);
    appendTextElement(
      button,
      "span",
      `${provider.specialty} · ${provider.city}, ${provider.state}`
    );

    button.addEventListener("click", () => {
      selectProvider(provider);
    });

    item.append(button);
    elements.providerResults.append(item);
  }
}

function renderReports(reports) {
  elements.reportsList.replaceChildren();
  state.itemsOnPage = reports.length;

  if (reports.length === 0) {
    appendTextElement(elements.reportsList, "p", "No experience reports yet.");
    return;
  }

  for (const report of reports) {
    const article = document.createElement("article");
    article.className = "report-card";

    const ratingHeading = appendTextElement(
      article,
      "h3",
      `${"★".repeat(report.rating)}${"☆".repeat(5 - report.rating)}`
    );
    ratingHeading.setAttribute("aria-label", `${report.rating} out of 5 stars`);

    const meta = document.createElement("div");
    meta.className = "report-meta";

    if (report.isDemo) {
      appendTextElement(meta, "span", "Demo data", "demo-data-badge");
    }

    appendTextElement(meta, "span", report.therapyType);
    appendTextElement(meta, "span", report.visitFormat);
    appendTextElement(
      meta,
      "span",
      report.wouldRecommend ? "Would recommend" : "Would not recommend"
    );
    article.append(meta);

    if (report.experienceSummary) {
      appendTextElement(
        article,
        "p",
        report.experienceSummary,
        "report-summary"
      );
    }

    appendTextElement(
      article,
      "p",
      `Experience date: ${formatDate(report.experiencedAt)}`,
      "report-date"
    );

    if (report.isMine) {
      const actions = document.createElement("div");
      actions.className = "report-actions";

      const editButton = appendTextElement(
        actions,
        "button",
        "Edit",
        "secondary-button"
      );
      editButton.type = "button";
      editButton.addEventListener("click", () => {
        startEditing(report._id);
      });

      const deleteButton = appendTextElement(
        actions,
        "button",
        "Delete",
        "delete-button"
      );
      deleteButton.type = "button";
      deleteButton.addEventListener("click", () => {
        removeReport(report._id);
      });

      article.append(actions);
    }

    elements.reportsList.append(article);
  }
}

function closeMyReportsPanel() {
  elements.myReportsPanel.hidden = true;
  elements.viewMyReports.setAttribute("aria-expanded", "false");
  elements.viewMyReports.focus();
}

async function editMyReport(report) {
  if (!report.provider) {
    setStatus(
      elements.myReportsStatus,
      "The provider for this report is no longer available.",
      "error"
    );
    return;
  }

  closeMyReportsPanel();
  await selectProvider(report.provider);
  await startEditing(report._id);
}

async function deleteMyReport(id) {
  const confirmed = window.confirm(
    "Delete this experience report? This cannot be undone."
  );

  if (!confirmed) return;

  try {
    await deleteExperienceReport(id);

    if (elements.reportId.value === id) {
      resetReportForm();
    }

    await loadMyReports();

    if (state.selectedProvider) {
      await Promise.all([loadReports(), loadSummary()]);
    }

    setStatus(elements.myReportsStatus, "Report deleted.", "success");
  } catch (error) {
    setStatus(elements.myReportsStatus, error.message, "error");
  }
}

function renderMyReports(reports) {
  elements.myReportsList.replaceChildren();

  if (reports.length === 0) {
    appendTextElement(
      elements.myReportsList,
      "p",
      "You have not submitted any experience reports from this browser."
    );
    return;
  }

  for (const report of reports) {
    const article = document.createElement("article");
    article.className = "report-card";

    appendTextElement(
      article,
      "h3",
      report.provider?.name || "Provider unavailable",
      "my-report-provider"
    );

    const rating = appendTextElement(
      article,
      "p",
      `${"★".repeat(report.rating)}${"☆".repeat(5 - report.rating)}`
    );
    rating.setAttribute("aria-label", `${report.rating} out of 5 stars`);

    const meta = document.createElement("div");
    meta.className = "report-meta";
    appendTextElement(meta, "span", report.therapyType);
    appendTextElement(meta, "span", report.visitFormat);
    appendTextElement(
      meta,
      "span",
      report.wouldRecommend ? "Would recommend" : "Would not recommend"
    );
    article.append(meta);

    if (report.experienceSummary) {
      appendTextElement(
        article,
        "p",
        report.experienceSummary,
        "report-summary"
      );
    }

    appendTextElement(
      article,
      "p",
      `Experience date: ${formatDate(report.experiencedAt)}`,
      "report-date"
    );

    const actions = document.createElement("div");
    actions.className = "report-actions";

    const editButton = appendTextElement(
      actions,
      "button",
      "Edit",
      "secondary-button"
    );
    editButton.type = "button";
    editButton.disabled = !report.provider;
    editButton.addEventListener("click", () => {
      editMyReport(report);
    });

    const deleteButton = appendTextElement(
      actions,
      "button",
      "Delete",
      "delete-button"
    );
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => {
      deleteMyReport(report._id);
    });

    article.append(actions);
    elements.myReportsList.append(article);
  }
}

async function loadMyReports() {
  elements.myReportsPanel.hidden = false;
  elements.viewMyReports.setAttribute("aria-expanded", "true");
  elements.myReportsList.replaceChildren();
  setStatus(elements.myReportsStatus, "Loading your reports...");

  try {
    const result = await getMyExperienceReports();
    renderMyReports(result.items);

    const message =
      result.total > result.items.length
        ? `Showing ${result.items.length} of your ${result.total} reports.`
        : `${result.total} report${result.total === 1 ? "" : "s"} found.`;

    setStatus(elements.myReportsStatus, message);

    elements.myReportsPanel.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    setStatus(elements.myReportsStatus, error.message, "error");
  }
}

function updatePagination() {
  const hasMultiplePages = state.pages > 1;

  elements.pagination.hidden = !hasMultiplePages;

  if (!hasMultiplePages) {
    elements.pageStatus.textContent = "";
    return;
  }

  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= state.pages;
  elements.pageStatus.textContent = `Page ${state.page} of ${state.pages}`;
}

async function loadSummary() {
  try {
    const summary = await getExperienceSummary(state.selectedProvider._id);

    elements.averageRating.textContent =
      summary.reportCount > 0 ? `${summary.averageRating}/5` : "No rating";
    elements.reportCount.textContent = summary.reportCount;
  } catch {
    elements.averageRating.textContent = "Unavailable";
    elements.reportCount.textContent = "Unavailable";
  }
}

async function loadReports() {
  setStatus(elements.reportsStatus, "Loading reports...");

  try {
    const result = await getExperienceReports(getFilters());
    state.pages = result.pages;
    renderReports(result.items);
    updatePagination();

    setStatus(
      elements.reportsStatus,
      `${result.total} report${result.total === 1 ? "" : "s"} found.`
    );
  } catch (error) {
    elements.reportsList.replaceChildren();
    state.pages = 0;
    updatePagination();
    setStatus(elements.reportsStatus, error.message, "error");
  }
}

async function selectProvider(provider) {
  state.selectedProvider = provider;
  state.page = 1;

  elements.providerWorkspace.hidden = false;
  elements.selectedProviderName.textContent = provider.name;
  elements.selectedProviderDetails.textContent = `${provider.specialty} · ${provider.city}, ${provider.state} ${provider.zip}`;
  elements.providerId.value = provider._id;

  elements.filterForm.reset();
  resetReportForm();

  await Promise.all([loadReports(), loadSummary()]);
  elements.providerWorkspace.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

async function startEditing(id) {
  setStatus(elements.formMessage, "Loading report...");

  try {
    const report = await getExperienceReport(id);

    if (!report.isMine) {
      throw new Error("You can only edit your own reports");
    }

    elements.reportId.value = report._id;
    elements.providerId.value = report.providerId;
    elements.therapyType.value = report.therapyType;
    elements.visitFormat.value = report.visitFormat;
    elements.rating.value = report.rating;
    elements.wouldRecommend.value = String(report.wouldRecommend);
    elements.experiencedAt.value = report.experiencedAt.slice(0, 10);
    elements.experienceSummary.value = report.experienceSummary;
    elements.summaryCount.textContent = `${report.experienceSummary.length}/300`;

    elements.formHeading.textContent = "Edit your experience";
    elements.submitReport.textContent = "Save changes";
    elements.cancelEdit.hidden = false;
    setStatus(elements.formMessage, "");

    elements.experienceForm.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    setStatus(elements.formMessage, error.message, "error");
  }
}

async function removeReport(id) {
  const confirmed = window.confirm(
    "Delete this experience report? This cannot be undone."
  );

  if (!confirmed) return;

  try {
    await deleteExperienceReport(id);

    if (elements.reportId.value === id) {
      resetReportForm();
    }

    if (state.itemsOnPage === 1 && state.page > 1) {
      state.page -= 1;
    }

    await Promise.all([loadReports(), loadSummary()]);
    setStatus(elements.reportsStatus, "Report deleted.", "success");
  } catch (error) {
    setStatus(elements.reportsStatus, error.message, "error");
  }
}

elements.providerSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const query = elements.providerSearchInput.value.trim();
  if (!query) return;

  setStatus(elements.providerSearchStatus, "Searching providers...");
  elements.providerResults.replaceChildren();

  try {
    const result = await searchProviders({ q: query, limit: 10 });
    renderProviderResults(result.items);

    let message;

    if (result.total === 0) {
      message = "No providers found. Try another name.";
    } else if (result.total > result.items.length) {
      message = "Top matches. Continue typing to narrow the results.";
    } else {
      message = `${result.total} matching provider${
        result.total === 1 ? "" : "s"
      } found.`;
    }

    setStatus(elements.providerSearchStatus, message);
  } catch (error) {
    setStatus(elements.providerSearchStatus, error.message, "error");
  }
});

elements.filterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  state.page = 1;
  await loadReports();
});

elements.clearFilters.addEventListener("click", async () => {
  elements.filterForm.reset();
  state.page = 1;
  await loadReports();
});

elements.previousPage.addEventListener("click", async () => {
  if (state.page <= 1) return;
  state.page -= 1;
  await loadReports();
});

elements.nextPage.addEventListener("click", async () => {
  if (state.page >= state.pages) return;
  state.page += 1;
  await loadReports();
});

elements.experienceSummary.addEventListener("input", () => {
  elements.summaryCount.textContent = `${elements.experienceSummary.value.length}/300`;
});

elements.cancelEdit.addEventListener("click", () => {
  resetReportForm();
});

elements.viewMyReports.addEventListener("click", async () => {
  await loadMyReports();
});

elements.closeMyReports.addEventListener("click", () => {
  closeMyReportsPanel();
});

elements.experienceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!state.selectedProvider) {
    setStatus(elements.formMessage, "Select a provider first.", "error");
    return;
  }

  const report = {
    providerId: state.selectedProvider._id,
    therapyType: elements.therapyType.value,
    visitFormat: elements.visitFormat.value,
    rating: Number(elements.rating.value),
    wouldRecommend: elements.wouldRecommend.value === "true",
    experienceSummary: elements.experienceSummary.value.trim(),
    experiencedAt: elements.experiencedAt.value,
  };

  const editingId = elements.reportId.value;
  elements.submitReport.disabled = true;
  setStatus(
    elements.formMessage,
    editingId ? "Saving changes..." : "Submitting report..."
  );

  try {
    if (editingId) {
      await updateExperienceReport(editingId, report);
    } else {
      await createExperienceReport(report);
    }

    resetReportForm();
    state.page = 1;
    await Promise.all([loadReports(), loadSummary()]);

    setStatus(
      elements.formMessage,
      editingId ? "Report updated." : "Report submitted.",
      "success"
    );
  } catch (error) {
    setStatus(elements.formMessage, error.message, "error");
  } finally {
    elements.submitReport.disabled = false;
  }
});

elements.experiencedAt.max = getLocalDateString();
