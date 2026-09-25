// Backend base URL. The frontend and backend are separate containers linked
// by docker-compose and both publish ports to the host, so the browser talks
// to the backend directly on its published port.
const API_BASE = window.SHADOW_API_BASE || `${location.protocol}//${location.hostname}:8000`;

function getToken() {
  return localStorage.getItem('sp_token');
}
function setToken(token) {
  if (token) localStorage.setItem('sp_token', token);
  else localStorage.removeItem('sp_token');
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  register: (username, password) =>
    request('/api/auth/register', { method: 'POST', body: { username, password } }),
  login: (username, password) =>
    request('/api/auth/login', { method: 'POST', body: { username, password } }),
  profile: () => request('/api/profile', { auth: true }),
  updateProfile: (avatar_color) =>
    request('/api/profile', { method: 'POST', body: { avatar_color }, auth: true }),
  loadoutOptions: () => request('/api/loadout/options'),
  updateLoadout: (primary_weapon, secondary_weapon) =>
    request('/api/loadout', { method: 'POST', body: { primary_weapon, secondary_weapon }, auth: true }),
  submitMatch: (result) =>
    request('/api/match/submit', { method: 'POST', body: result, auth: true }),
  leaderboard: () => request('/api/leaderboard'),
  getToken,
  setToken,
};
