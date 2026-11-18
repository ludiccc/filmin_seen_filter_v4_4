const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'hide',
  seenTitles: []
};

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[“”"'`´]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTitles(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map(v => String(v).trim()).filter(Boolean);
    }
  } catch {}

  const lines = text
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length === 1 && lines[0].includes(',')) {
    return lines[0].split(',').map(v => v.trim()).filter(Boolean);
  }

  return lines;
}

function dedupeTitles(titles) {
  const seen = new Set();
  const result = [];
  for (const title of titles) {
    const key = normalizeTitle(title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(title.trim());
  }
  return result;
}

async function load() {
  const data = await chrome.storage.local.get(DEFAULT_SETTINGS);
  document.getElementById('enabled').checked = Boolean(data.enabled);
  document.getElementById('mode').value = data.mode === 'dim' ? 'dim' : 'hide';
  document.getElementById('titles').value = (data.seenTitles || []).join('\n');
  updateCount();
}

function updateCount() {
  const titles = parseTitles(document.getElementById('titles').value);
  document.getElementById('count').textContent = String(dedupeTitles(titles).length);
}

async function save() {
  const enabled = document.getElementById('enabled').checked;
  const mode = document.getElementById('mode').value === 'dim' ? 'dim' : 'hide';
  const titles = dedupeTitles(parseTitles(document.getElementById('titles').value));

  await chrome.storage.local.set({ enabled, mode, seenTitles: titles });
  document.getElementById('titles').value = titles.join('\n');
  updateCount();
  document.getElementById('status').textContent = 'Guardado.';
  setTimeout(() => {
    document.getElementById('status').textContent = '';
  }, 1500);
}

document.getElementById('save').addEventListener('click', save);
document.getElementById('dedupe').addEventListener('click', () => {
  const titles = dedupeTitles(parseTitles(document.getElementById('titles').value));
  document.getElementById('titles').value = titles.join('\n');
  updateCount();
});
document.getElementById('clear').addEventListener('click', () => {
  document.getElementById('titles').value = '';
  updateCount();
});
document.getElementById('titles').addEventListener('input', updateCount);
load();
