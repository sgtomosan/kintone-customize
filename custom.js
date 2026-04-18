(function () {
  'use strict';

  // 一覧画面表示時
  kintone.events.on('app.record.index.show', function (event) {
    console.log('一覧表示イベント');
    return event;
  });

  // レコード詳細表示時
  kintone.events.on('app.record.detail.show', function (event) {
    console.log('詳細表示イベント');
    return event;
  });

})();
