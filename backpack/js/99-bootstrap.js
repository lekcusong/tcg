'use strict';
/* 一定要最後載入：所有檔案都就位、GM 開關確認可玩後才開始畫面 */
bpGate().then(ok => {
  if (!ok) return bpLockScreen();
  FX.init(); calcCS(); refresh(); showStart(); checkAch();
  bpTellParent("ready");
});
