(function () {
  'use strict';

  console.log('検索UI 真・最終完全版 (拡張レイアウト対応)');

  const APP_ID = kintone.app.getId();

  const INPUT_ID = 'ALLSearchInput';
  const FIELD_STORAGE_KEY = 'SEARCH_TARGET_FIELDS_' + APP_ID;
  const PRESET_STORAGE_KEY = 'SEARCH_PRESETS_' + APP_ID;
  const CURRENT_PRESET_KEY = 'SEARCH_CURRENT_PRESET_' + APP_ID;
  const MODE_STORAGE_KEY = 'SEARCH_MODE_' + APP_ID;
  const MODAL_POS_KEY = 'SEARCH_MODAL_POS_' + APP_ID;
  const HISTORY_KEY = 'SEARCH_HISTORY_' + APP_ID;
  const LAST_WORD_KEY = 'LAST_SEARCH_WORD_' + APP_ID;

  const MAX_HISTORY = 20;

  const FIELD_KEYWORDS = ['_', '検索', '品', '名', '番号', 'CD', 'KEY', 'ｺｰﾄﾞ', '備考', 'MEMO', 'メモ'];

  let ALL_FIELDS = [];
  let SELECTED_FIELDS = [];

  /* =========================
   * 共通処理
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

  /* =========================
   * モーダル生成
   * ========================= */
  function createModal() {
    const modal = document.createElement('div');
    const savedPos = JSON.parse(localStorage.getItem(MODAL_POS_KEY) || 'null');

    Object.assign(modal.style, {
      position: 'fixed',
      top: savedPos ? savedPos.top : '100px',
      left: savedPos ? savedPos.left : '100px',
      width: '460px',
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
    body.style.maxHeight = '480px';
    body.style.overflow = 'auto';
    modal.appendChild(body);

    // ===== ドラッグ移動 =====
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
   * サジェスト機能
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
    btnOpen.style.height = '44px';
    btnOpen.style.padding = '0 16px';
    btnOpen.style.margin = '0 0 0 6px';
    btnOpen.style.verticalAlign = 'top';
    
    space.appendChild(input);
    space.appendChild(btnOpen);

    // 検索処理
    const search = (word) => {
      const raw = normalize(word);
      const viewId = getViewId();

      if (!raw) {
        input.value = '';
        localStorage.removeItem(LAST_WORD_KEY);
        const url = `${location.pathname}?` + (viewId ? `view=${viewId}&` : '') + `query=`;
        location.href = url;
        return;
      }

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

    // モーダル設定
    const modalBody = createModal();
    modalBody.parentNode.style.display = 'none';

    btnOpen.onclick = () => {
      const modal = modalBody.parentNode;
      modal.style.display = modal.style.display === 'none' ? 'block' : 'none';
    };

    // ツールチップ更新関数
    function updateButtonTooltip() {
      const currentName = localStorage.getItem(CURRENT_PRESET_KEY);
      if (currentName) {
        btnOpen.title = `現在適用中のプリセット: ${currentName}`;
      } else {
        btnOpen.title = '検索設定 (プリセット未選択)';
      }
    }

    // ----------------------------------------------------
    // 【1段目】プリセット選択 / 保存 / 削除
    // ----------------------------------------------------
    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '6px';
    row1.style.marginBottom = '6px';

    const presetSelect = document.createElement('select');
    presetSelect.className = 'gaia-ui-input';
    presetSelect.style.flex = '1';
    presetSelect.style.height = '34px';

    const btnSavePreset = createButton('保存');
    btnSavePreset.style.flex = '1';
    const btnDeletePreset = createButton('削除');
    btnDeletePreset.style.flex = '1';

    row1.appendChild(presetSelect);
    row1.appendChild(btnSavePreset);
    row1.appendChild(btnDeletePreset);

    // ----------------------------------------------------
    // 【2段目】全選択 / 全解除 / 初期状態
    // ----------------------------------------------------
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.gap = '6px';
    row2.style.marginBottom = '8px';

    const btnAll = createButton('全選択');
    btnAll.style.flex = '1';
    const btnNone = createButton('全解除');
    btnNone.style.flex = '1';
    const btnReset = createButton('初期状態');
    btnReset.style.flex = '1';

    row2.appendChild(btnAll);
    row2.appendChild(btnNone);
    row2.appendChild(btnReset);

    // ----------------------------------------------------
    // 【3段目】フィールド検索 + [ ]ソート [ ]チェック有 [ ]未チェック
    // ----------------------------------------------------
    const row3 = document.createElement('div');
    row3.style.display = 'flex';
    row3.style.alignItems = 'center';
    row3.style.gap = '8px';
    row3.style.marginBottom = '6px';

    const filterInput = document.createElement('input');
    filterInput.placeholder = 'フィールド検索';
    filterInput.className = 'gaia-ui-input';
    filterInput.style.flex = '1';
    filterInput.style.height = '32px';

    const optArea = document.createElement('div');
    optArea.style.display = 'flex';
    optArea.style.alignItems = 'center';
    optArea.style.gap = '6px';
    optArea.style.fontSize = '12px';
    optArea.style.whiteSpace = 'nowrap';

    // ソート
    const cbSort = document.createElement('input');
    cbSort.type = 'checkbox';
    cbSort.id = 'cb_search_sort';
    const lblSort = document.createElement('label');
    lblSort.htmlFor = 'cb_search_sort';
    lblSort.textContent = 'ソート';

    // チェック有
    const cbChecked = document.createElement('input');
    cbChecked.type = 'checkbox';
    cbChecked.id = 'cb_search_checked';
    const lblChecked = document.createElement('label');
    lblChecked.htmlFor = 'cb_search_checked';
    lblChecked.textContent = 'チェック有';

    // 未チェック
    const cbUnchecked = document.createElement('input');
    cbUnchecked.type = 'checkbox';
    cbUnchecked.id = 'cb_search_unchecked';
    const lblUnchecked = document.createElement('label');
    lblUnchecked.htmlFor = 'cb_search_unchecked';
    lblUnchecked.textContent = '未チェック';

    // 「チェック有」と「未チェック」は排他
    cbChecked.onchange = () => {
      if (cbChecked.checked) cbUnchecked.checked = false;
      renderList();
    };
    cbUnchecked.onchange = () => {
      if (cbUnchecked.checked) cbChecked.checked = false;
      renderList();
    };
    cbSort.onchange = () => renderList();
    filterInput.oninput = () => renderList();

    optArea.appendChild(cbSort);
    optArea.appendChild(lblSort);
    optArea.appendChild(cbChecked);
    optArea.appendChild(lblChecked);
    optArea.appendChild(cbUnchecked);
    optArea.appendChild(lblUnchecked);

    row3.appendChild(filterInput);
    row3.appendChild(optArea);

    // ----------------------------------------------------
    // 【4段目】OR検索 / AND検索 セレクト
    // ----------------------------------------------------
    const row4 = document.createElement('div');
    row4.style.marginBottom = '8px';

    const modeToggle = document.createElement('select');
    modeToggle.className = 'gaia-ui-input';
    modeToggle.style.width = '100%';
    modeToggle.style.height = '32px';

    [['OR', 'OR検索（いずれかに一致）'], ['AND', 'AND検索（すべてに一致）']].forEach(([m, text]) => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = text;
      modeToggle.appendChild(opt);
    });

    modeToggle.value = localStorage.getItem(MODE_STORAGE_KEY) || 'OR';
    modeToggle.onchange = () => {
      localStorage.setItem(MODE_STORAGE_KEY, modeToggle.value);
    };

    row4.appendChild(modeToggle);

    // ----------------------------------------------------
    // 【リスト表示エリア】
    // ----------------------------------------------------
    const listArea = document.createElement('div');
    listArea.style.border = '1px solid #ddd';
    listArea.style.padding = '6px';
    listArea.style.maxHeight = '230px';
    listArea.style.overflowY = 'auto';

    function renderList() {
      const filterText = filterInput.value || '';
      listArea.innerHTML = '';

      // 1. コピーを作成
      let targetList = [...ALL_FIELDS];

      // 2. ソート判定（有効時は五十音・アルファベット順、無効時は元のフォーム定義順）
      if (cbSort.checked) {
        targetList.sort((a, b) => a.label.localeCompare(b.label, 'ja'));
      }

      // 3. 絞り込み条件（テキスト、チェック状態）
      targetList = targetList.filter(f => {
        // キーワード絞り込み
        if (filterText && !f.label.includes(filterText)) {
          return false;
        }
        // チェック有のみ
        if (cbChecked.checked && !SELECTED_FIELDS.includes(f.code)) {
          return false;
        }
        // 未チェックのみ
        if (cbUnchecked.checked && SELECTED_FIELDS.includes(f.code)) {
          return false;
        }
        return true;
      });

      // 4. 描画
      targetList.forEach(f => {
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

    function saveFields() {
      localStorage.setItem(FIELD_STORAGE_KEY, JSON.stringify(SELECTED_FIELDS));
    }

    function updateSelectedFields() {
      const checks = listArea.querySelectorAll('input[type="checkbox"]:checked');
      const currentListCodes = Array.from(listArea.querySelectorAll('input[type="checkbox"]')).map(cb => cb.value);

      // 表示外のチェック済み項目を維持しながら更新
      const uncheckedInView = currentListCodes.filter(code => !Array.from(checks).some(cb => cb.value === code));
      SELECTED_FIELDS = SELECTED_FIELDS.filter(code => !uncheckedInView.includes(code));

      Array.from(checks).forEach(cb => {
        if (!SELECTED_FIELDS.includes(cb.value)) {
          SELECTED_FIELDS.push(cb.value);
        }
      });

      saveFields();
      if (cbChecked.checked || cbUnchecked.checked) {
        renderList();
      }
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
      renderList();
    };

    btnNone.onclick = () => {
      SELECTED_FIELDS = [];
      saveFields();
      renderList();
    };

    btnReset.onclick = () => {
      SELECTED_FIELDS = ALL_FIELDS
        .filter(f => isDefaultChecked(f))
        .map(f => f.code);
      saveFields();
      renderList();
    };

    // プリセット保存（AND/OR設定も一緒に保持）
    btnSavePreset.onclick = () => {
      const defaultName = presetSelect.value || '';
      const name = prompt('プリセット名', defaultName);
      if (!name) return;

      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      presets[name] = {
        fields: SELECTED_FIELDS,
        mode: modeToggle.value
      };

      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
      localStorage.setItem(CURRENT_PRESET_KEY, name);
      refreshPresets();
      presetSelect.value = name;
      updateButtonTooltip();
    };

    // プリセット削除
    btnDeletePreset.onclick = () => {
      const name = presetSelect.value;
      if (!name) return;

      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      delete presets[name];
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));

      if (localStorage.getItem(CURRENT_PRESET_KEY) === name) {
        localStorage.removeItem(CURRENT_PRESET_KEY);
      }
      refreshPresets();
      updateButtonTooltip();
    };

    function refreshPresets() {
      const currentVal = presetSelect.value || localStorage.getItem(CURRENT_PRESET_KEY) || '';
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

    // プリセット切り替え時（フィールドおよび AND/OR モードを反映）
    presetSelect.onchange = () => {
      const selName = presetSelect.value;
      const presets = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '{}');
      const target = presets[selName];

      if (target) {
        if (Array.isArray(target)) {
          // 過去バージョン互換
          SELECTED_FIELDS = target;
        } else {
          SELECTED_FIELDS = target.fields || [];
          if (target.mode) {
            modeToggle.value = target.mode;
            localStorage.setItem(MODE_STORAGE_KEY, target.mode);
          }
        }
        localStorage.setItem(CURRENT_PRESET_KEY, selName);
      } else {
        localStorage.removeItem(CURRENT_PRESET_KEY);
      }

      saveFields();
      renderList();
      updateButtonTooltip();
    };

    // モーダルへ部品を追加
    modalBody.appendChild(row1);
    modalBody.appendChild(row2);
    modalBody.appendChild(row3);
    modalBody.appendChild(row4);
    modalBody.appendChild(listArea);

    initSelected();
    renderList();
    refreshPresets();
    updateButtonTooltip();

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
    btn.style.margin = '0px';
    btn.style.padding = '0 8px 3px 8px';
    btn.style.height = '34px';
    btn.style.boxSizing = 'border-box';
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
