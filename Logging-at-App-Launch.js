(function () {
  'use strict';

  // =========================
  // 設定 アプリ起動時ログ記録_利用者追記
  // =========================

  // ログ保存先アプリ
  const LOG_APP_ID = 19;

  // 利用者管理アプリ
  const TARGET_APP_ID = 7;

  // 利用者フィールド
  const USER_FIELD_CODE = '利用者';

  const appId = kintone.app.getId();

  // APIトークン（アプリ7）
  const API_TOKEN = window.APIKEY(TARGET_APP_ID);

  // localStorageキー
  const STORAGE_KEY = 'target_user_cache_complete';

  // =========================
  // アプリ名取得
  // =========================

  function getAppName(appId) {
    return kintone.api(
      kintone.api.url('/k/v1/app', true),
      'GET',
      { id: appId }
    ).then(function (resp) {
      return resp.name;
    });
  }

  // =========================
  // 日付整形
  // =========================

  function formatDate(date) {
    const yyyy = date.getFullYear();
    const mm = ('0' + (date.getMonth() + 1)).slice(-2);
    const dd = ('0' + date.getDate()).slice(-2);

    return `${yyyy}${mm}${dd}`;
  }

  function formatTime(date) {
    const hh = ('0' + date.getHours()).slice(-2);
    const mm = ('0' + date.getMinutes()).slice(-2);
    const ss = ('0' + date.getSeconds()).slice(-2);

    return `${hh}${mm}${ss}`;
  }

  function formatDateForField(date) {
    const yyyy = date.getFullYear();
    const mm = ('0' + (date.getMonth() + 1)).slice(-2);
    const dd = ('0' + date.getDate()).slice(-2);

    return `${yyyy}-${mm}-${dd}`;
  }

  // =========================
  // 利用者フィールドへ追加
  // =========================

  async function appendOperatorToUserField(operator, appId) {
    console.log('関数内 appId=', appId);
    if (!operator) return;

    const TARGET_QUERY = `appId = ${appId}`;

    try {
      // レコード取得
      const getResp = await fetch(
        kintone.api.url('/k/v1/records', true) +
        `?app=${TARGET_APP_ID}&query=${encodeURIComponent(TARGET_QUERY)}`,
        {
          method: 'GET',
          headers: {
            'X-Cybozu-API-Token': API_TOKEN
          }
        }
      );

      const getData = await getResp.json();

      if (!getData.records || !getData.records.length) {
        console.warn('対象レコードが見つかりません');
        return;
      }

      const record = getData.records[0];

      // 現在値
      const current = record[USER_FIELD_CODE]?.value || '';

      // 配列化
      let users = current
        .split(',')
        .map(v => v.trim())
        .filter(v => v);

      // 重複チェック
      if (users.includes(operator)) {
        console.log('既に登録済み:', operator);
        return;
      }

      // 追加
      users.push(operator);

      const newValue = users.join(',');

      // 更新
      const putResp = await fetch(
        kintone.api.url('/k/v1/record.json', true),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Cybozu-API-Token': API_TOKEN
          },
          body: JSON.stringify({
            app: TARGET_APP_ID,
            id: record.$id.value,
            record: {
              [USER_FIELD_CODE]: {
                value: newValue
              }
            }
          })
        }
      );

      const putData = await putResp.json();

      if (!putResp.ok) {
        console.error(
          '利用者更新失敗',
          JSON.stringify(putData, null, 2)
        );
        return;
      }

      console.log('利用者更新成功:', newValue);

    } catch (err) {
      console.error(
        '利用者更新例外',
        JSON.stringify(err, null, 2)
      );
    }
  }

  // =========================
  // イベント
  // =========================

  kintone.events.on([
    'app.record.index.show',
    'app.record.detail.show'
  ], function (event) {

    const now = new Date();

    const dateStr = formatDate(now);
    const timeStr = formatTime(now);
    const dateField = formatDateForField(now);

    // localStorage取得
    let operator = localStorage.getItem(STORAGE_KEY) || '';

    try {
      operator = JSON.parse(operator).value || '';
    } catch (e) {
      operator = '';
    }

    // ログインユーザー
    const user = kintone.getLoginUser();

    // アプリ情報
    const appId = kintone.app.getId();
    const eventType = event.type;

    // 現在のURL
    const currentUrl = window.location.href;

    // 画面種別に応じた「内容」の組み立て
    let logContent = `起動（${currentUrl}）`;
    if (eventType === 'app.record.index.show') {
      logContent = `一覧（${currentUrl}）`;
    } else if (eventType === 'app.record.detail.show') {
      logContent = `詳細（${currentUrl}）`;
    }

    // ミリ秒
    const ms = ('00' + now.getMilliseconds()).slice(-3);

    return getAppName(appId).then(function (appName) {

      // =========================
      // 利用者更新
      // =========================
      console.log('呼び出し前 appId=', appId);
      appendOperatorToUserField(operator, appId);

      // =========================
      // ログ保存
      // =========================

      const body = {
        app: LOG_APP_ID,
        record: {

          'LOG種類': {
            value: 'KT'
          },

          'オペレータ': {
            value: operator
          },

          'USERNAME': {
            value: user.name
          },

          '操作日': {
            value: dateField
          },

          '項目': {
            value: appId.toString()
          },

          '時間': {
            value: timeStr
          },

          '操作時': {
            value: timeStr
          },

          '内容': {
            value: logContent
          },

          '登録日': {
            value: dateField
          },

          '処理名': {
            value: appName
          },

          '変更項目': {
            value: eventType
          },

          'KEY': {
            value: `KT-${dateStr}-${timeStr}-${ms}`
          }

        }
      };

      // ログ登録
      kintone.api(
        kintone.api.url('/k/v1/record', true),
        'POST',
        body
      )
      .then(function (resp) {
        console.log('ログ記録成功 V002', resp);
      })
      .catch(function (error) {
        console.error(
          'ログ記録失敗',
          JSON.stringify(error, null, 2)
        );
      });

      return event;

    });

  });

})();
