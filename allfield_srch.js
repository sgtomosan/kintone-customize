(function () {
  'use strict';
  // いろいろな項目を検索できるような窓を勝手に追加（フィールド選択可能）
  // モーダルを表示してプリセットの保存が可能

  console.log('検索UI 真・最終完全版');

  const APP_ID = kintone.app.getId();

  const INPUT_ID = 'ALLSearchInput';
  const FIELD_STORAGE_KEY = 'SEARCH_TARGET_FIELDS_' + APP_ID;
  const PRESET_STORAGE_KEY = 'SEARCH_PRESETS_' + APP_ID;
  const MODE_STORAGE_KEY = 'SEARCH_MODE_' + APP_ID;
  const MODAL_POS_KEY = 'SEARCH_MODAL_POS_' + APP_ID;
  const HISTORY_KEY = 'SEARCH_HISTORY_' + APP_ID;
  const LAST_WORD_KEY = 'LAST_SEARCH_WORD_' + APP_ID;

  const MAX_HISTORY = 20;

  const FIELD_KEYWORDS = ['_', '検索', '品', '名', '番号', 'CD', 'KEY', 'ｺｰﾄﾞ', '備考', 'MEMO', 'メモ'];

  let ALL_FIELDS = [];
  let SELECTED_FIELDS = [];

  /* =========================
   * 共通
   * ========================= */
  function normalize(str) {
    return str.replace(/ /g, ' ').trim();
  }

  function isDefaultChecked(field) {
    const name = field.label || '';
    const code = field.code || '';
    return FIELD_KEYWORDS.some(k => name.includes(k) || code.includes(k));
  }

  function getViewId() {
    const params = new URLSearchParams(location.search);
    return params.get('view') || '';
  }

  async function getFields() {
    const resp = await kintone.api(
      kintone.api.url('/k/v1/app/form/fields.json', true),
      'GET',
      { app: APP_ID }
    );

    return Object.values(resp.properties)
      .filter(f =>
        ['SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT', 'RICH_TEXT', 'LINK'].includes(f.type)
      );
  }

  function shouldFocus() {
    const params = new URLSearchParams(location.search);
    return params.get('focusK') === '1';
  }

  /* =========================
   * モーダル
   * ========================= */
  function createModal() {
    const modal = document.createElement('div');
    const savedPos = JSON.parse(localStorage.getItem(MODAL_POS_KEY) || 'null');

    Object.assign(modal.style, {
      position: 'fixed',
      top: savedPos ? savedPos.top : '100px',
      left: savedPos ? savedPos.left : '100px',
      width: '440px',
      background: '#fff',
      border: '1px solid #ccc',
      zIndex: 9999,
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    });

    // ===== ヘッダー =====
    const header = document.createElement('div');
    header.textContent = '検索設定';

    Object.assign(header.style, {
      padding: '6px 10px',
      background: '#eee',
      cursor: 'move',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontWeight: 'bold',
      fontSize: '13px'
    });

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.fontSize = '16px';

    closeBtn.onclick = () => modal.style.display = 'none';

    header.appendChild(closeBtn);
    modal.appendChild(header);

    // ===== 本体 =====
    const body = document.createElement('div');
    body.style.padding = '10px';
    body.style.maxHeight = '450px';
    body.style.overflow = 'auto';

    modal.appendChild(body);

    // ===== ドラッグ =====
    let isDragging = false, offsetX, offsetY;

    header.onmousedown = (e) => {
      isDragging = true;
      offsetX = e.clientX - modal.offsetLeft;
      offsetY = e.clientY - modal.offsetTop;
    };

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        modal.style.left = (e.clientX - offsetX) + 'px';
        modal.style.top = (e.clientY - offsetY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        localStorage.setItem(MODAL_POS_KEY, JSON.stringify({
          top: modal.style.top,
          left: modal.style.left
        }));
      }
    });

    // ===== ESCで閉じる =====
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') modal.style.display = 'none';
    });

    document.body.appendChild(modal);

    return body;
  }

  function getHistory() {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  }

  function saveHistory(word) {
    let history = getHistory();
    history = history.filter(h => h !== word);
    history.unshift(word);

    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  /* =========================
   * サジェスト
   * ========================= */
  function createSuggestBox(input, searchFunc) {
    const box = document.createElement('div');

    Object.assign(box.style, {
      position: 'absolute',
      background: '#fff',
      border: '1px solid #ccc',
      zIndex: 9999,
      maxHeight: '200px',
      overflowY: 'auto',
      display: 'none'
    });

    document.body.appendChild(box);

    let selectedIndex = -1;

    function render(keyword = '') {
      const list = getHistory().filter(h =>
        h.toLowerCase().includes(keyword.toLowerCase())
      );

      box.innerHTML = '';
      selectedIndex = -1;

      list.forEach((item, i) => {
        const div = document.createElement('div');
        div.textContent = item;
        div.style.padding = '5px';

        div.onmouseover = () => highlight(i);
        div.onclick = () => {
          input.value = item;
          searchFunc(item);
        };

        box.appendChild(div);
      });

      box.style.display = list.length ? 'block' : 'none';
    }

    function highlight(index) {
      const children = box.children;
      Array.from(children).forEach(c => c.style.background = '');

      if (children[index]) {
        children[index].style.background = '#eee';
        selectedIndex = index;
      }
    }

    input.addEventListener('input', () => {
      const rect = input.getBoundingClientRect();
      box.style.left = rect.left + 'px';
      box.style.top = rect.bottom + 'px';
      box.style.width = rect.width + 'px';
      render(input.value);
    });

    input.addEventListener('keydown', (e) => {
      const items = box.children;

      if (e.key === 'ArrowDown') {
        selectedIndex++;
        if (selectedIndex >= items.length) selectedIndex = 0;
        highlight(selectedIndex);
        e.preventDefault();
      }

      if (e.key === 'ArrowUp') {
        selectedIndex--;
        if (selectedIndex < 0) selectedIndex = items.length - 1;
        highlight(selectedIndex);
        e.preventDefault();
      }

      if (e.key === 'Enter') {
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const val = items[selectedIndex].textContent;
          input.value = val;
          searchFunc(val);
        } else {
          searchFunc(input.value);
        }
        e.preventDefault();
      }
    });

    document.addEventListener('click', (e) => {
      if (!box.contains(e.target) && e.target !== input) {
        box.style.display = 'none';
      }
    });
  }

  /* =========================
   * UI構築
   * ========================= */
  function createUI(space) {
    const input = document.createElement('input');
    input.id = INPUT_ID;
    input.className = 'gaia-ui-input';
    input.placeholder = '検索（Enter）';
    input.style.height = '44px';

    const btnOpen = createButton('検索設定');

    space.appendChild(input);
    space.appendChild(btnOpen);

    const search = (word) => {
      const raw = normalize(word);
      const viewId = getViewId();

      // 空検索：絞り込みリセット
      if (!raw) {
        input.value = '';
        localStorage.removeItem(LAST_WORD_KEY);

        const url =
          `${location.pathname}?` +
          (viewId ? `view=${viewId}&` : '') +
          `query=`;

        location.href = url;
        return;
      }

      // 通常検索
      saveHistory(raw);
      localStorage.setItem(LAST_WORD_KEY, raw);

      const safe = raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const mode = localStorage.getItem(MODE_STORAGE_KEY) || 'OR';

      const query = SELECTED_FIELDS
        .map(f => `${f} like "${safe}"`)
        .join(mode === 'AND' ? ' and ' : ' or ');

      const url =
        `${location.pathname}?` +
        (viewId ? `view=${viewId}&` : '') +
        `query=${encodeURIComponent(query)}`;

      location.href = url;
    };

    createSuggestBox(input, search);

    // ===== モーダル内要素 =====
    const modalBody = createModal();
    modalBody.parentNode.style.display = 'none';

    btnOpen.onclick = () => {
      const modal = modalBody.parentNode;
      modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    };

    // --- 1行目: AND/OR 条件設定エリア ---
    const modeSettingArea = document.createElement('div');
    modeSettingArea.style.marginBottom = '8px';
    modeSettingArea.style.display = 'flex';
    modeSettingArea.style.alignItems = 'center';
    modeSettingArea.style.gap = '8px';

    const modeLabel = document.createElement('span');
    modeLabel.textContent = '検索条件:';
    modeLabel.style.fontSize = '12px';
    modeLabel.style.fontWeight = 'bold';

    const modeToggle = document.createElement('select');
    modeToggle.className = 'gaia-ui-input';
    modeToggle.style.height = '30px';
    [['OR', 'OR検索（いずれかに一致）'], ['AND', 'AND検索（すべてに一致）']].forEach(([m, text]) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = text;
      modeToggle.appendChild(opt);
    });

    // デフォルトは OR
    modeToggle.value = localStorage.getItem(MODE_STORAGE_KEY) || 'OR';
    modeToggle.onchange = () => {
      localStorage.setItem(MODE_STORAGE_KEY, modeToggle.value);
    };

    modeSettingArea.appendChild(modeLabel);
    modeSettingArea.appendChild(modeToggle);

    // --- 2行目: プリセット選択（左） + フィールド絞り込み入力（右） ---
    const topControlRow = document.createElement('div');
    topControlRow.style.display = 'flex';
    topControlRow.style.gap = '6px';
    topControlRow.style.marginBottom = '8px';

    const presetSelect = document.createElement('select');
    presetSelect.className = 'gaia-ui-input';
    presetSelect.style.flex = '1';
    presetSelect.style.height = '34px';

    const filterInput = document.createElement('input');
    filterInput.placeholder = 'フィールド検索';
    filterInput.className = 'gaia-ui-input';
    filterInput.style.flex = '1';
    filterInput.style.height = '34px';

    topControlRow.appendChild(presetSelect);
    topControlRow.appendChild(filterInput);

    // --- 3行目: 操作ボタン群 ---
    const btnRow = document.createElement('div');
    btnRow.style.marginBottom = '8px';

    const btnAll = createButton('全選択');
    const btnNone = createButton('全解除');
    const btnReset = createButton('初期状態');
    const btnSavePreset = createButton('保存');
    const btnDeletePreset = createButton('削除');

    btnRow.appendChild(btnAll);
    btnRow.appendChild(btnNone);
    btnRow.appendChild(btnReset);
    btnRow.appendChild(btnSavePreset);
    btnRow.appendChild(btnDeletePreset);

    // --- フィールドリスト表示部 ---
    const listArea = document.createElement('div');
    listArea.style.border = '1px solid #ddd';
    listArea.style.padding = '6px';
    listArea.style.maxHeight = '280px';
    listArea.style.overflowY = 'auto';

    function renderList(filter = '') {
      listArea.innerHTML = '';

      ALL_FIELDS
        .filter(f => f.label.includes(filter))
        .forEach(f => {
          const label = document.createElement('label');
          label.style.display = 'block';
          label.style.margin = '3px 0';
          label.style.cursor = 'pointer';

          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = f.code;
          cb.checked = SELECTED_FIELDS.includes(f.code);
          cb.onchange = updateSelectedFields;

          label.appendChild(cb);
          label.appendChild(document.createTextNode(' ' + f.label));
          listArea.appendChild(label);
        });
    }

    filterInput.oninput = () => renderList(filterInput.value);

    function saveFields() {
      localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(SELECTED_FIELDS));
    }

    function updateSelectedFields() {
      const checks = listArea.querySelectorAll('input:checked');
      SELECTED_FIELDS = Array.from(checks).map(cb => cb.value);
      saveFields();
    }

    function initSelected() {
      const saved = JSON.parse(localStorage.getItem(FIELD_STORAGE_KEY) || 'null');
      if (saved === null) {
        SELECTED_FIELDS = ALL_FIELDS
          .filter(f => isDefaultChecked(f))
          .map(f => f.code);
      } else {
        SELECTED_FIELDS = saved;
      }
    }

    btnAll.onclick = () => {
      SELECTED_FIELDS = ALL_FIELDS.map(f => f.code);
      saveFields();
      renderList(filterInput.value);
    };

    btnNone.onclick = () => {
      SELECTED_FIELDS = [];
      saveFields();
      renderList(filterInput.value);
    };

    btnReset.onclick = () => {
      SELECTED_FIELDS = ALL_FIELDS
        .filter(f => isDefaultChecked(f))
        .map(f => f.code);
      saveFields();
      renderList(filterInput.value);
    };

    // プリセット保存時、選択中のプリセット名を初期表示
    btnSavePreset.onclick = () => {
      const defaultName = presetSelect.value || '';
      const name = prompt('プリセット名', defaultName);
      if (!name) return;

      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      presets[name] = SELECTED_FIELDS;
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      refreshPresets();
      presetSelect.value = name;
    };

    btnDeletePreset.onclick = () => {
      const name = presetSelect.value;
      if (!name) return;

      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      delete presets[name];
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      refreshPresets();
    };

    function refreshPresets() {
      const currentVal = presetSelect.value;
      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      presetSelect.innerHTML = '<option value="">プリセット選択</option>';

      Object.keys(presets).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        presetSelect.appendChild(opt);
      });

      if (presets[currentVal]) {
        presetSelect.value = currentVal;
      }
    }

    presetSelect.onchange = () => {
      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      SELECTED_FIELDS = presets[presetSelect.value] || [];
      saveFields();
      renderList(filterInput.value);
    };

    // モーダルへ配置
    modalBody.appendChild(modeSettingArea);
    modalBody.appendChild(topControlRow);
    modalBody.appendChild(btnRow);
    modalBody.appendChild(listArea);

    initSelected();
    renderList();
    refreshPresets();

    // 検索ワード復元
    const lastWord = localStorage.getItem(LAST_WORD_KEY);
    if (lastWord) {
      input.value = lastWord;
    }

    // フォーカス制御
    const focusFlag = new URLSearchParams(location.search).get('focusK') === '1';
    setTimeout(() => {
      if (focusFlag) {
        input.focus();
        setTimeout(() => {
          input.setSelectionRange(input.value.length, input.value.length);
        }, 50);

        setTimeout(() => {
          const url = new URL(location.href);
          url.searchParams.delete('focusK');
          history.replaceState(null, '', url);
        }, 0);
      }
    }, 500);
  }

  function createButton(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'gaia-ui-actionmenu-save';
    btn.style.margin = '2px';
    return btn;
  }

  kintone.events.on('app.record.index.show', async function () {
    if (!window.isAllowedUser || !window.isAllowedUser()) return;
    if (document.getElementById(INPUT_ID)) return;

    ALL_FIELDS = await getFields();

    const space = kintone.app.getHeaderMenuSpaceElement();
    createUI(space);
  });
})();
