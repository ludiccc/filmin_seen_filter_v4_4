const DEFAULT_SETTINGS = { enabled: true, mode: 'hide', seenTitles: [], ratingFilterEnabled: false, ratingThreshold: 7.0 };
const HISTORY_URL = 'https://www.filmin.es/historial';
let statusTimer = null;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadStorage() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}

async function getImportStatus() {
  const data = await chrome.storage.local.get('filminImportStatus');
  return data.filminImportStatus || null;
}

async function getPageStatus() {
  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url?.startsWith('https://www.filmin.es/')) {
    return { hiddenCount: 0, dimmedCount: 0, ratingHiddenCount: 0, importing: false };
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, { type: 'FILMIN_SEEN_FILTER_GET_STATUS' });
  } catch {
    return { hiddenCount: 0, dimmedCount: 0, ratingHiddenCount: 0, importing: false };
  }
}

async function findOrCreateHistoryTab() {
  const tabs = await chrome.tabs.query({ url: 'https://www.filmin.es/*' });
  const existing = tabs.find(tab => (tab.url || '').startsWith(HISTORY_URL));
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url: HISTORY_URL });
    return existing;
  }
  return chrome.tabs.create({ url: HISTORY_URL, active: true });
}

async function waitForTabReady(tabId, maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete' && (tab.url || '').startsWith(HISTORY_URL)) return tab;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('La página de historial no terminó de cargar.');
}

async function refresh() {
  const settings = await loadStorage();
  const status = await getPageStatus();
  const importStatus = await getImportStatus();
  document.getElementById('enabled').checked = Boolean(settings.enabled);
  document.getElementById('mode').value = settings.mode === 'dim' ? 'dim' : 'hide';
  document.getElementById('ratingFilterEnabled').checked = Boolean(settings.ratingFilterEnabled);
  const threshold = Number.isFinite(Number(settings.ratingThreshold)) ? Number(settings.ratingThreshold) : 7.0;
  document.getElementById('ratingThreshold').value = threshold.toFixed(1);
  document.getElementById('ratingValue').textContent = threshold.toFixed(1);
  document.getElementById('seenCount').textContent = String((settings.seenTitles || []).length);
  document.getElementById('hiddenCount').textContent = String(status.hiddenCount || 0);
  document.getElementById('dimmedCount').textContent = String(status.dimmedCount || 0);
  document.getElementById('ratingHiddenCount').textContent = String(status.ratingHiddenCount || 0);
  document.getElementById('importStatus').textContent = importStatus?.message || '';
}

function startPolling() {
  stopPolling();
  statusTimer = window.setInterval(refresh, 1000);
}

function stopPolling() {
  if (statusTimer) {
    window.clearInterval(statusTimer);
    statusTimer = null;
  }
}

document.getElementById('enabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ enabled: e.target.checked });
  refresh();
});

document.getElementById('mode').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ mode: e.target.value });
  refresh();
});


document.getElementById('ratingFilterEnabled').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ ratingFilterEnabled: e.target.checked });
  refresh();
});

document.getElementById('ratingThreshold').addEventListener('input', (e) => {
  document.getElementById('ratingValue').textContent = Number(e.target.value).toFixed(1);
});

document.getElementById('ratingThreshold').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ ratingThreshold: Number(Number(e.target.value).toFixed(1)) });
  refresh();
});

document.getElementById('rescan').addEventListener('click', async () => {
  const tab = await getCurrentTab();
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'FILMIN_SEEN_FILTER_RESCAN' });
    } catch {}
  }
  refresh();
});

document.getElementById('options').addEventListener('click', () => chrome.runtime.openOptionsPage());

document.getElementById('importHistory').addEventListener('click', async () => {
  document.getElementById('importStatus').textContent = 'Abriendo historial de Filmin…';
  startPolling();
  try {
    const tab = await findOrCreateHistoryTab();
    await waitForTabReady(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'FILMIN_SEEN_FILTER_IMPORT_HISTORY' });
    if (!response?.ok) {
      document.getElementById('importStatus').textContent = response?.message || 'No se pudo importar el historial.';
    }
  } catch (error) {
    document.getElementById('importStatus').textContent = error?.message || String(error);
  }
  refresh();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.filminImportStatus) {
    const next = changes.filminImportStatus.newValue;
    document.getElementById('importStatus').textContent = next?.message || '';
    if (!next?.running) refresh().then(stopPolling);
  }
  if (area === 'local' && (changes.seenTitles || changes.enabled || changes.mode || changes.ratingFilterEnabled || changes.ratingThreshold)) {
    refresh();
  }
});

refresh();
