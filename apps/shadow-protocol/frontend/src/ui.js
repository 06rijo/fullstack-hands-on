import { api } from './api.js';
import { state, saveSettings } from './state.js';

const WEAPON_LABELS = {
  assault_rifle: 'Assault Rifle',
  smg: 'SMG',
  marksman_rifle: 'Marksman Rifle',
  shotgun: 'Shotgun',
  pistol: 'Pistol',
  machine_pistol: 'Machine Pistol',
};

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function renderMenu() {
  const p = state.profile;
  if (!p) return;
  document.getElementById('menu-username').textContent = p.username;
  document.getElementById('menu-level').textContent = p.level;
  document.getElementById('menu-xp').textContent = p.xp;
  document.getElementById('menu-xp-next').textContent = p.xp_to_next;
  document.getElementById('menu-avatar-color').style.background = p.avatar_color;
  const pct = Math.min(100, Math.round((p.xp / p.xp_to_next) * 100));
  document.getElementById('menu-xp-bar').style.width = `${pct}%`;
}

async function refreshProfile() {
  state.profile = await api.profile();
  renderMenu();
}

function statRow(label, value) {
  const d = document.createElement('div');
  d.innerHTML = `${label}: <span>${value}</span>`;
  return d;
}

function renderProfileScreen() {
  const p = state.profile;
  document.getElementById('profile-color').value = p.avatar_color;
  const grid = document.getElementById('profile-stats');
  grid.innerHTML = '';
  grid.append(
    statRow('Matches', p.matches_played),
    statRow('Kills', p.kills),
    statRow('Deaths', p.deaths),
    statRow('Headshots', p.headshots),
    statRow('Best wave', p.best_wave),
    statRow('Level', p.level),
  );
}

let selectedPrimary = null;
let selectedSecondary = null;

async function renderLoadoutScreen() {
  const opts = await api.loadoutOptions();
  selectedPrimary = state.profile.primary_weapon;
  selectedSecondary = state.profile.secondary_weapon;

  const buildGrid = (containerId, options, selected, onPick) => {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    options.forEach((w) => {
      const card = document.createElement('div');
      card.className = 'weapon-card' + (w === selected ? ' selected' : '');
      card.textContent = WEAPON_LABELS[w] || w;
      card.addEventListener('click', () => {
        el.querySelectorAll('.weapon-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        onPick(w);
      });
      el.appendChild(card);
    });
  };

  buildGrid('primary-weapon-grid', opts.primary, selectedPrimary, (w) => (selectedPrimary = w));
  buildGrid('secondary-weapon-grid', opts.secondary, selectedSecondary, (w) => (selectedSecondary = w));
}

function renderLeaderboard(rows) {
  const tbody = document.getElementById('leaderboard-rows');
  tbody.innerHTML = '';
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i + 1}</td><td>${r.username}</td><td>${r.level}</td><td>${r.xp}</td><td>${r.kills}</td><td>${r.best_wave}</td>`;
    tbody.appendChild(tr);
  });
}

function renderSettingsScreen() {
  const s = state.settings;
  document.getElementById('setting-sensitivity').value = s.sensitivity;
  document.getElementById('setting-volume').value = s.volume;
  document.getElementById('setting-graphics').value = s.graphics;
  document.getElementById('setting-subtitles').checked = s.subtitles;
  document.getElementById('setting-reticle').value = s.reticleColor;
}

export function showResults({ kills, headshots, deaths, wave, xpEarned, leveledUp, newLevel }) {
  document.getElementById('results-stats').innerHTML = '';
  const grid = document.getElementById('results-stats');
  grid.append(
    statRow('Kills', kills),
    statRow('Headshots', headshots),
    statRow('Wave reached', wave),
    statRow('XP earned', xpEarned),
  );
  const lvl = document.getElementById('results-levelup');
  if (leveledUp) {
    lvl.classList.remove('hidden');
    document.getElementById('results-new-level').textContent = newLevel;
  } else {
    lvl.classList.add('hidden');
  }
  showScreen('screen-results');
}

function wireAuth() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach((f) => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`form-${btn.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    try {
      const { token, profile } = await api.login(
        document.getElementById('login-username').value.trim(),
        document.getElementById('login-password').value,
      );
      api.setToken(token);
      state.profile = profile;
      renderMenu();
      showScreen('screen-menu');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    try {
      const { token, profile } = await api.register(
        document.getElementById('register-username').value.trim(),
        document.getElementById('register-password').value,
      );
      api.setToken(token);
      state.profile = profile;
      renderMenu();
      showScreen('screen-menu');
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

function wireMenu(startGame) {
  document.getElementById('btn-play').addEventListener('click', () => startGame());
  document.getElementById('btn-logout').addEventListener('click', () => {
    api.setToken(null);
    state.profile = null;
    showScreen('screen-auth');
  });

  document.getElementById('btn-loadout').addEventListener('click', async () => {
    await renderLoadoutScreen();
    showScreen('screen-loadout');
  });
  document.getElementById('loadout-back').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('loadout-save').addEventListener('click', async () => {
    state.profile = await api.updateLoadout(selectedPrimary, selectedSecondary);
    showScreen('screen-menu');
  });

  document.getElementById('btn-profile').addEventListener('click', () => {
    renderProfileScreen();
    showScreen('screen-profile');
  });
  document.getElementById('profile-back').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('profile-save').addEventListener('click', async () => {
    state.profile = await api.updateProfile(document.getElementById('profile-color').value);
    renderMenu();
    showScreen('screen-menu');
  });

  document.getElementById('btn-leaderboard').addEventListener('click', async () => {
    renderLeaderboard(await api.leaderboard());
    showScreen('screen-leaderboard');
  });
  document.getElementById('leaderboard-back').addEventListener('click', () => showScreen('screen-menu'));

  document.getElementById('btn-settings').addEventListener('click', () => {
    renderSettingsScreen();
    showScreen('screen-settings');
  });
  document.getElementById('settings-back').addEventListener('click', () => showScreen('screen-menu'));
  document.getElementById('settings-save').addEventListener('click', () => {
    state.settings.sensitivity = parseFloat(document.getElementById('setting-sensitivity').value);
    state.settings.volume = parseFloat(document.getElementById('setting-volume').value);
    state.settings.graphics = document.getElementById('setting-graphics').value;
    state.settings.subtitles = document.getElementById('setting-subtitles').checked;
    state.settings.reticleColor = document.getElementById('setting-reticle').value;
    saveSettings();
    document.getElementById('reticle').style.borderColor = state.settings.reticleColor;
    showScreen('screen-menu');
  });

  document.getElementById('results-continue').addEventListener('click', async () => {
    await refreshProfile();
    showScreen('screen-menu');
  });
}

export async function initUI(startGame) {
  wireAuth();
  wireMenu(startGame);
  document.getElementById('reticle').style.borderColor = state.settings.reticleColor;

  if (api.getToken()) {
    try {
      await refreshProfile();
      showScreen('screen-menu');
    } catch (_) {
      api.setToken(null);
      showScreen('screen-auth');
    }
  } else {
    showScreen('screen-auth');
  }
}

export { refreshProfile };
