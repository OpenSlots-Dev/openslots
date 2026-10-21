import { getCities } from "./providersAPI.js";
import {
  getOptions,
  searchAvailability,
  getProviderAvailability,
  getSummary,
  createReport,
  updateReport,
  deleteReport,
} from "./availabilityAPI.js";

const state = {
  filters: {},
  page: 1,
  providerId: null,
  history: [],
  editingId: null,
  statusLabels: {},
};

const $ = (selector) => document.querySelector(selector);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children.filter((child) => child !== null && child !== ""));
  return node;
}

function setStatus(selector, message, type = "") {
  const node = $(selector);
  node.textContent = message;
  node.className = type ? `status ${type}` : "status";
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function describeStatus(report) {
  const label = state.statusLabels[report.acceptingStatus];
  return report.acceptingStatus === "waitlist"
    ? `${label} · ${report.waitlistWeeks} weeks`
    : label;
}

function statusBadge(report) {
  return el("span", {
    className: `availability-badge ${report.acceptingStatus}`,
    textContent: describeStatus(report),
  });
}

function demoBadge(report) {
  return report.isDemo
    ? el("span", { className: "demo-data-badge", textContent: "Demo data" })
    : null;
}

function reportMeta(report, extras = []) {
  const chips = [
    ...extras,
    ...(report.insurances.length > 0
      ? report.insurances.map((name) => ({ text: name }))
      : [{ text: "No insurances reported" }]),
    { text: report.telehealth ? "Telehealth offered" : "No telehealth" },
  ];
  return el(
    "ul",
    { className: "report-meta" },
    ...chips.map((chip) =>
      el("li", { textContent: chip.text, className: chip.className ?? "" })
    )
  );
}

function fillSelect(select, options) {
  for (const option of options) {
    select.append(
      el("option", { value: option.value, textContent: option.label })
    );
  }
}

function buildReportForm(options) {
  const statusGroup = $("#status-options");
  for (const status of options.statuses) {
    statusGroup.append(
      el(
        "label",
        { className: "choice" },
        el("input", {
          type: "radio",
          name: "acceptingStatus",
          value: status.value,
          required: true,
        }),
        status.label
      )
    );
  }

  const insuranceGroup = $("#insurance-options");
  for (const name of options.insurances) {
    insuranceGroup.append(
      el(
        "label",
        { className: "choice" },
        el("input", { type: "checkbox", name: "insurances", value: name }),
        name
      )
    );
  }

  $("#notes").maxLength = options.notesMax;
  $("#notes-max").textContent = options.notesMax;
}

async function init() {
  try {
    const [options, cities] = await Promise.all([getOptions(), getCities()]);

    for (const status of options.statuses) {
      state.statusLabels[status.value] = status.label;
    }

    fillSelect(
      $("#city"),
      cities.map((city) => ({ value: city, label: city }))
    );
    fillSelect($("#status"), options.statuses);
    fillSelect(
      $("#insurance"),
      options.insurances.map((name) => ({ value: name, label: name }))
    );
    buildReportForm(options);

    await Promise.all([loadResults(), loadSummary()]);
  } catch (error) {
    setStatus("#results-status", error.message, "error");
  }
}

function providerCard(provider) {
  const current = provider.current;
  const button = el("button", {
    type: "button",
    textContent: "View and report",
  });
  button.dataset.providerId = provider._id;

  return el(
    "li",
    { className: "report-card" },
    el("h3", { textContent: provider.name }),
    el("p", {
      className: "provider-meta",
      textContent: `${provider.credential} · ${provider.specialty} · ${provider.city}`,
    }),
    current
      ? el(
          "div",
          { className: "card-heading" },
          statusBadge(current),
          demoBadge(current)
        )
      : el("p", {
          className: "no-info",
          textContent: "No recent availability info.",
        }),
    current ? reportMeta(current) : null,
    el("div", { className: "card-actions" }, button)
  );
}

async function loadResults() {
  setStatus("#results-status", "Loading providers…");
  try {
    const data = await searchAvailability({
      ...state.filters,
      page: state.page,
    });
    $("#provider-list").replaceChildren(...data.items.map(providerCard));

    if (data.total === 0) {
      setStatus("#results-status", "No providers match your filters.");
    } else {
      const first = (data.page - 1) * data.limit + 1;
      const last = first + data.items.length - 1;
      setStatus(
        "#results-status",
        `Showing ${first}–${last} of ${data.total} providers`
      );
    }

    $("#prev-page").disabled = data.page <= 1;
    $("#next-page").disabled = data.page >= data.pages;
    $("#page-info").textContent =
      data.pages > 0 ? `Page ${data.page} of ${data.pages}` : "";
  } catch (error) {
    setStatus("#results-status", error.message, "error");
  }
}

async function loadSummary() {
  const city = state.filters.city || "";
  const place = city ? `in ${city}` : "across all cities";
  try {
    const summary = await getSummary(city);
    setStatus(
      "#summary-status",
      summary.reportsUsed === 0
        ? `No recent availability reports ${place} yet.`
        : `${summary.acceptingProviders} of ${summary.providersWithReports} providers ${place} were recently reported as accepting new patients, based on ${summary.reportsUsed} reports from the last 30 days.`
    );
  } catch (error) {
    setStatus("#summary-status", error.message, "error");
  }
}

$("#filters").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  state.filters = {
    q: data.get("q").trim(),
    city: data.get("city"),
    status: data.get("status"),
    insurance: data.get("insurance"),
    telehealth: data.get("telehealth") === "on",
  };
  state.page = 1;
  loadResults();
  loadSummary();
});

