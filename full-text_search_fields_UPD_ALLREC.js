(function () {
  'use strict';

  /*************************************************
   * 設定
   *************************************************/
  const FULLTEXT_FIELD = '全文検索用';

  function isAllowedUser() {
    const loginUser = kintone.getLoginUser();
    return ADMIN_USERS.includes(loginUser.code);
  }

  // 除外フィールド
  const EXCLUDE_FIELDS = [
    FULLTEXT_FIELD,
    '作成者',
    '更新者',
    '作成日時',
    '更新日時'
  ];

  // 対象フィールドタイプ
  const TEXT_FIELD_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'RICH_TEXT'
  ];

  /*************************************************
   * フィールド存在チェック（キャッシュ付き）
   *************************************************/
  let fieldExistenceCache = null; // true / false / null(未取得)

  async function hasFulltextField() {
    if (fieldExistenceCache !== null) {
      return fieldExistenceCache;
    }

    try {
      const appId = kintone.app.getId();
      const resp = await kintone.api(
        kintone.api.url('/k/v1/app/form/fields.json', true),
        'GET',
        { app: appId }
      );

      fieldExistenceCache = Object.prototype.hasOwnProperty.call(
        resp.properties,
        FULLTEXT_FIELD
      );
    } catch (e) {
      console.error('フィールド定義取得エラー:', e);
      fieldExistenceCache = false;
    }

    return fieldExistenceCache;
  }

  /*************************************************
   * 対象選択モーダル（全件 / 空白のみ）
   *************************************************/
  function showTargetSelectDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.4); z-index: 9999;
        display: flex; align-items: center; justify-content: center;
      `;

      const box = document.createElement('div');
      box.style.cssText = `
        background: #fff; padding: 24px; border-radius: 6px;
        min-width: 320px; box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        font-family: sans-serif;
      `;

      const title = document.createElement('p');
      title.textContent = '更新対象を選択してください';
      title.style.marginBottom = '16px';
      title.style.fontWeight = 'bold';

      const btnAll = document.createElement('button');
      btnAll.textContent = 'すべてのレコード';
      btnAll.style.cssText = 'margin-right: 10px; padding: 6px 12px;';

      const btnBlankOnly = document.createElement('button');
      btnBlankOnly.textContent = `「${FULLTEXT_FIELD}」が空白のみ`;
      btnBlankOnly.style.cssText = 'margin-right: 10px; padding: 6px 12px;';

      const btnCancel = document.createElement('button');
      btnCancel.textContent = 'キャンセル';
      btnCancel.style.cssText = 'padding: 6px 12px;';

      btnAll.onclick = () => { document.body.removeChild(overlay); resolve('all'); };
      btnBlankOnly.onclick = () => { document.body.removeChild(overlay); resolve('blankOnly'); };
      btnCancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };

      box.appendChild(title);
      box.appendChild(btnAll);
      box.appendChild(btnBlankOnly);
      box.appendChild(btnCancel);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  /*************************************************
   * 一覧画面：管理者かつフィールド存在時のみボタン表示
   *************************************************/
  kintone.events.on('app.record.index.show', async function (event) {

    if (!isAllowedUser()) return event;
    if (document.getElementById('bulk-update-btn')) return event;

    const fieldExists = await hasFulltextField();
    if (!fieldExists) return event;

    const space = kintone.app.getHeaderMenuSpaceElement();
    if (!space) return event;

    // 非同期処理の間に他イベントでボタンが追加されている可能性があるため再チェック
    if (document.getElementById('bulk-update-btn')) return event;

    const btn = document.createElement('button');
    btn.id = 'bulk-update-btn';
    btn.textContent = '全文検索を全件更新V2';
    btn.style.marginLeft = '10px';

    btn.onclick = async function () {
      const mode = await showTargetSelectDialog();
      if (!mode) return; // キャンセル

      const confirmMsg = mode === 'all'
        ? '全レコードを更新します。よろしいですか？'
        : `「${FULLTEXT_FIELD}」が空白のレコードのみ更新します。よろしいですか？`;

      if (!confirm(confirmMsg)) return;

      btn.disabled = true;
      btn.textContent = '更新中...';

      try {
        await bulkUpdateAllRecords(mode);
        alert('更新完了しました');
      } catch (e) {
        console.error('bulk update error:', e);
        alert('更新中にエラーが発生しました');
      }

      btn.disabled = false;
      btn.textContent = '全文検索を全件更新';
    };

    space.appendChild(btn);

    return event;
  });

  /*************************************************
   * 全件更新処理
   * @param {string} mode 'all' または 'blankOnly'
   *************************************************/
  async function bulkUpdateAllRecords(mode) {

    const appId = kintone.app.getId();
    let allRecords = [];
    let offset = 0;
    const limit = 500;

    // クエリでの絞り込みは行わず、常に全件取得する
    // (全文検索用が複数行テキスト/リッチエディタ型の場合、"=" 演算子が使えないため)
    while (true) {
      const resp = await kintone.api(
        kintone.api.url('/k/v1/records', true),
        'GET',
        {
          app: appId,
          query: `limit ${limit} offset ${offset}`
        }
      );

      allRecords = allRecords.concat(resp.records);

      if (resp.records.length < limit) break;
      offset += limit;
    }

    console.log('取得件数(全体):', allRecords.length);

    // 「空白のみ」モードの場合は、取得後にJS側でフィルタする
    if (mode === 'blankOnly') {
      allRecords = allRecords.filter(rec => {
        const val = rec[FULLTEXT_FIELD]?.value;
        return !val || val === '';
      });
    }

    console.log('更新対象件数:', allRecords.length, '対象モード:', mode);

    /*************************************************
     * 更新データ生成
     *************************************************/
    const updateRecords = allRecords.map(rec => {

      const texts = [];

      const recordCopy = { ...rec };

      Object.keys(recordCopy).forEach(code => {

        const field = recordCopy[code];

        if (!field || typeof field !== 'object' || !field.type) return;

        if (
          TEXT_FIELD_TYPES.includes(field.type) &&
          !EXCLUDE_FIELDS.includes(code) &&
          field.value &&
          field.value !== 'True' &&
          field.value !== 'False' &&
          !texts.includes(field.value)
        ) {
          texts.push(field.value);
        }
      });

      /*************************************************
       * FULLTEXT生成
       *************************************************/
      const fulltextValue = texts
        .map(v => buildSuffixTokens(v, 10))
        .join(' ')
        .substring(0, 10000); // 安全上限

      return {
        id: rec.$id.value,
        record: {
          [FULLTEXT_FIELD]: {
            value: fulltextValue
          }
        }
      };
    });

    console.log('更新対象サンプル:', updateRecords[0]);

    /*************************************************
     * 100件ずつ更新
     *************************************************/
    const batchSize = 100;

    for (let i = 0; i < updateRecords.length; i += batchSize) {

      const batch = updateRecords.slice(i, i + batchSize);

      console.log('batch:', i, JSON.stringify(batch[0], null, 2));

      await kintone.api(
        kintone.api.url('/k/v1/records', true),
        'PUT',
        {
          app: appId,
          records: batch
        }
      );
    }
  }

})();
