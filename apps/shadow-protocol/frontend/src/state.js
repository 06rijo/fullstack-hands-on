const SETTINGS_KEY = 'sp_settings';

const defaultSettings = {
  sensitivity: 1.0,
  volume: 0.7,
  graphics: 'medium',
  subtitles: false,
  reticleColor: '#ffb400',
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch (_) {
    return { ...defaultSettings };
  }
}

export const state = {
  profile: null, // current player's profile, as returned by the backend
  settings: loadSettings(),
  lastMatch: null, // stats from the most recently finished match
};

export function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}
