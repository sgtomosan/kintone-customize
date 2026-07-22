(function () {
  'use strict';

  const FULLTEXT_FIELD = '全文検索用';

  const EXCLUDE_FIELDS = [
    FULLTEXT_FIELD,
    '作成者', '更新者', '作成日時', '更新日時'
  ];

  const TEXT_FIELD_TYPES = [
    'SINGLE_LINE_TEXT',
    'MULTI_LINE_TEXT',
    'RICH_TEXT'
  ];

  kintone.events.on([
    'app.record.create.submit',
    'app.record.edit.submit'
  ], function (event) {
    const record = event.record;

    // ★フィールドが存在しない場合は何もせず抜ける（エラー化させない）
    if (!record[FULLTEXT_FIELD]) {
      return event;
    }

    try {
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

      // ★buildSuffixTokens が無い場合の保険
      const buildFn = (typeof buildSuffixTokens === 'function')
        ? buildSuffixTokens
        : (v) => v;

      record[FULLTEXT_FIELD].value = texts
        .map(v => buildFn(v, 10))
        .join(' ')
        .substring(0, 9999); // ★文字数上限で保存エラーを防止

    } catch (e) {
      // ★万一エラーが起きても保存自体は止めない
      console.error('全文検索用フィールド生成エラー:', e);
    }

    return event;
  });

})();
