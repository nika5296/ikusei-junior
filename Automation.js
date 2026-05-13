/**
 * 自動化トリガー・マスタ／変更シート編集後の名簿同期
 *
 * installScheduledAutomationTriggers_ を1回実行すると次が登録されます:
 *   - フォーム送信時 → onFormSubmit（ログ・集計シート・名簿・名簿集計列）
 *   - 毎朝8時（東京）→ morningBatch8am_（月末の翌月シート作成・ログ反映・集計・未入力メール）
 */

/** 一本化時に削除する既存トリガーのハンドラ名（手動で別用途に付けた同名は消えます） */
var AUTOMATION_TRIGGER_HANDLERS = [
  'onFormSubmit',
  'morningBatch8am_',
  'dailyAttendanceAlert_',
  'recomputeSummary_',
  'autoCreateNextMonths',
  'rosterDailyUpdate_'
];

/** メンバー変更シート連続編集時の名簿同期間隔（ミリ秒） */
var MEMBER_EDIT_SYNC_THROTTLE_MS = 90000;

/**
 * 推奨: 自動化用トリガーを一式で登録し直す（既存の上記ハンドラは削除してから再作成）
 */
function installScheduledAutomationTriggers_() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    var t = existing[i];
    if (AUTOMATION_TRIGGER_HANDLERS.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  }

  ScriptApp.newTrigger('morningBatch8am_')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  var ssId = getSpreadsheet_().getId();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ssId)
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert(
    '自動化トリガーを登録しました（' +
      CONFIG.TIMEZONE +
      '）。\n\n' +
      '【フォーム送信のたび】\n' +
      '出欠ログ → 集計シート（振替残など）→ 各月名簿へ反映 → 名簿の欠席・振替列も更新\n\n' +
      '【毎朝8時】\n' +
      '（期末のみ）翌月名簿シート作成 → ログを名簿へ → 集計更新 → 未入力セルがあればメール\n\n' +
      '【メンバー変更予定・新規入会】\n' +
      '編集後、自動で名簿を同期します（約90秒に1回まで）。\n\n' +
      '※旧「毎朝7時」「毎朝9時」「名簿8時・9時」トリガーは削除済みです。'
  );
}

/**
 * 毎朝8時・時間主導トリガーから実行
 */
function morningBatch8am_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    autoCreateNextMonths();
    ensureSheets_internal_({ rebuildLayout: false });
    updateFromLog();
    recomputeSummary_();
    updateSummary();
    checkMissing();
  } catch (err) {
    Logger.log('morningBatch8am_: ' + err);
    try {
      logErrorToSheet_('朝バッチ8時', String(err));
    } catch (e2) {}
  } finally {
    lock.releaseLock();
  }
}

/**
 * 生徒マスタ／変更予定／新規入会の反映後に名簿・集計を揃える
 */
function syncAttendanceBooksAfterMemberChange_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    ensureSheets_internal_({ rebuildLayout: true });
    updateFromLog();
    recomputeSummary_();
    updateSummary();
  } finally {
    lock.releaseLock();
  }
}

/**
 * メンバー変更予定シートの編集に反応（連打時はスロットル）
 */
function scheduleAttendanceSyncAfterMemberEdit_() {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var last = Number(props.getProperty('MEMBER_EDIT_SYNC_TS') || 0);
  if (now - last < MEMBER_EDIT_SYNC_THROTTLE_MS) return;
  props.setProperty('MEMBER_EDIT_SYNC_TS', String(now));
  syncAttendanceBooksAfterMemberChange_();
}
