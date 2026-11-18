const HIDDEN_CLASS = 'filmin-seen-filter-hidden';
const STYLE_ID = 'filmin-seen-filter-style';
const RATING_HIDDEN_CLASS = 'filmin-rating-filter-hidden';

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: 'hide',
  seenTitles: [],
  ratingFilterEnabled: false,
  ratingThreshold: 7.0
};

const STATE = {
  settings: { ...DEFAULT_SETTINGS },
  processed: new WeakSet(),
  hiddenCount: 0,
  dimmedCount: 0,
  ratingHiddenCount: 0,
  lastUrl: location.href,
  rescanTimer: null,
  periodicTimer: null,
  importRunning: false
};


function ensureFilterStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .${HIDDEN_CLASS},
    .${HIDDEN_CLASS}.d-block,
    .${RATING_HIDDEN_CLASS},
    .${RATING_HIDDEN_CLASS}.d-block {
      display: none !important;
    }
    .filmin-mark-seen {position:relative;z-index:20;background:#111;color:white;border:1px solid #aaa;border-radius:6px;padding:5px 8px;font:12px system-ui;cursor:pointer;margin:5px;}
    .filmin-mark-seen[aria-pressed="true"] {background:#355744;}
  `;
  (document.head || document.documentElement).appendChild(style);
}

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

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSeenSet() {
  return new Set((STATE.settings.seenTitles || []).map(normalizeTitle).filter(Boolean));
}


function getCards() {
  const cards = new Set();
  document.querySelectorAll('[data-mix-panel-item-index], .card-media[itemtype], a[href*="/pelicula/"], a[href*="/serie/"]').forEach(node => {
    const card = node.closest('[data-mix-panel-item-index]') || node.closest('.c-col') || node.closest('.card-media[itemtype]');
    if (card && card.querySelector('a[href*="/pelicula/"],a[href*="/serie/"]')) cards.add(card);
  });
  return [...cards].filter(card => ![...cards].some(other => other !== card && other.contains(card)));
}
function getCardTitle(card) {
  const node = card.querySelector('.info-title[itemprop="name"], .info-title, [data-track-property-media-title], img[alt]');
  return node?.getAttribute('data-track-property-media-title') || node?.getAttribute('alt') || node?.textContent?.trim() || '';
}
function getCardRating(card) {
  const label = card.querySelector('.info-ctx.info-rank');
  const value = label?.textContent?.trim().replace(',', '.') || card.querySelector('[data-filmin-rating]')?.getAttribute('data-filmin-rating');
  if (!value || !/^(?:10(?:\.0)?|[0-9](?:\.[0-9])?)$/.test(value)) return null;
  return Number(value);
}
function cleanLegacy(card) {
  // Older versions hid descendants instead of the full column.
  card.querySelectorAll('.filmin-seen-filter-hidden,.filmin-rating-filter-hidden,[data-filmin-seen-applied],[data-filmin-rating-applied]').forEach(el => {
    const seen = el.dataset.filminSeenApplied === 'hide';
    const rating = el.dataset.filminRatingApplied === 'hide';
    if (seen || rating) {
      const prefix = seen ? 'filminSeen' : 'filminRating';
      const value = el.dataset[prefix+'OriginalDisplay'] || '';
      const priority = el.dataset[prefix+'OriginalDisplayPriority'] || '';
      if (value) el.style.setProperty('display',value,priority); else el.style.removeProperty('display');
    }
    el.classList.remove(HIDDEN_CLASS,RATING_HIDDEN_CLASS);
    if (el.dataset.filminSeenApplied === 'dim') {
      el.style.removeProperty('opacity'); el.style.removeProperty('filter'); el.style.removeProperty('outline');
    }
    for (const name of Object.keys(el.dataset)) if (name.startsWith('filminSeen') || name.startsWith('filminRating')) delete el.dataset[name];
    el.querySelectorAll('.filmin-seen-badge').forEach(x => x.remove());
  });
}
function restoreCard(card) {
  if (card.dataset.filminUnifiedOriginalDisplay !== undefined) {
    const value=card.dataset.filminUnifiedOriginalDisplay;
    if (value) card.style.setProperty('display',value,card.dataset.filminUnifiedOriginalPriority || '');
    else card.style.removeProperty('display');
  } else if (card.dataset.filminRatingApplied === 'hide' || card.dataset.filminSeenApplied === 'hide') {
    const prefix=card.dataset.filminRatingApplied === 'hide' ? 'filminRating' : 'filminSeen';
    const value=card.dataset[prefix+'OriginalDisplay'] || '';
    if(value) card.style.setProperty('display',value,card.dataset[prefix+'OriginalDisplayPriority'] || '');
    else card.style.removeProperty('display');
  }
  card.classList.remove(HIDDEN_CLASS,RATING_HIDDEN_CLASS);
  card.style.removeProperty('opacity');card.style.removeProperty('filter');card.style.removeProperty('outline');
  for(const name of Object.keys(card.dataset)) if(name.startsWith('filminUnified') || name.startsWith('filminRating') || name.startsWith('filminSeen')) delete card.dataset[name];
}
function ensureSeenButton(card,title,seen) {
  if (!title || location.pathname.startsWith('/historial')) return;
  const media=card.querySelector('.card-media') || card;
  const host=media.querySelector('.card-options-controls') || media.querySelector('.card-image') || media;
  let button=card.querySelector('.filmin-mark-seen');
  if (!button) {
    button=document.createElement('button');button.type='button';button.className='filmin-mark-seen';
    button.title='Agregar o quitar del listado de vistos';
    button.addEventListener('click',async event => {
      event.preventDefault();event.stopPropagation();
      const current=await chrome.storage.local.get({seenTitles:[]});
      const key=normalizeTitle(button.dataset.title || '');
      const exists=(current.seenTitles || []).some(t=>normalizeTitle(t)===key);
      const titles=exists ? current.seenTitles.filter(t=>normalizeTitle(t)!==key) : [...current.seenTitles,button.dataset.title];
      await chrome.storage.local.set({seenTitles:titles});
    });
    host.appendChild(button);
  }
  button.dataset.title=title;
  button.textContent=seen ? '✓ Vista' : '+ Marcar vista';
  button.setAttribute('aria-pressed',String(Boolean(seen)));
}
function notifyPopup() {
  chrome.runtime.sendMessage({type:'FILMIN_SEEN_FILTER_STATUS',hiddenCount:STATE.hiddenCount,dimmedCount:STATE.dimmedCount,ratingHiddenCount:STATE.ratingHiddenCount,importing:STATE.importRunning}).catch(()=>{});
}
function rescan() {
  STATE.hiddenCount=0;STATE.dimmedCount=0;STATE.ratingHiddenCount=0;
  const seenSet=buildSeenSet();
  const enabled=Boolean(STATE.settings.enabled);
  const threshold=Number(STATE.settings.ratingThreshold);
  const ratingEnabled=Boolean(STATE.settings.ratingFilterEnabled) && Number.isFinite(threshold);
  for(const card of getCards()) {
    cleanLegacy(card);
    const title=getCardTitle(card);
    const seen=seenSet.has(normalizeTitle(title));
    const rating=getCardRating(card);
    const low=ratingEnabled && rating!==null && rating<threshold;
    const hide=low || (enabled && seen && STATE.settings.mode==='hide');
    const dim=!hide && enabled && seen && STATE.settings.mode==='dim';
    const desired=hide?'hide':dim?'dim':'show';
    const previous=card.dataset.filminUnifiedState || 'show';
    if(previous!==desired || (hide && card.style.getPropertyValue('display')!=='none')) {
      restoreCard(card);
      if(hide) {
        card.dataset.filminUnifiedOriginalDisplay=card.style.getPropertyValue('display') || '';
        card.dataset.filminUnifiedOriginalPriority=card.style.getPropertyPriority('display') || '';
        card.classList.add(HIDDEN_CLASS);
        card.style.setProperty('display','none','important');
      } else if(dim) {
        card.style.setProperty('opacity','0.22');card.style.setProperty('filter','grayscale(1)');
      }
      card.dataset.filminUnifiedState=desired;
    }
    ensureSeenButton(card,title,seen);
    if(hide && enabled && seen) STATE.hiddenCount++;
    if(dim) STATE.dimmedCount++;
    if(low) STATE.ratingHiddenCount++;
  }
  notifyPopup();
}
function scheduleRescan(delay = 250) {
  window.clearTimeout(STATE.rescanTimer);
  STATE.rescanTimer = window.setTimeout(() => {
    if (STATE.lastUrl !== location.href) {
      STATE.lastUrl = location.href;
    }

    rescan();
  }, delay);
}

async function loadSettings() {
  const data = await chrome.storage.local.get(DEFAULT_SETTINGS);
  STATE.settings = { ...DEFAULT_SETTINGS, ...data };
}

function observeDom() {
  const observer = new MutationObserver(() => scheduleRescan(180));
  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true,
    attributes: false
  });

  window.addEventListener('scroll', () => scheduleRescan(120), { passive: true });
  window.addEventListener('popstate', () => scheduleRescan(80));
  window.addEventListener('hashchange', () => scheduleRescan(80));

  const wrapHistory = method => {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleRescan(80);
      return result;
    };
  };

  wrapHistory('pushState');
  wrapHistory('replaceState');

  STATE.periodicTimer = window.setInterval(() => {
    if (STATE.lastUrl !== location.href) {
      STATE.lastUrl = location.href;
      scheduleRescan(50);
      return;
    }
    scheduleRescan(80);
  }, 1500);
}

function getTitleFromElement(node) {
  const card=node.closest?.('[data-mix-panel-item-index],.card-media') || node;
  const title=getCardTitle(card);
  if(title) return title;
  return node.getAttribute?.('data-track-property-media-title') || node.querySelector?.('img[alt]')?.getAttribute('alt') || '';
}
function getHistoryCandidateTitles() {
  const nodes = Array.from(document.querySelectorAll([
    'a[href*="/pelicula/"]',
    'a[href*="/serie/"]',
    'article',
    'li',
    '[class*="card"]',
    '[class*="poster"]',
    '[class*="item"]',
    'img[alt]',
    '[aria-label]',
    '[title]'
  ].join(',')));

  const titles = [];
  for (const node of nodes) {
    const title = getTitleFromElement(node);
    const clean = String(title || '').trim();
    if (clean && clean.length >= 2) titles.push(clean);
  }
  return titles;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dedupeTitles(titles) {
  const seen = new Set();
  const result = [];
  for (const title of titles) {
    const normalized = normalizeTitle(title);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(String(title).trim());
  }
  return result;
}

async function updateImportProgress(progress) {
  await chrome.storage.local.set({
    filminImportStatus: {
      ...(await chrome.storage.local.get('filminImportStatus')).filminImportStatus,
      ...progress,
      updatedAt: Date.now()
    }
  });
}

async function importHistory() {
  if (STATE.importRunning) {
    return { ok: false, message: 'Ya hay una importación en curso.' };
  }
  if (!location.href.startsWith('https://www.filmin.es/historial')) {
    return { ok: false, message: 'Abrí la página de historial de Filmin.' };
  }

  STATE.importRunning = true;
  notifyPopup();
  try {
    await updateImportProgress({
      running: true,
      message: 'Importando historial…',
      found: 0,
      added: 0,
      done: false
    });

    const found = [];
    let lastHeight = -1;
    let stableRounds = 0;
    let iterations = 0;

    while (stableRounds < 5 && iterations < 120) {
      iterations += 1;
      found.push(...getHistoryCandidateTitles());
      const uniqueFound = dedupeTitles(found);
      await updateImportProgress({
        running: true,
        message: `Leyendo historial… (${uniqueFound.length} títulos detectados)`,
        found: uniqueFound.length,
        added: 0,
        done: false
      });

      const currentHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );
      window.scrollTo({ top: currentHeight, behavior: 'instant' });
      await sleep(900);
      const nextHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      );

      if (nextHeight === lastHeight || nextHeight === currentHeight) stableRounds += 1;
      else stableRounds = 0;
      lastHeight = nextHeight;
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    const imported = dedupeTitles(found);
    const storage = await chrome.storage.local.get(DEFAULT_SETTINGS);
    const merged = dedupeTitles([...(storage.seenTitles || []), ...imported]);
    const added = merged.length - (storage.seenTitles || []).length;
    await chrome.storage.local.set({ seenTitles: merged });
    STATE.settings.seenTitles = merged;

    rescan();

    await updateImportProgress({
      running: false,
      message: `Historial importado. ${added} títulos nuevos.`,
      found: imported.length,
      added,
      done: true
    });

    return { ok: true, imported: imported.length, added };
  } catch (error) {
    await updateImportProgress({
      running: false,
      message: `Error al importar: ${error?.message || error}`,
      done: true
    });
    return { ok: false, message: error?.message || String(error) };
  } finally {
    STATE.importRunning = false;
    notifyPopup();
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.enabled || changes.mode || changes.seenTitles || changes.ratingFilterEnabled || changes.ratingThreshold) {
    loadSettings().then(() => scheduleRescan(30));
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'FILMIN_SEEN_FILTER_RESCAN') {
    scheduleRescan(10);
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === 'FILMIN_SEEN_FILTER_GET_STATUS') {
    sendResponse({
      hiddenCount: STATE.hiddenCount,
      dimmedCount: STATE.dimmedCount,
    ratingHiddenCount: STATE.ratingHiddenCount,
      importing: STATE.importRunning
    });
    return;
  }

  if (message?.type === 'FILMIN_SEEN_FILTER_IMPORT_HISTORY') {
    importHistory().then(sendResponse);
    return true;
  }
});

(async function init() {
  ensureFilterStyles();
  await loadSettings();
  observeDom();
  scheduleRescan(30);
})();
