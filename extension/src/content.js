// CONTENT SCRIPT — chạy trên mọi trang
// Thêm logic tương tác trang web tại đây
// Giao tiếp với background: chrome.runtime.sendMessage(...)

(function () {
  'use strict';

  const TAG = '[EXT][content]';
  const PANEL_ID = '__ext_rule_collector_panel';
  const PAGE_SPACER_ID = '__ext_rule_collector_page_spacer';
  const INSPECTOR_HIGHLIGHT_ID = '__ext_rule_inspector_highlight';
  const ATTR_ALLOWLIST = new Set(['value', 'href', 'src', 'alt', 'title', 'aria-label', 'placeholder']);
  const ELEMENT_SUMMARY_LIMIT = 500;

  let isInspectorActive = false;
  let inspectorOverlay = null;
  let lastHoveredEl = null;

  function sendToBackground(action, payload = {}) {
    return chrome.runtime.sendMessage({ action, payload });
  }

  console.log(TAG, 'content script loaded on', location.hostname);

  function getCurrentDomain() {
    return location.hostname;
  }

  function isAllowedAttr(attr) {
    return ATTR_ALLOWLIST.has(attr) || /^data-[\w-]+$/.test(attr || '');
  }

  function readElementValue(el, row) {
    if (row.mode === 'text') return el.textContent || '';
    if (!isAllowedAttr(row.attr)) return null;
    if (row.attr === 'value') return 'value' in el ? el.value : el.getAttribute('value');
    return el.getAttribute(row.attr) || '';
  }

  function collectSelectors(config, source) {
    const fields = {};

    (config.selectors || []).forEach((row) => {
      const id = row.id || row.label || row.selector;
      try {
        const elements = [...document.querySelectorAll(row.selector || '')];
        const targets = row.multiple ? elements : elements.slice(0, 1);
        const values = targets
          .map((el) => readElementValue(el, row))
          .filter((value) => value !== null)
          .map((value) => row.trim === false ? String(value) : String(value).replace(/\s+/g, ' ').trim());

        fields[id] = {
          label: row.label || row.selector,
          selector: row.selector,
          mode: row.mode || 'text',
          attr: row.attr || null,
          values,
          count: values.length,
          error: elements.length === 0 ? 'not_found' : null
        };
      } catch (error) {
        fields[id] = {
          label: row.label || row.selector,
          selector: row.selector,
          mode: row.mode || 'text',
          attr: row.attr || null,
          values: [],
          count: 0,
          error: 'invalid_selector'
        };
      }
    });

    return {
      type: 'selectorCollection',
      domain: getCurrentDomain(),
      url: location.href,
      title: document.title,
      collectedAt: new Date().toISOString(),
      source,
      fields
    };
  }

  async function loadCollectorConfig() {
    try {
      return await sendToBackground('GET_SELECTOR_CONFIG_FOR_DOMAIN', { domain: getCurrentDomain() });
    } catch (error) {
      console.warn(TAG, 'collector config failed', error);
      return null;
    }
  }

  function getXPath(el) {
    if (el.id) return `//*[@id="${el.id}"]`;

    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let idx = 1;
      let sibling = current.previousElementSibling;
      while (sibling) {
        if (sibling.tagName === current.tagName) idx++;
        sibling = sibling.previousElementSibling;
      }
      parts.unshift(`${current.tagName.toLowerCase()}[${idx}]`);
      current = current.parentElement;
    }

    return `/${parts.join('/')}`;
  }

  function getCssSelector(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;

    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

    const classes = [...el.classList].slice(0, 2).map((name) => CSS.escape(name)).join('.');
    return classes ? `${el.tagName.toLowerCase()}.${classes}` : el.tagName.toLowerCase();
  }

  function isVisibleElement(el) {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function isSensitiveElement(el) {
    const sensitivePattern = /password|pass|token|secret|otp|2fa|mfa|auth|credential|api[_-]?key/i;
    const sensitiveText = [
      el.getAttribute('type'),
      el.id,
      el.getAttribute('name'),
      el.getAttribute('autocomplete'),
      el.getAttribute('aria-label'),
      el.getAttribute('placeholder'),
      el.labels?.[0]?.textContent
    ].filter(Boolean).join(' ');
    return sensitivePattern.test(sensitiveText);
  }

  function getElementLabel(el) {
    const text = el.textContent?.replace(/\s+/g, ' ').trim();
    return el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('title') ||
      el.labels?.[0]?.textContent?.replace(/\s+/g, ' ').trim() ||
      text?.slice(0, 120) ||
      el.value ||
      '';
  }

  function getElementKind(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'img') return 'image';
    if (['input', 'button', 'select', 'textarea'].includes(tag)) return tag;
    if (el.getAttribute('role') === 'button') return 'button';
    if (el.getAttribute('role') === 'link') return 'link';
    return 'text';
  }

  function getElementSearchText(el) {
    return [
      el.value,
      getElementLabel(el),
      el.innerText,
      el.textContent,
      el.getAttribute('name'),
      el.getAttribute('id'),
      el.getAttribute('data-testid')
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  function summarizeElement(el, idx) {
    const rect = el.getBoundingClientRect();
    return {
      idx,
      kind: getElementKind(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role'),
      type: el.getAttribute('type'),
      id: el.id || null,
      name: el.getAttribute('name') || null,
      label: getElementLabel(el),
      value: 'value' in el ? String(el.value || '').slice(0, 160) : null,
      href: el.href || null,
      testId: el.getAttribute('data-testid') || null,
      selector: getCssSelector(el),
      xpath: getXPath(el),
      pos: { x: Math.round(rect.x), y: Math.round(rect.y) }
    };
  }

  function collectPageElements() {
    const selectors = [
      'a', 'button', 'input', 'select', 'textarea', 'img',
      '[role="button"]', '[role="link"]', '[role="menuitem"]',
      '[role="tab"]', '[role="checkbox"]', '[role="radio"]',
      'h1', 'h2', 'h3', 'label', '[aria-label]', '[data-testid]'
    ];

    const seen = new WeakSet();
    const elements = [];

    document.querySelectorAll(selectors.join(',')).forEach((el, idx) => {
      if (elements.length >= ELEMENT_SUMMARY_LIMIT || seen.has(el) || !isVisibleElement(el) || isSensitiveElement(el)) return;
      seen.add(el);
      elements.push(summarizeElement(el, idx));
    });

    return {
      url: location.href,
      title: document.title,
      count: elements.length,
      truncated: elements.length >= ELEMENT_SUMMARY_LIMIT,
      elements
    };
  }

  function findElements({ kind = 'all', query = '', visibleOnly = true } = {}) {
    const candidates = kind === 'all' || kind === 'text' ? '*' : kind;
    const normalizedQuery = query.trim().toLowerCase();
    const results = [];

    document.querySelectorAll(candidates).forEach((el, idx) => {
      if (results.length >= 200 || isSensitiveElement(el)) return;
      if (visibleOnly && !isVisibleElement(el)) return;
      
      const elementKind = getElementKind(el);
      if (kind !== 'all' && elementKind !== kind) return;

      const haystack = getElementSearchText(el).toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) return;
      
      // Tránh lấy các wrapper quá to khi search text
      if (kind === 'text' && el.children.length > 3 && el.innerText.length > 500) return;

      results.push(summarizeElement(el, idx));
    });

    console.log(TAG, `Finder results for [${kind}] "${query}":`, results);
    return results;
  }

  function defaultConfig(config = {}) {
    return {
      domain: getCurrentDomain(),
      enabled: config.enabled ?? true,
      showFloatingButton: config.showFloatingButton ?? true,
      selectors: Array.isArray(config.selectors) ? config.selectors : [],
      guideRules: Array.isArray(config.guideRules) ? config.guideRules : [],
      traceLog: Array.isArray(config.traceLog) ? config.traceLog : [],
      dockPos: config.dockPos || 'bottom',
      isOpen: config.isOpen ?? true
    };
  }

  function shouldInjectPanel() {
    if (window.top !== window) return false;
    if (!document.documentElement) return false;
    return !/^(chrome|chrome-extension|edge|about|devtools):/.test(location.protocol);
  }

  function resetPageSpace() {
    document.getElementById(PAGE_SPACER_ID)?.remove();
    document.documentElement.style.removeProperty('--ext-rule-panel-height');
    document.documentElement.style.removeProperty('--ext-rule-panel-width');
    ['padding-bottom', 'padding-top', 'padding-left', 'padding-right'].forEach((p) => {
      document.documentElement.style.removeProperty(p);
      if (document.body) {
        document.body.style.removeProperty(p);
        const original = document.body.dataset[`extRuleOrig${p.replace('-', '')}`];
        if (original !== undefined) {
          document.body.style.setProperty(p, original);
        }
      }
    });
  }

  function reservePageSpace(host) {
    const update = () => {
      const panel = host.shadowRoot?.querySelector('.panel');
      if (!panel) return;
      
      const rect = panel.getBoundingClientRect();
      const dock = panel.dataset.dock || 'bottom';
      
      resetPageSpace(); // Clear old paddings before applying new ones

      if (dock === 'bottom' || dock === 'top') {
        const height = Math.ceil(rect.height + 12);
        const prop = `padding-${dock}`;
        document.documentElement.style.setProperty('--ext-rule-panel-height', `${height}px`);
        document.documentElement.style.setProperty(prop, 'var(--ext-rule-panel-height)', 'important');
        if (document.body) {
          const origKey = `extRuleOrigPadding${dock === 'bottom' ? 'Bottom' : 'Top'}`;
          if (document.body.dataset[origKey] === undefined) {
            document.body.dataset[origKey] = document.body.style.getPropertyValue(prop) || '';
          }
          document.body.style.setProperty(prop, 'var(--ext-rule-panel-height)', 'important');
        }
      } else {
        const width = Math.ceil(rect.width + 12);
        const prop = `padding-${dock}`;
        document.documentElement.style.setProperty('--ext-rule-panel-width', `${width}px`);
        document.documentElement.style.setProperty(prop, 'var(--ext-rule-panel-width)', 'important');
        if (document.body) {
          const origKey = `extRuleOrigPadding${dock === 'left' ? 'Left' : 'Right'}`;
          if (document.body.dataset[origKey] === undefined) {
            document.body.dataset[origKey] = document.body.style.getPropertyValue(prop) || '';
          }
          document.body.style.setProperty(prop, 'var(--ext-rule-panel-width)', 'important');
        }
      }
    };

    update();
    const observer = new ResizeObserver(update);
    const panelEl = host.shadowRoot?.querySelector('.panel');
    if (panelEl) observer.observe(panelEl);
    
    window.addEventListener('resize', update, { passive: true });
    setTimeout(update, 100);
  }

  function injectRulePanel(initialConfig) {
    if (!shouldInjectPanel()) return;
    document.getElementById(PANEL_ID)?.remove();
    resetPageSpace();

    let currentConfig = defaultConfig(initialConfig || {});
    const host = document.createElement('div');
    host.id = PANEL_ID;
    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      .panel { position: fixed; z-index: 2147483647; box-sizing: border-box; border: 1px solid rgba(99,102,241,.5); border-radius: 12px; background: #0f172a; color: #e5e7eb; font: 12px/1.4 system-ui, -apple-system, Segoe UI, sans-serif; box-shadow: 0 12px 48px rgba(0,0,0,.5); overflow: hidden; transition: all 0.2s ease-in-out; display: flex; flex-direction: column; }
      
      .panel.dock-bottom { left: 12px; right: 12px; bottom: 12px; max-height: 48vh; }
      .panel.dock-top { left: 12px; right: 12px; top: 12px; max-height: 48vh; }
      .panel.dock-left { left: 12px; top: 12px; bottom: 12px; width: 420px; max-width: 45vw; }
      .panel.dock-right { right: 12px; top: 12px; bottom: 12px; width: 420px; max-width: 45vw; }

      .panel:not(.open) { height: 42px !important; width: auto !important; max-height: 42px !important; border-color: rgba(99,102,241,.3); }
      .panel:not(.open).dock-left, .panel:not(.open).dock-right { bottom: auto; }

      .bar { display: flex; gap: 6px; align-items: center; padding: 8px 12px; border-bottom: 1px solid rgba(148,163,184,.15); background: rgba(30,41,59,.5); backdrop-filter: blur(8px); flex-shrink: 0; }
      .title { font-weight: 700; margin-right: auto; white-space: nowrap; color: #818cf8; overflow: hidden; text-overflow: ellipsis; }
      
      .dock-select { background: #1e293b; border: 1px solid rgba(148,163,184,.3); color: #94a3b8; border-radius: 6px; padding: 2px 4px; font-size: 10px; cursor: pointer; }
      
      button { border: 1px solid rgba(148,163,184,.3); border-radius: 8px; background: #1e293b; color: #e5e7eb; cursor: pointer; padding: 6px 10px; font: inherit; transition: all 0.15s; white-space: nowrap; }
      button:hover { background: #334155; border-color: rgba(148,163,184,.5); }
      .primary { background: #4f46e5; border-color: #6366f1; color: white; }
      
      .body { display: none; grid-template-columns: minmax(300px, 1fr) minmax(340px, 1.2fr); gap: 12px; padding: 12px; flex: 1; overflow: hidden; }
      .panel.dock-left .body, .panel.dock-right .body { grid-template-columns: 1fr; overflow-y: auto; }
      .panel.open .body { display: grid; }
      .panel.dock-left.open .body, .panel.dock-right.open .body { display: flex; flex-direction: column; }
      textarea, pre, input, select { box-sizing: border-box; width: 100%; margin: 0; border: 1px solid rgba(148,163,184,.2); border-radius: 8px; background: #020617; color: #d1d5db; font: 12px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; padding: 8px 10px; outline: none; }
      textarea:focus, input:focus, select:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,.2); }
      textarea, pre { height: 100%; min-height: 200px; max-height: 34vh; overflow: auto; }
      textarea { resize: vertical; }
      label { display: grid; gap: 4px; margin-bottom: 4px; color: #94a3b8; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .finder-controls, .builder-actions { display: grid; grid-template-columns: 100px 1fr 80px 80px; gap: 6px; margin-bottom: 8px; }
      .results { display: flex; flex-direction: column; gap: 8px; max-height: 28vh; overflow-y: auto; padding-right: 4px; }
      .result { border: 1px solid rgba(148,163,184,.15); border-radius: 8px; padding: 10px; background: rgba(30,41,59,.4); }
      .result-title { color: #818cf8; font-weight: 600; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .result-code { color: #10b981; font: 11px ui-monospace, Consolas, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px; cursor: pointer; }
      .result-code:hover { color: #34d399; text-decoration: underline; }
      .mini-actions { display: flex; gap: 6px; margin-top: 8px; }
      .mini-actions button { padding: 4px 8px; font-size: 10px; background: transparent; }
      .status { color: #6366f1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 30vw; }
      .active-tab-btn { background: #4f46e5 !important; border-color: #818cf8 !important; }
      
      /* Scrollbar */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(148,163,184,.2); border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,.4); }

      @media (max-width: 800px) { 
        .body { grid-template-columns: 1fr; } 
        .panel.open { max-height: 80vh; }
        .status { display: none; }
      }
      #${INSPECTOR_HIGHLIGHT_ID} { box-shadow: 0 0 0 9999px rgba(0,0,0,0.2); }
      .result:hover { border-color: #6366f1; background: rgba(30,41,59,.6); }
      .result-code:active { color: #6366f1; }
    `;

    const panel = document.createElement('section');
    panel.className = `panel ${currentConfig.isOpen ? 'open' : ''} dock-${currentConfig.dockPos || 'bottom'}`;
    panel.dataset.dock = currentConfig.dockPos || 'bottom';
    panel.innerHTML = `
      <div class="bar">
        <span class="title">Rule · ${getCurrentDomain()}</span>
        <button type="button" data-action="cycle-dock">Dock: ${(currentConfig.dockPos || 'bottom').charAt(0).toUpperCase() + (currentConfig.dockPos || 'bottom').slice(1)}</button>
        <span class="status" data-role="status">Ready</span>
        <button type="button" data-action="load">Load</button>
        <button type="button" data-action="save">Save</button>
        <button type="button" class="primary" data-action="dry-run">Dry-run</button>
        <button type="button" data-action="view">View</button>
        <button type="button" data-action="copy">Copy All</button>
        <button type="button" data-action="trace">Trace</button>
        <button type="button" data-action="guide">Guide</button>
      </div>
      <div class="body">
        <div>
          <div class="tabs">
            <button type="button" data-tab="json" class="active-tab-btn">Rule JSON</button>
            <button type="button" data-tab="finder">Finder</button>
            <button type="button" data-tab="builder">Builder</button>
          </div>
          <div class="tab active" data-panel="json">
            <textarea spellcheck="false" data-role="config"></textarea>
          </div>
          <div class="tab" data-panel="finder">
            <div class="finder-controls">
              <select data-role="finder-kind">
                <option value="all">all</option>
                <option value="input">input</option>
                <option value="button">button</option>
                <option value="select">select</option>
                <option value="textarea">textarea</option>
                <option value="link">link</option>
                <option value="image">image</option>
                <option value="text">text</option>
              </select>
              <input data-role="finder-query" placeholder="Text/value/placeholder/id...">
              <button type="button" class="primary" data-action="find">Find</button>
              <button type="button" data-action="inspect">Pick</button>
            </div>
            <div class="results" data-role="finder-results"></div>
          </div>
          <div class="tab" data-panel="builder">
            <div class="row">
              <label>Label/key <input data-role="builder-label" placeholder="emailInput"></label>
              <label>Mode <select data-role="builder-mode"><option value="text">text</option><option value="attr">attr</option></select></label>
            </div>
            <label>CSS selector <input data-role="builder-selector" placeholder="#email"></label>
            <div class="row">
              <label>Attr <select data-role="builder-attr"><option value="">-</option><option value="value">value</option><option value="href">href</option><option value="src">src</option><option value="alt">alt</option><option value="title">title</option><option value="aria-label">aria-label</option></select></label>
              <label>Multiple <select data-role="builder-multiple"><option value="false">false</option><option value="true">true</option></select></label>
            </div>
            <div class="builder-actions">
              <button type="button" class="primary" data-action="add-rule-row">Add to JSON</button>
              <button type="button" data-action="inspect">Pick from page</button>
              <button type="button" data-action="save">Save JSON</button>
              <button type="button" data-action="dry-run">Dry-run</button>
            </div>
          </div>
        </div>
        <pre data-role="output">Chưa chạy.</pre>
      </div>
    `;

    const textarea = panel.querySelector('[data-role="config"]');
    const output = panel.querySelector('[data-role="output"]');
    const status = panel.querySelector('[data-role="status"]');
    const finderResults = panel.querySelector('[data-role="finder-results"]');
    const builderLabel = panel.querySelector('[data-role="builder-label"]');
    const builderSelector = panel.querySelector('[data-role="builder-selector"]');
    const builderMode = panel.querySelector('[data-role="builder-mode"]');
    const builderAttr = panel.querySelector('[data-role="builder-attr"]');
    const builderMultiple = panel.querySelector('[data-role="builder-multiple"]');
    const dockButton = panel.querySelector('[data-action="cycle-dock"]');

    function setStatus(message) {
      status.textContent = message;
    }

    function cycleDockPos() {
      const order = ['bottom', 'left', 'top', 'right'];
      const current = panel.dataset.dock || 'bottom';
      const next = order[(order.indexOf(current) + 1) % order.length];
      
      panel.classList.remove('dock-bottom', 'dock-top', 'dock-left', 'dock-right');
      panel.classList.add(`dock-${next}`);
      panel.dataset.dock = next;
      currentConfig.dockPos = next;
      saveConfig(currentConfig);
      
      dockButton.textContent = `Dock: ${next.charAt(0).toUpperCase() + next.slice(1)}`;
      setStatus(`Docked to ${next}`);
    }

    function renderConfig() {
      textarea.value = JSON.stringify(currentConfig, null, 2);
    }

    function readConfigFromTextarea() {
      const parsed = JSON.parse(textarea.value || '{}');
      currentConfig = defaultConfig({ ...parsed, domain: getCurrentDomain() });
      return currentConfig;
    }

    async function saveConfig(config = currentConfig) {
      currentConfig = defaultConfig(config);
      const saved = await sendToBackground('SAVE_SELECTOR_CONFIG', { domain: getCurrentDomain(), config: currentConfig });
      currentConfig = defaultConfig(saved || currentConfig);
      renderConfig();
      return currentConfig;
    }

    async function appendTrace(action, ok, summary) {
      const entry = { action, at: new Date().toISOString(), ok, summary };
      currentConfig.traceLog = [entry, ...(currentConfig.traceLog || [])].slice(0, 50);
      await saveConfig(currentConfig);
      output.textContent = JSON.stringify({ latest: entry, traceLog: currentConfig.traceLog }, null, 2);
      return entry;
    }

    async function loadRule() {
      currentConfig = defaultConfig(await loadCollectorConfig());
      renderConfig();
      output.textContent = JSON.stringify(currentConfig, null, 2);
      setStatus('Loaded rule');
      await appendTrace('load', true, `${currentConfig.selectors.length} selectors`);
    }

    async function saveRule() {
      readConfigFromTextarea();
      await saveConfig(currentConfig);
      output.textContent = JSON.stringify({ ok: true, saved: currentConfig }, null, 2);
      setStatus('Saved rule');
      await appendTrace('save', true, `${currentConfig.selectors.length} selectors`);
    }

    async function dryRunRule() {
      readConfigFromTextarea();
      const result = collectSelectors(currentConfig, 'rule-panel-dry-run');
      output.textContent = JSON.stringify(result, null, 2);
      setStatus('Dry-run done');
      await appendTrace('dry-run', true, `${Object.keys(result.fields).length} fields`);
    }

    async function copyElements() {
      const summary = collectPageElements();
      const text = JSON.stringify(summary, null, 2);
      await navigator.clipboard.writeText(text);
      output.textContent = text;
      setStatus(`Copied ${summary.count} elements`);
      await appendTrace('copy-elements', true, `${summary.count} elements${summary.truncated ? ' truncated' : ''}`);
    }

    async function traceLogRule() {
      readConfigFromTextarea();
      await appendTrace('trace', true, `${currentConfig.traceLog.length} entries`);
      setStatus('Trace updated');
    }

    async function copyText(text, label) {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${label}`);
    }

    function useElementInBuilder(item) {
      builderLabel.value = item.label || item.name || item.id || `${item.kind}_${Math.floor(Math.random()*1000)}`;
      builderSelector.value = item.selector;
      builderMode.value = item.value || item.kind === 'input' ? 'attr' : 'text';
      builderAttr.value = item.value || item.kind === 'input' ? 'value' : '';
      builderMultiple.value = 'false';
      
      // Chuyển sang tab Builder
      panel.querySelectorAll('[data-tab]').forEach((btn) => btn.classList.toggle('active-tab-btn', btn.dataset.tab === 'builder'));
      panel.querySelectorAll('[data-panel]').forEach((section) => section.classList.toggle('active', section.dataset.panel === 'builder'));
      
      setStatus('Element loaded into builder');
    }

    function renderFinderResults(results) {
      finderResults.textContent = '';
      if (!results.length) {
        finderResults.textContent = 'Không tìm thấy element phù hợp.';
        return;
      }

      results.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'result';

        const title = document.createElement('div');
        title.className = 'result-title';
        title.textContent = `${item.kind} · ${item.label || item.value || item.name || item.id || '-'}`;

        const selector = document.createElement('div');
        selector.className = 'result-code';
        selector.textContent = `selector: ${item.selector}`;

        const xpath = document.createElement('div');
        xpath.className = 'result-code';
        xpath.textContent = `xpath: ${item.xpath}`;

        const actions = document.createElement('div');
        actions.className = 'mini-actions';
        [
          ['Copy selector', () => copyText(item.selector, 'selector')],
          ['Copy xpath', () => copyText(item.xpath, 'xpath')],
          ['Use in builder', () => useElementInBuilder(item)]
        ].forEach(([text, handler]) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = text;
          button.addEventListener('click', handler);
          actions.appendChild(button);
        });

        const onHover = (isHover) => {
          if (!inspectorOverlay) {
            inspectorOverlay = document.createElement('div');
            inspectorOverlay.id = INSPECTOR_HIGHLIGHT_ID;
            inspectorOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;background:rgba(99,102,241,0.3);border:2px solid #6366f1;transition:all 0.1s;display:none;border-radius:4px;';
            document.body.appendChild(inspectorOverlay);
          }
          if (isHover) {
            const el = document.querySelectorAll(item.selector)[0] || document.evaluate(item.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (el && el.getBoundingClientRect) {
              const rect = el.getBoundingClientRect();
              inspectorOverlay.style.display = 'block';
              inspectorOverlay.style.top = `${rect.top}px`;
              inspectorOverlay.style.left = `${rect.left}px`;
              inspectorOverlay.style.width = `${rect.width}px`;
              inspectorOverlay.style.height = `${rect.height}px`;
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          } else {
            inspectorOverlay.style.display = 'none';
          }
        };

        row.addEventListener('mouseenter', () => onHover(true));
        row.addEventListener('mouseleave', () => onHover(false));

        row.append(title, selector, xpath, actions);
        finderResults.appendChild(row);
      });
      finderResults.scrollTop = 0;
    }

    async function runFinder() {
      const kind = panel.querySelector('[data-role="finder-kind"]').value;
      const query = panel.querySelector('[data-role="finder-query"]').value;
      const results = findElements({ kind, query, visibleOnly: true });
      renderFinderResults(results);
      output.textContent = JSON.stringify({ count: results.length, results }, null, 2);
      setStatus(`Found ${results.length} elements`);
      await appendTrace('find-elements', true, `${kind} · ${query || '*'} · ${results.length}`);
    }

    function addRuleRowFromBuilder() {
      readConfigFromTextarea();
      const selector = builderSelector.value.trim();
      const label = builderLabel.value.trim() || selector;
      if (!selector) throw new Error('Builder cần CSS selector.');

      currentConfig.selectors = [...(currentConfig.selectors || []), {
        id: crypto.randomUUID(),
        label,
        selector,
        mode: builderMode.value,
        attr: builderAttr.value || null,
        multiple: builderMultiple.value === 'true',
        trim: true
      }];
      renderConfig();
      output.textContent = JSON.stringify({ ok: true, added: currentConfig.selectors.at(-1), selectors: currentConfig.selectors }, null, 2);
      setStatus('Added selector to rule JSON');
    }

    function openGuide() {
      window.open(chrome.runtime.getURL('src/rule-guide/rule-guide.html'), '_blank', 'noopener');
      setStatus('Opened guide');
    }

    function toggleInspector() {
      isInspectorActive = !isInspectorActive;
      if (isInspectorActive) {
        startInspector();
      } else {
        stopInspector();
      }
    }

    function startInspector() {
      setStatus('Inspector Active: Hover & Click element on page');
      panel.classList.remove('open'); // Đóng panel để dễ nhìn
      
      if (!inspectorOverlay) {
        inspectorOverlay = document.createElement('div');
        inspectorOverlay.id = INSPECTOR_HIGHLIGHT_ID;
        inspectorOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;background:rgba(99,102,241,0.3);border:2px solid #6366f1;transition:all 0.1s;display:none;border-radius:4px;';
        document.body.appendChild(inspectorOverlay);
      }

      const onMouseMove = (e) => {
        if (!isInspectorActive) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.closest(`#${PANEL_ID}`)) {
          inspectorOverlay.style.display = 'none';
          return;
        }
        
        lastHoveredEl = el;
        const rect = el.getBoundingClientRect();
        inspectorOverlay.style.display = 'block';
        inspectorOverlay.style.top = `${rect.top}px`;
        inspectorOverlay.style.left = `${rect.left}px`;
        inspectorOverlay.style.width = `${rect.width}px`;
        inspectorOverlay.style.height = `${rect.height}px`;
      };

      const onClick = (e) => {
        if (!isInspectorActive) return;
        e.preventDefault();
        e.stopPropagation();
        
        if (lastHoveredEl) {
          const info = summarizeElement(lastHoveredEl, 0);
          useElementInBuilder(info);
          stopInspector();
          panel.classList.add('open');
        }
      };

      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('click', onClick, true);
      
      inspectorOverlay._cleanup = () => {
        document.removeEventListener('mousemove', onMouseMove, true);
        document.removeEventListener('click', onClick, true);
      };
    }

    function stopInspector() {
      isInspectorActive = false;
      if (inspectorOverlay) {
        inspectorOverlay.style.display = 'none';
        if (inspectorOverlay._cleanup) inspectorOverlay._cleanup();
      }
      setStatus('Inspector disabled');
    }

    panel.addEventListener('click', async (event) => {
      const tab = event.target?.dataset?.tab;
      if (tab) {
        panel.querySelectorAll('[data-tab]').forEach((btn) => btn.classList.toggle('active-tab-btn', btn.dataset.tab === tab));
        panel.querySelectorAll('[data-panel]').forEach((section) => section.classList.toggle('active', section.dataset.panel === tab));
        return;
      }

      const action = event.target?.dataset?.action;
      if (!action) return;

      try {
        if (action === 'view') {
          panel.classList.toggle('open');
          const isOpen = panel.classList.contains('open');
          currentConfig.isOpen = isOpen;
          saveConfig(currentConfig); // Persist state
          setStatus(isOpen ? 'Panel opened' : 'Panel collapsed');
          return;
        }
        setStatus('Working...');
        if (action === 'load') await loadRule();
        if (action === 'save') await saveRule();
        if (action === 'dry-run') await dryRunRule();
        if (action === 'copy') await copyElements();
        if (action === 'trace') await traceLogRule();
        if (action === 'find') await runFinder();
        if (action === 'inspect') toggleInspector();
        if (action === 'cycle-dock') cycleDockPos();
        if (action === 'add-rule-row') addRuleRowFromBuilder();
        if (action === 'guide') openGuide();
      } catch (error) {
        const message = error?.message || String(error);
        output.textContent = JSON.stringify({ ok: false, error: message }, null, 2);
        setStatus(message);
        try { await appendTrace(action, false, message); } catch (_) {}
      }
    });

    renderConfig();
    shadow.append(style, panel);
    document.documentElement.appendChild(host);
    reservePageSpace(host);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== 'COLLECT_SELECTORS_ON_PAGE') return false;
    const payload = collectSelectors(message.payload?.config || {}, message.payload?.source || 'popup');
    sendResponse({ ok: true, payload });
    return true;
  });

  loadCollectorConfig().then(injectRulePanel);
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes['selectorCollector:configs:v1']) return;
    const config = changes['selectorCollector:configs:v1'].newValue?.[getCurrentDomain()];
    injectRulePanel(config);
  });

  if (location.hostname === 'accounts.google.com' && location.pathname.includes('/SignOutOptions')) {
    const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig;

    function uniqueAccounts(accounts) {
      const seen = new Set();
      return accounts.filter((account) => {
        if (!account?.email) return false;
        const key = account.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function getImageUrl(el) {
      const img = el.querySelector('img.account-image[src], img[src]');
      if (img?.getAttribute('src')) return img.getAttribute('src');
      if (img?.currentSrc || img?.src) return img.currentSrc || img.src;

      const imageEl = el.querySelector('[style*="background-image"], [data-profile-picture], [data-photo-url]');
      const attrUrl = imageEl?.getAttribute('data-profile-picture') || imageEl?.getAttribute('data-photo-url');
      if (attrUrl) return attrUrl;

      const backgroundImage = imageEl ? getComputedStyle(imageEl).backgroundImage : '';
      const match = backgroundImage.match(/url\(["']?([^"')]+)["']?\)/);
      return match?.[1] || '';
    }

    function parseAccountElement(el) {
      const normalized = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!normalized) return null;

      const emailFromField = el.value || el.querySelector('.account-email')?.textContent || '';
      const emails = emailFromField.match(emailRegex) || normalized.match(emailRegex) || [];
      if (emails.length === 0) return null;

      const email = emails[0];
      const name = el.querySelector('.account-name')?.textContent?.replace(/\s+/g, ' ').trim() || normalized.replace(email, '').trim() || email;
      return { email, name, imageUrl: getImageUrl(el) };
    }

    function extractAccounts() {
      const fromDataset = [...document.querySelectorAll('[data-email]')].map((el) => ({
        email: el.getAttribute('data-email'),
        name: el.getAttribute('data-name') ?? el.textContent.replace(/\s+/g, ' ').trim(),
        imageUrl: getImageUrl(el)
      }));

      const fromButtons = [...document.querySelectorAll('button[id^="choose-account-"], [role="button"][id^="choose-account-"]')]
        .map(parseAccountElement)
        .filter(Boolean);

      const fromPageText = (document.body.innerText.match(emailRegex) || []).map((email) => ({
        email,
        name: email
      }));

      const accounts = uniqueAccounts([...fromDataset, ...fromButtons, ...fromPageText]);

      if (accounts.length > 0) {
        chrome.runtime.sendMessage({ type: 'ACCOUNTS_RESULT', accounts });
      }
    }

    extractAccounts();
    setTimeout(extractAccounts, 1000);
    setTimeout(extractAccounts, 3000);
  }
})();
