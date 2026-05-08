(() => {
  'use strict';

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    followers: [],    // { username, fullname, avatar, isVerified, followsYouBack, el }
    selected: new Set(),
    removed: new Set(),
    scanning: false,
    running: false,
    delayMs: 2000,
    stopRequested: false,
    scanObserver: null,
    filterNonFollowers: false,
    filterVerified: false,
  };

  if (document.getElementById('igfr-panel')) return;

  // ─── Build panel HTML ─────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'igfr-panel';
  panel.innerHTML = `
    <div id="igfr-header">
      <div id="igfr-title">Follower Remover</div>
      <button id="igfr-close" title="Close">✕</button>
    </div>
    <div id="igfr-stats">
      <div class="igfr-stat"><span class="igfr-stat-value" id="igfr-stat-found">0</span><span class="igfr-stat-label">Found</span></div>
      <div class="igfr-stat-divider"></div>
      <div class="igfr-stat"><span class="igfr-stat-value" id="igfr-stat-selected">0</span><span class="igfr-stat-label">Selected</span></div>
      <div class="igfr-stat-divider"></div>
      <div class="igfr-stat"><span class="igfr-stat-value" id="igfr-stat-removed">0</span><span class="igfr-stat-label">Removed</span></div>
    </div>
    <div id="igfr-toolbar">
      <button id="igfr-scan-btn">⟳ Scan followers</button>
      <button id="igfr-select-all">Select all</button>
    </div>
    <div id="igfr-filters">
      <label class="igfr-filter-chip" id="igfr-chip-nonfollowers">
        <input type="checkbox" id="igfr-filter-nonfollowers">
        <span>Not following back</span>
      </label>
      <label class="igfr-filter-chip" id="igfr-chip-verified">
        <input type="checkbox" id="igfr-filter-verified">
        <span>✓ Verified</span>
      </label>
    </div>
    <div id="igfr-search-wrap">
      <input id="igfr-search" type="text" placeholder="Search username…">
    </div>
    <div id="igfr-progress"><div id="igfr-progress-bar"></div></div>
    <div id="igfr-list-wrap">
      <div id="igfr-empty">
        <div id="igfr-empty-icon">👥</div>
        <div>Open the followers list on an Instagram profile, then click <strong>Scan followers</strong></div>
      </div>
    </div>
    <div id="igfr-speed-wrap">
      <div class="igfr-speed-label">
        <span>Delay between removals</span>
        <span id="igfr-speed-val">2.0s</span>
      </div>
      <input id="igfr-speed-slider" type="range" min="500" max="8000" step="100" value="2000">
    </div>
    <div id="igfr-action-wrap">
      <button id="igfr-remove-btn" disabled>Remove selected (0)</button>
    </div>
  `;
  document.body.appendChild(panel);

  const toggle = document.createElement('button');
  toggle.id = 'igfr-toggle';
  toggle.title = 'Open Follower Remover';
  toggle.textContent = '✕';
  toggle.classList.add('hidden');
  document.body.appendChild(toggle);

  // ─── Element refs ─────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const elTitle             = $('igfr-title');
  const elClose             = $('igfr-close');
  const elStatFound         = $('igfr-stat-found');
  const elStatSel           = $('igfr-stat-selected');
  const elStatRem           = $('igfr-stat-removed');
  const elScanBtn           = $('igfr-scan-btn');
  const elSelectAll         = $('igfr-select-all');
  const elSearch            = $('igfr-search');
  const elList              = $('igfr-list-wrap');
  const elProgressBar       = $('igfr-progress-bar');
  const elRemoveBtn         = $('igfr-remove-btn');
  const elSpeedSlider       = $('igfr-speed-slider');
  const elSpeedVal          = $('igfr-speed-val');
  const elFilterNonFollow   = $('igfr-filter-nonfollowers');
  const elFilterVerified    = $('igfr-filter-verified');

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function updateStats() {
    const active = state.followers.filter(f => !state.removed.has(f.username));
    elStatFound.textContent = active.length;
    elStatSel.textContent   = state.selected.size;
    elStatRem.textContent   = state.removed.size;
    const count = state.selected.size;
    elRemoveBtn.disabled = count === 0 || state.running;
    elRemoveBtn.textContent = state.running
      ? '■ Stop removing'
      : `Remove selected (${count})`;

    const allVisible = getFilteredFollowers();
    const allSel = allVisible.length > 0 && allVisible.every(f => state.selected.has(f.username));
    elSelectAll.classList.toggle('all-selected', allSel);
    elSelectAll.textContent = allSel ? 'Deselect all' : 'Select all';
  }

  function getFilteredFollowers() {
    const q = elSearch.value.trim().toLowerCase();
    return state.followers.filter(f => {
      if (state.removed.has(f.username)) return false;
      if (q && !f.username.toLowerCase().includes(q) && !(f.fullname || '').toLowerCase().includes(q)) return false;
      if (state.filterNonFollowers && f.followsYouBack) return false;
      if (state.filterVerified && !f.isVerified) return false;
      return true;
    });
  }

  function renderList() {
    const filtered = getFilteredFollowers();

    if (filtered.length === 0 && state.followers.length === 0) {
      elList.innerHTML = `
        <div id="igfr-empty">
          <div id="igfr-empty-icon">👥</div>
          <div>Open the followers list on an Instagram profile, then click <strong>Scan followers</strong></div>
        </div>`;
      return;
    }
    if (filtered.length === 0) {
      elList.innerHTML = `<div id="igfr-empty"><div id="igfr-empty-icon">🔍</div><div>No results</div></div>`;
      return;
    }

    elList.innerHTML = '';
    filtered.forEach(f => {
      const row = document.createElement('div');
      row.className = 'igfr-follower' + (state.selected.has(f.username) ? ' selected' : '');
      row.dataset.username = f.username;

      const avatarHTML = f.avatar
        ? `<img class="igfr-avatar" src="${f.avatar}" alt="" onerror="this.style.display='none'">`
        : `<div class="igfr-avatar-placeholder">${(f.username[0] || '?').toUpperCase()}</div>`;

      // Badges
      const verifiedBadge = f.isVerified
        ? `<span class="igfr-badge igfr-badge-verified">✓</span>` : '';
      const followBadge = f.followsYouBack === false
        ? `<span class="igfr-badge igfr-badge-nonfollower">NFB</span>`
        : f.followsYouBack === true
          ? `<span class="igfr-badge igfr-badge-follower">FB</span>` : '';

      row.innerHTML = `
        <div class="igfr-check"></div>
        ${avatarHTML}
        <div class="igfr-info">
          <div class="igfr-username-row">
            <span class="igfr-username">@${f.username}</span>
            ${verifiedBadge}
          </div>
          ${f.fullname ? `<div class="igfr-fullname">${f.fullname}</div>` : ''}
        </div>
        <div class="igfr-badges-right">${followBadge}<div class="igfr-remove-badge">removing…</div></div>
      `;
      row.addEventListener('click', () => toggleSelect(f.username));
      elList.appendChild(row);
    });
    updateStats();
  }

  function toggleSelect(username) {
    if (state.selected.has(username)) state.selected.delete(username);
    else state.selected.add(username);
    const row = elList.querySelector(`[data-username="${username}"]`);
    if (row) row.classList.toggle('selected', state.selected.has(username));
    updateStats();
  }

  // ─── Detect verified badge from SVG in container ──────────────────────────────
  function detectVerified(container) {
    // Instagram verified SVGs have aria-label="Verified" or title "Verified"
    // or a specific path in the SVG tick shape
    const svgs = container.querySelectorAll('svg');
    for (const svg of svgs) {
      const label = (svg.getAttribute('aria-label') || '').toLowerCase();
      const title = (svg.querySelector('title')?.textContent || '').toLowerCase();
      if (label.includes('verif') || title.includes('verif')) return true;
      // IG verified checkmark path signature (blue tick)
      const paths = svg.querySelectorAll('path');
      for (const p of paths) {
        const d = p.getAttribute('d') || '';
        // Instagram's verified badge path starts with M19.998 or similar circle+check combo
        if (d.startsWith('M19.998') || d.includes('C22.208') || d.length > 200) return true;
      }
    }
    return false;
  }

  // ─── Detect if this user follows you back ────────────────────────────────────
  // From IG HTML: Follow button has class "_aswp" and text "Follow"
  // Following button has text "Following". Message button means you follow them.
  function detectFollowsBack(container) {
    // Check for the Follow button by IG class first (most reliable)
    const followBtn = container.querySelector('button._aswp, button._aswq');
    if (followBtn) {
      const text = (followBtn.innerText || followBtn.textContent || '').trim().toLowerCase();
      if (text === 'follow') return false;   // not following back
      if (text === 'following') return true; // following back
    }
    // Fallback: scan all buttons, skip the Remove button
    const allBtns = Array.from(container.querySelectorAll('button, [role="button"]'));
    for (const btn of allBtns) {
      const text = (btn.innerText || btn.textContent || '').trim().toLowerCase();
      if (text === 'remove') continue; // skip the Remove button
      if (text === 'following' || text === 'message') return true;
      if (text === 'follow') return false;
    }
    return null; // unknown
  }

  // ─── Scan for follower entries in the DOM ─────────────────────────────────────
  function scanFollowers() {
    const found = new Map();

    const allRemoveBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(el => {
      const text = (el.innerText || el.textContent || '').trim();
      if (text !== 'Remove') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    allRemoveBtns.forEach(btn => {
      let container = btn;
      for (let i = 0; i < 8; i++) {
        container = container.parentElement;
        if (!container) break;
        const links = container.querySelectorAll('a[href]');
        for (const link of links) {
          const href = link.getAttribute('href') || '';
          const match = href.match(/^\/([^/?#]+)\/?$/);
          if (match && match[1] && match[1] !== 'explore') {
            const username = match[1];
            if (!found.has(username)) {
              const img = container.querySelector('img[src]');
              const texts = Array.from(container.querySelectorAll('span, div'))
                .map(el => el.childElementCount === 0 ? el.textContent.trim() : '')
                .filter(t => t && t !== 'Remove' && t !== username);
              const fullname = texts.find(t => t.length > 0 && t !== '@' + username) || '';

              const isVerified   = detectVerified(container);
              const followsYouBack = detectFollowsBack(container);

              found.set(username, {
                username,
                fullname: fullname.length < 60 ? fullname : '',
                avatar: img ? img.src : '',
                isVerified,
                followsYouBack,
                el: btn,
              });
            }
            break;
          }
        }
      }
    });

    return Array.from(found.values());
  }

  function mergeFollowers(list) {
    let added = 0;
    list.forEach(f => {
      const existing = state.followers.find(x => x.username === f.username);
      if (!existing && !state.removed.has(f.username)) {
        state.followers.push(f);
        added++;
      } else if (existing) {
        // Refresh live data
        existing.el           = f.el;
        existing.isVerified   = f.isVerified;
        existing.followsYouBack = f.followsYouBack;
      }
    });
    return added;
  }

  function doScan() {
    if (state.scanning) return;
    state.scanning = true;
    elScanBtn.textContent = '⟳ Scanning…';
    elScanBtn.classList.add('active');
    elTitle.classList.add('scanning');
    elTitle.classList.remove('ready');

    const discovered = scanFollowers();
    mergeFollowers(discovered);

    // MutationObserver to catch lazily loaded followers
    if (state.scanObserver) state.scanObserver.disconnect();
    const root = document.querySelector('[role="dialog"]') || document.querySelector('main');
    if (root) {
      state.scanObserver = new MutationObserver(() => {
        const newOnes = scanFollowers();
        const added = mergeFollowers(newOnes);
        if (added > 0) {
          elStatFound.textContent = state.followers.filter(f => !state.removed.has(f.username)).length;
          renderList();
        }
      });
      state.scanObserver.observe(root, { childList: true, subtree: true });
    }

    state.scanning = false;
    elScanBtn.textContent = `⟳ Rescan (${state.followers.length})`;
    elScanBtn.classList.remove('active');
    elTitle.classList.remove('scanning');
    elTitle.classList.add('ready');

    renderList();
    updateStats();
  }

  // ─── React-compatible click ───────────────────────────────────────────────────
  function reactClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true };
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mouseenter', opts));
    el.dispatchEvent(new PointerEvent('pointerover', opts));
    el.dispatchEvent(new PointerEvent('pointerenter', opts));
    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1 }));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    el.click();
  }

  function findConfirmRemoveBtn(excludeEl) {
    const byClass = document.querySelector('button._a9--._ap36._a9-_');
    if (byClass && byClass !== excludeEl) {
      const rect = byClass.getBoundingClientRect();
      if (rect.width > 0) return byClass;
    }
    const all = Array.from(document.querySelectorAll('button, [role="button"]'));
    return all.find(el => {
      if (el === excludeEl) return false;
      const text = (el.innerText || el.textContent || '').trim();
      if (text !== 'Remove') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }) || null;
  }

  async function clickRemoveForUser(username) {
    const discovered = scanFollowers();
    const fresh = discovered.find(f => f.username === username);
    if (!fresh || !fresh.el) return false;

    const btn = fresh.el;
    if (!document.contains(btn)) return false;

    reactClick(btn);
    await sleep(800);

    for (let attempt = 0; attempt < 15; attempt++) {
      const confirmBtn = findConfirmRemoveBtn(btn);
      if (confirmBtn) {
        await sleep(150);
        reactClick(confirmBtn);
        await sleep(400);
        return true;
      }
      await sleep(200);
    }
    return true;
  }

  // ─── Remove loop ──────────────────────────────────────────────────────────────
  async function startRemoving() {
    if (state.running) {
      state.stopRequested = true;
      elRemoveBtn.textContent = 'Stopping…';
      return;
    }

    const toRemove = Array.from(state.selected).filter(u => !state.removed.has(u));
    if (toRemove.length === 0) return;

    state.running = true;
    state.stopRequested = false;
    elRemoveBtn.classList.add('running');
    elRemoveBtn.textContent = '■ Stop removing';
    elScanBtn.disabled = true;
    elSelectAll.disabled = true;

    const total = toRemove.length;
    let done = 0;

    for (const username of toRemove) {
      if (state.stopRequested) break;

      const row = elList.querySelector(`[data-username="${username}"]`);
      if (row) row.classList.add('igfr-removing');

      const ok = await clickRemoveForUser(username);

      if (ok) {
        state.removed.add(username);
        state.selected.delete(username);
        done++;
        const idx = state.followers.findIndex(f => f.username === username);
        if (idx !== -1) state.followers.splice(idx, 1);
        if (row) { row.classList.add('igfr-removed'); setTimeout(() => row.remove(), 400); }
      } else {
        if (row) row.classList.remove('igfr-removing');
      }

      elStatRem.textContent   = state.removed.size;
      elStatSel.textContent   = state.selected.size;
      elStatFound.textContent = state.followers.filter(f => !state.removed.has(f.username)).length;
      elProgressBar.style.width = `${(done / total) * 100}%`;
      updateStats();

      if (!state.stopRequested) await sleep(state.delayMs);
    }

    state.running = false;
    state.stopRequested = false;
    elRemoveBtn.classList.remove('running');
    elScanBtn.disabled = false;
    elSelectAll.disabled = false;
    elProgressBar.style.width = '0%';
    renderList();
    updateStats();
  }

  // ─── Events ───────────────────────────────────────────────────────────────────
  elClose.addEventListener('click', () => {
    panel.style.display = 'none';
    toggle.classList.remove('hidden');
  });

  toggle.addEventListener('click', () => {
    panel.style.display = 'flex';
    toggle.classList.add('hidden');
  });

  elScanBtn.addEventListener('click', doScan);

  elSelectAll.addEventListener('click', () => {
    const visible = getFilteredFollowers();
    const allSel = visible.every(f => state.selected.has(f.username));
    if (allSel) visible.forEach(f => state.selected.delete(f.username));
    else visible.forEach(f => state.selected.add(f.username));
    renderList();
    updateStats();
  });

  elSearch.addEventListener('input', () => { renderList(); updateStats(); });

  elFilterNonFollow.addEventListener('change', () => {
    state.filterNonFollowers = elFilterNonFollow.checked;
    $('igfr-chip-nonfollowers').classList.toggle('active', elFilterNonFollow.checked);
    // Auto-select all NFB accounts when filter is turned on
    if (elFilterNonFollow.checked) {
      state.followers
        .filter(f => !state.removed.has(f.username) && f.followsYouBack === false)
        .forEach(f => state.selected.add(f.username));
    }
    renderList(); updateStats();
  });

  elFilterVerified.addEventListener('change', () => {
    state.filterVerified = elFilterVerified.checked;
    $('igfr-chip-verified').classList.toggle('active', elFilterVerified.checked);
    renderList(); updateStats();
  });

  elSpeedSlider.addEventListener('input', () => {
    state.delayMs = parseInt(elSpeedSlider.value);
    elSpeedVal.textContent = (state.delayMs / 1000).toFixed(1) + 's';
  });

  elRemoveBtn.addEventListener('click', startRemoving);

  // ─── Drag ─────────────────────────────────────────────────────────────────────
  const header = $('igfr-header');
  let dragging = false, dragOffX = 0, dragOffY = 0;
  header.addEventListener('mousedown', e => {
    if (e.target.id === 'igfr-close') return;
    dragging = true;
    const rect = panel.getBoundingClientRect();
    dragOffX = e.clientX - rect.left;
    dragOffY = e.clientY - rect.top;
    panel.style.transform = 'none';
    panel.style.top  = rect.top + 'px';
    panel.style.right = 'auto';
    panel.style.left = rect.left + 'px';
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    panel.style.left = (e.clientX - dragOffX) + 'px';
    panel.style.top  = (e.clientY - dragOffY) + 'px';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ─── Auto-scan on dialog open ─────────────────────────────────────────────────
  const bodyObserver = new MutationObserver(() => {
    if (document.querySelectorAll('[role="dialog"]').length > 0 && !state.running) {
      setTimeout(() => {
        const newOnes = scanFollowers();
        if (newOnes.length > 0) {
          const added = mergeFollowers(newOnes);
          if (added > 0) { elTitle.classList.add('ready'); renderList(); updateStats(); }
        }
      }, 800);
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: false });

  setTimeout(doScan, 1200);
})();
