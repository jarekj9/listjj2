const TOKEN_KEY = "listjj_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function buildUrl(path, query) {
  const url = `/api${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.append(key, value);
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function errorMessage(res) {
  try {
    const data = await res.json();
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map((d) => d.msg).join("; ");
  } catch {
    /* not JSON */
  }
  return res.statusText || `HTTP ${res.status}`;
}

async function request(method, path, { body, form, query, raw } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form; // browser sets multipart boundary
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(buildUrl(path, query), { method, headers, body: payload });
  if (res.status === 401 && token) {
    tokenStore.clear();
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res));
  if (res.status === 204) return null;
  if (raw) return res;
  const type = res.headers.get("content-type") || "";
  return type.includes("application/json") ? res.json() : res.text();
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  get: (path, query) => request("GET", path, { query }),
  post: (path, body, query) => request("POST", path, { body, query }),
  put: (path, body) => request("PUT", path, { body }),
  del: (path) => request("DELETE", path),
  upload: (path, file) => {
    const form = new FormData();
    form.append("file", file);
    return request("POST", path, { form });
  },
  download: async (path, filename) => {
    const res = await request("GET", path, { raw: true });
    saveBlob(await res.blob(), filename);
  },
};