$("#prev-page").addEventListener("click", () => {
  state.page -= 1;
  loadResults();
});

$("#next-page").addEventListener("click", () => {
  state.page += 1;
  loadResults();
});

$("#provider-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-provider-id]");
  if (button) openProvider(button.dataset.providerId);
});

function historyItem(report) {
  const extras = [{ text: `Reported ${formatDate(report.createdAt)}` }];
  if (report.isOutdated) {
    extras.push({ text: "Outdated", className: "outdated" });
  }

  const item = el(
    "li",
    { className: "report-card" },
    el(
      "div",
      { className: "card-heading" },
      statusBadge(report),
      demoBadge(report)
    ),
    reportMeta(report, extras),
    report.notes
      ? el("p", { className: "notes", textContent: report.notes })
      : null
    
  );

  if (report.isMine) {
    const edit = el("button", {
      type: "button",
      className: "secondary-button",
      textContent: "Edit",
    });
    edit.dataset.action = "edit";
    edit.dataset.reportId = report._id;

    const remove = el("button", {
      type: "button",
      className: "delete-button",
      textContent: "Delete",
    });
    remove.dataset.action = "delete";
    remove.dataset.reportId = report._id;

    item.append(el("div", { className: "card-actions" }, edit, remove));
  }
  return item;
}

function renderDetail({ provider, current, history }) {
  state.history = history;
  $("#detail-name").textContent = provider.name;
  $("#detail-meta").textContent =
    `${provider.credential} · ${provider.specialty} · ${provider.city}, ${provider.state} ${provider.zip}`;

  $("#detail-current").replaceChildren(
    current
      ? el(
          "div",
          { className: "card-heading" },
          statusBadge(current),
          demoBadge(current),
          reportMeta(current)
        )
      : el("p", { textContent: "No recent availability info." })
  );

  $("#history").replaceChildren(...history.map(historyItem));
  $("#history-empty").hidden = history.length > 0;
}

async function openProvider(providerId) {
  state.providerId = providerId;
  resetForm();
  setStatus("#form-status", "");
  try {
    renderDetail(await getProviderAvailability(providerId));
    $("#search-view").hidden = true;
    $("#detail-view").hidden = false;
    $("#detail-name").focus();
  } catch (error) {
    setStatus("#results-status", error.message, "error");
  }
}

async function refreshDetail() {
  renderDetail(await getProviderAvailability(state.providerId));
}

$("#back-to-results").addEventListener("click", () => {
  $("#detail-view").hidden = true;
  $("#search-view").hidden = false;
  loadResults();
  loadSummary();
});

$("#history").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const report = state.history.find((r) => r._id === button.dataset.reportId);
  if (!report) return;

  if (button.dataset.action === "edit") {
    startEditing(report);
    return;
  }

  if (!window.confirm("Delete this report? This can't be undone.")) return;
  try {
    await deleteReport(report._id);
    if (state.editingId === report._id) resetForm();
    setStatus("#form-status", "Your report was deleted.", "success");
    await refreshDetail();
  } catch (error) {
    setStatus("#form-status", error.message, "error");
  }
});

const form = $("#report-form");

function updateWaitlistField() {
  const isWaitlist = form.elements.acceptingStatus.value === "waitlist";
  $("#waitlist-field").hidden = !isWaitlist;
  $("#waitlist-weeks").required = isWaitlist;
}

function updateNotesCount() {
  $("#notes-count").textContent = $("#notes").value.length;
}

function resetForm() {
  form.reset();
  state.editingId = null;
  $("#form-title").textContent = "Report availability";
  $("#submit-report").textContent = "Submit report";
  $("#cancel-edit").hidden = true;
  updateWaitlistField();
  updateNotesCount();
}

function startEditing(report) {
  resetForm();
  state.editingId = report._id;
  form.elements.acceptingStatus.value = report.acceptingStatus;
  $("#waitlist-weeks").value = report.waitlistWeeks ?? "";
  for (const box of form.querySelectorAll('input[name="insurances"]')) {
    box.checked = report.insurances.includes(box.value);
  }
  $("#telehealth-offered").checked = report.telehealth;
  $("#notes").value = report.notes;

  $("#form-title").textContent = "Edit your report";
  $("#submit-report").textContent = "Save changes";
  $("#cancel-edit").hidden = false;
  updateWaitlistField();
  updateNotesCount();
  form.scrollIntoView({ behavior: "smooth" });
}

function readForm() {
  const data = new FormData(form);
  const status = data.get("acceptingStatus");
  return {
    providerId: state.providerId,
    acceptingStatus: status,
    waitlistWeeks:
      status === "waitlist" ? Number(data.get("waitlistWeeks")) : null,
    insurances: data.getAll("insurances"),
    telehealth: data.get("telehealth") === "on",
    notes: data.get("notes").trim(),
  };
}

form.addEventListener("change", updateWaitlistField);
$("#notes").addEventListener("input", updateNotesCount);
$("#cancel-edit").addEventListener("click", () => {
  resetForm();
  setStatus("#form-status", "");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const report = readForm();
  const wasEditing = Boolean(state.editingId);
  setStatus("#form-status", "Saving…");

  try {
    if (wasEditing) {
      await updateReport(state.editingId, report);
    } else {
      await createReport(report);
    }
    resetForm();
    setStatus(
      "#form-status",
      wasEditing
        ? "Your report was updated."
        : "Thanks! Your report was added.",
      "success"
    );
    await refreshDetail();
  } catch (error) {
    setStatus("#form-status", error.message, "error");
  }
});

init();
