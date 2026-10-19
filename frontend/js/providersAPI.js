async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }

  return response.json();
}

export function searchProviders({
  q = "",
  city = "",
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams({ page, limit });

  if (q) {
    params.set("q", q);
  }

  if (city) {
    params.set("city", city);
  }

  return getJSON(`/api/providers?${params}`);
}

export function getCities() {
  return getJSON("/api/providers/cities");
}
