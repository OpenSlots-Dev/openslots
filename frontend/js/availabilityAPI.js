async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body.errors?.join(" ") ||
      body.error ||
      `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export function getOptions() {
  return request("/api/availability/options");
}

export function searchAvailability(filters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== false && value !== undefined) {
      params.set(key, value);
    }
  }
  return request(`/api/availability/providers?${params}`);
}

export function getProviderAvailability(providerId) {
  return request(
    `/api/availability/providers/${encodeURIComponent(providerId)}`
  );
}

export function getSummary(city = "") {
  const params = new URLSearchParams();
  if (city) params.set("city", city);
  return request(`/api/availability/summary?${params}`);
}

export function createReport(report) {
  return request("/api/availability/reports", {
    method: "POST",
    body: JSON.stringify(report),
  });
}

export function updateReport(id, report) {
  return request(`/api/availability/reports/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(report),
  });
}

export function deleteReport(id) {
  return request(`/api/availability/reports/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
