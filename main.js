/* Runs in Filmin's MAIN world so it can inspect framework component data. */
(() => {
  const ATTR = 'data-filmin-rating';
  const TITLE_ATTR = 'data-track-property-media-title';
  const RATING_KEY = /(rating|rate|score|average|avg|valoraci|valuation|note|nota|stars?)/i;
  const TITLE_KEY = /(^|_)(title|name|media_title|mediaTitle)$/i;

  function normalizeTitle(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[“”"'`´]/g, '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ').trim();
  }

  function validRating(value) {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
  }

  function directRating(obj) {
    if (!obj || typeof obj !== 'object') return null;
    for (const [key, value] of Object.entries(obj)) {
      if (!RATING_KEY.test(key)) continue;
      const n = validRating(value);
      if (n !== null) return n;
      if (value && typeof value === 'object') {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (!RATING_KEY.test(subKey) && !/(value|mean|average|avg)/i.test(subKey)) continue;
          const sub = validRating(subValue);
          if (sub !== null) return sub;
        }
      }
    }
    return null;
  }

  function objectTitle(obj) {
    if (!obj || typeof obj !== 'object') return '';
    for (const [key, value] of Object.entries(obj)) {
      if (TITLE_KEY.test(key) && typeof value === 'string' && value.trim()) return value.trim();
    }
    return '';
  }

  function findRatingForTitle(obj, wantedTitle, depth = 0, visited = new WeakSet()) {
    if (!obj || typeof obj !== 'object' || depth > 7) return null;
    if (visited.has(obj)) return null;
    visited.add(obj);

    const objTitle = objectTitle(obj);
    if (objTitle && normalizeTitle(objTitle) === wantedTitle) {
      const n = directRating(obj);
      if (n !== null) return n;
      // Rating is sometimes nested one level below the media object.
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object') {
          const nested = directRating(value);
          if (nested !== null) return nested;
        }
      }
    }

    for (const value of Object.values(obj)) {
      if (!value || typeof value !== 'object') continue;
      const found = findRatingForTitle(value, wantedTitle, depth + 1, visited);
      if (found !== null) return found;
    }
    return null;
  }

  function fromDom(anchor) {
    let node = anchor;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      const text = node.textContent || '';
      // Filmin's catalogue score is displayed with one decimal. Requiring the
      // decimal avoids confusing it with years, ages, durations, etc.
      const matches = [...text.matchAll(/(?:^|\s)(10[\.,]0|[0-9][\.,][0-9])(?:\s|$)/g)];
      if (matches.length === 1) {
        const n = validRating(matches[0][1]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function frameworkSources(anchor) {
    const out = [];
    let node = anchor;
    for (let i = 0; node && i < 7; i++, node = node.parentElement) {
      const vm = node.__vue__;
      if (vm) out.push(vm, vm.$props, vm.$data, vm._props, vm.media);
      const v3 = node.__vueParentComponent;
      if (v3) out.push(v3.props, v3.data, v3.ctx, v3.setupState);
    }
    return out.filter(Boolean);
  }

  function fromFramework(anchor, title) {
    const wanted = normalizeTitle(title);
    for (const source of frameworkSources(anchor)) {
      try {
        const rating = findRatingForTitle(source, wanted);
        if (rating !== null) return rating;
      } catch (_) {}
    }
    return null;
  }

  function fromScripts(title) {
    const wanted = String(title || '').trim();
    if (!wanted) return null;
    const escaped = wanted.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const titleRe = new RegExp(escaped, 'i');
    const ratingRe = /["'](?:rating|rate|score|average|avg|valoracion|valoración|valuation|note|nota)["']\s*:\s*["']?(10(?:[\.,]0)?|[0-9](?:[\.,][0-9])?)/ig;

    for (const script of document.scripts) {
      const text = script.textContent || '';
      if (!text || !titleRe.test(text)) continue;
      let idx = text.search(titleRe);
      // Only inspect data near this title to avoid associating another film's rating.
      const chunk = text.slice(Math.max(0, idx - 1600), Math.min(text.length, idx + wanted.length + 1600));
      const match = ratingRe.exec(chunk);
      if (match) {
        const n = validRating(match[1]);
        if (n !== null) return n;
      }
    }
    return null;
  }

  function scan() {
    const anchors = document.querySelectorAll('a[href*="/pelicula/"], a[href*="/serie/"]');
    for (const anchor of anchors) {
      if (anchor.hasAttribute(ATTR)) continue;
      const title = anchor.getAttribute(TITLE_ATTR) || anchor.getAttribute('data-track-property-content-text') || anchor.querySelector('img[alt]')?.alt || '';
      if (!title) continue;

      // New WeakSet per title scan so repeated component graphs don't block lookup.
      // (WeakSet itself is intentionally local to each scan pass.)
      let rating = fromDom(anchor);
      if (rating === null) {
        try {
          rating = fromFramework(anchor, title);
        } catch (_) {}
      }
      if (rating === null) rating = fromScripts(title);

      if (rating !== null) {
        anchor.setAttribute(ATTR, rating.toFixed(1));
        const card = anchor.closest('[data-mix-panel-item-index], article, li, [class*="card"]');
        if (card) card.setAttribute(ATTR, rating.toFixed(1));
      }
    }
  }

  const observer = new MutationObserver(() => {
    clearTimeout(window.__filminRatingScanTimer);
    window.__filminRatingScanTimer = setTimeout(scan, 180);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('scroll', () => {
    clearTimeout(window.__filminRatingScanTimer);
    window.__filminRatingScanTimer = setTimeout(scan, 120);
  }, { passive: true });

  scan();
  setInterval(scan, 1500);
})();
