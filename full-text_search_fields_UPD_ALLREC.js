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
    // ...(以降は変更なし)
