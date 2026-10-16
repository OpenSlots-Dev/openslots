async function requestJSON(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getExperienceReports({
  providerId = "",
  therapyType = "",
  visitFormat = "",
  rating = "",
  wouldRecommend = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams({ page, limit });

  if (providerId) params.set("providerId", providerId);
  if (therapyType) params.set("therapyType", therapyType);
  if (visitFormat) params.set("visitFormat", visitFormat);
  if (rating) params.set("rating", rating);

  if (typeof wouldRecommend === "boolean") {
    params.set("wouldRecommend", wouldRecommend);
  }

  return requestJSON(`/api/experience-reports?${params}`);
}

export function getExperienceReport(id) {
  return requestJSON(`/api/experience-reports/${encodeURIComponent(id)}`);
}

export function getExperienceSummary(providerId) {
  return requestJSON(
    `/api/experience-reports/summary/${encodeURIComponent(providerId)}`
  );
}

export function createExperienceReport(report) {
  return requestJSON("/api/experience-reports", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(report),
  });
}

export function updateExperienceReport(id, report) {
  return requestJSON(`/api/experience-reports/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(report),
  });
}

export function deleteExperienceReport(id) {
  return requestJSON(`/api/experience-reports/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
