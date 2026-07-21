(function () {
  'use strict';
//　  保存時に全文検索用フィールドがあった時に自動でセットする　

  /*************************************************
   * 設定
   *************************************************/
  const FULLTEXT_FIELD = '全文検索用';

  function isAllowedUser() {
    const loginUser = kintone.getLoginUser();
    return ADMIN_USERS.includes(loginUser.code);
  }

  // 除外するフィールドコード
  const EXCLUDE_FIELDS = [
    FULLTEXT_FIELD,
    '作成者',
    '更新者',
    '作成日時',
    '更新日時'
  ];

  // 文字系フィールド
  const TEXT_FIELD_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'RICH_TEXT'
  ];

  /*************************************************
   * 保存時（1レコードのみ処理）
   *************************************************/
  kintone.events.on([
    'app.record.create.submit',
    'app.record.edit.submit'
  ], function (event) {

    // ユーザー制限
    //if (!isAllowedUser()) return event;

    const record = event.record;
    const texts = [];

    Object.keys(record).forEach(code => {

      const field = record[code];
      const fieldVal = field.value;

      if (
        TEXT_FIELD_TYPES.includes(field.type) &&
        !EXCLUDE_FIELDS.includes(code) &&
        fieldVal &&
        fieldVal !== 'True' &&
        fieldVal !== 'False' &&
        !texts.includes(fieldVal)
      ) {
        texts.push(fieldVal);
      }

    });

    record[FULLTEXT_FIELD].value =
      texts
        .map(v => buildSuffixTokens(v, 10))
        .join(' ');

    return event;
  });

})();
