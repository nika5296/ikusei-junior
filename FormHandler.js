/**
 * Googleフォーム回答 → 出欠ログ
 */

/**
 * フォーム送信時（インストール型トリガー必須）
 * ※エディタの「実行」では e が無いので失敗します。テストは reprocessLastFormRow_ を使う。
 */
function onFormSubmit(e) {
  if (!e || !e.range) {
    throw new Error(
      'onFormSubmit は「フォームが送信されたとき」にだけ動きます。エディタから直接実行しないでください。\n' +
        '・動作確認：スプレッドシートのメニュー「育成出欠V1 → フォーム回答の最終行を再処理（デバッグ用）」\n' +
        '・またはフォームからテスト送信し、トリガーが登録されていることを確認してください。'
    );
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    processFormRow_(e.range.getSheet(), e.range.getRow());
  } catch (err) {
    logErrorToSheet_('フォーム処理', String(err));
    throw err;
  } finally {
    lock.releaseLock();
  }
}

function reprocessLastFormRow_() {
  var sh = getFormAnswersSheet_();
  if (!sh) {
    SpreadsheetApp.getUi().alert('フォーム回答シートがありません（「フォーム回答」または「フォームの回答」）。');
    return;
  }
  var last = sh.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getUi().alert('処理する回答がありません。\nフォームから回答が送信されると自動的に処理されます。');
    return;
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    processFormRow_(sh, last);
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('最終行を再処理しました。');
}

/**
 * フォーム回答の全行を再処理（出欠ログをクリアしてから再計算）
 * 過去のフォーム回答をまとめて取り込むときに使用
 */
function reprocessAllFormRows_() {
  var ui = SpreadsheetApp.getUi();
  var confirm = ui.alert(
    '確認',
    '出欠ログを一度クリアして、フォーム回答の全行を再処理します。\nよろしいですか？',
    ui.ButtonSet.YES_NO
  );
  if (confirm !== ui.Button.YES) return;

  var sh = getFormAnswersSheet_();
  if (!sh) {
    ui.alert('フォーム回答シートがありません（「フォーム回答」または「フォームの回答」）。');
    return;
  }
  var last = sh.getLastRow();
  if (last < 2) {
    ui.alert('処理する回答がありません。\nフォームから回答が送信されると自動的に処理されます。');
    return;
  }

  var ss = getSpreadsheet_();
  var logSh = ss.getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  if (logSh && logSh.getLastRow() > 1) {
    logSh.getRange(2, 1, logSh.getLastRow() - 1, logSh.getLastColumn()).clearContent();
  }

  // 同一日に複数回フォームが送信された場合に備え、
  // "studentId|dateStr" → 記録済み最良ステータス のキャッシュを全行で共有する
  // 優先度: 振替出席 > 出席 > 欠席
  var statusCache = {};

  var errors = [];
  for (var row = 2; row <= last; row++) {
    try {
      processFormRow_(sh, row, true, statusCache);
    } catch (e) {
      errors.push('行' + row + ': ' + e.message);
    }
  }

  recomputeSummary_();
  updateFromLog();
  updateSummary();

  if (errors.length > 0) {
    ui.alert('一部の行でエラーが発生しました:\n\n' + errors.join('\n'));
  } else {
    ui.alert('全 ' + (last - 1) + ' 行の再処理が完了しました。名簿も更新しました。');
  }
}

/**
 * 1行分をパースして出欠ログへ追記し、集計更新
 * @param {Sheet}   sheet          フォーム回答シート
 * @param {number}  row            処理対象行番号
 * @param {boolean} skipRecompute  true のとき集計再計算をスキップ（一括処理用）
 * @param {Object}  statusCache    同一日複数回送信の重複防止キャッシュ
 *                                 キー: "studentId|yyyy-MM-dd"  値: 'PRESENT'|'ABSENT'|'MAKEUP'
 *                                 未指定時は都度ログを参照して重複チェック
 */
function processFormRow_(sheet, row, skipRecompute, statusCache) {
  if (!isFormAnswersSheetName_(sheet.getName())) return;

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rowValues = sheet.getRange(row, 1, row, sheet.getLastColumn()).getValues()[0];

  var headerToIndex = buildFormHeaderToIndex_(headers);

  var lessonHeader = getSetting_(CONFIG.SETTINGS_KEYS.FORM_HEADER_LESSON_DATE, '実施日');
  var weekdayHeader = getSetting_(CONFIG.SETTINGS_KEYS.FORM_HEADER_CLASS_WEEKDAY, '所属曜日');

  var lessonCol = findStudentColumnInFormHeaders_(headerToIndex, lessonHeader);
  var weekdayCol = findStudentColumnInFormHeaders_(headerToIndex, weekdayHeader);
  var deriveWeekday = settingIsTrue_(CONFIG.SETTINGS_KEYS.FORM_DERIVE_WEEKDAY_FROM_LESSON_DATE, true);

  if (lessonCol === undefined) {
    throw new Error(
      'フォームの実施日列が見つかりません。設定の「フォーム_実施日列名」（例: 今日の日付）と、回答シート1行目を一致させてください。行: ' + row
    );
  }
  if (weekdayCol === undefined && !deriveWeekday) {
    throw new Error(
      'フォームの所属曜日列が見つかりません。列を追加するか、設定で「フォーム_所属曜日なしは実施日から」を TRUE にしてください。行: ' + row
    );
  }

  var lessonRaw = rowValues[lessonCol];
  var lessonDate = toDateOnly_(lessonRaw);
  if (!lessonDate && lessonRaw != null && lessonRaw !== '') {
    var tryD = lessonRaw instanceof Date ? lessonRaw : new Date(lessonRaw);
    if (!isNaN(tryD.getTime())) lessonDate = toDateOnly_(tryD);
  }
  if (!lessonDate) {
    throw new Error('実施日が読み取れません。行: ' + row);
  }

  var classWeekday;
  if (weekdayCol !== undefined) {
    classWeekday = normalizeWeekdayLabel_(rowValues[weekdayCol]);
  } else {
    classWeekday = weekdayOfDate_(lessonDate);
  }
  if (!classWeekday) {
    throw new Error('所属曜日が取れません。実施日を確認するか、フォームに所属曜日列を追加してください。行: ' + row);
  }

  var rawTs = rowValues[0];
  var formTs;
  if (rawTs instanceof Date && !isNaN(rawTs.getTime())) {
    formTs = rawTs;
  } else if (typeof rawTs === 'number' && rawTs > 1) {
    // Sheetsの日付シリアル値（1900-01-00 起点）→ JSのDateに変換
    formTs = new Date(Math.round((rawTs - 25569) * 86400000));
  } else if (rawTs) {
    try {
      // "yyyy/MM/dd HH:mm:ss" 形式の文字列をJSTとして解析
      formTs = Utilities.parseDate(String(rawTs), CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm:ss');
    } catch (e) {
      formTs = new Date();
    }
  } else {
    formTs = new Date();
  }

  // 実施日の年月について、名簿と同じロジックで対象生徒を決める。
  // （マスタ直読みだと入会月前・変更予定未反映のため、未入会者が空白→欠席と誤計上される）
  var lessonYear = lessonDate.getFullYear();
  var lessonMonth = lessonDate.getMonth() + 1;
  var activeStudents = getStudentsForMonth_(lessonYear, lessonMonth);
  var targets = findStudentsForClassWeekday_(activeStudents, classWeekday);

  var logSh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  var newRows = [];

  // ステータス優先度（数値が高いほど優先）
  var STATUS_PRIORITY = { 'MAKEUP': 3, 'PRESENT': 2, 'ABSENT': 1 };

  // キャッシュのヘルパー: 同日同生徒の既存ステータスを取得
  var dateStr = Utilities.formatDate(lessonDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  function getCachedStatus(studentId) {
    if (statusCache) return statusCache[studentId + '|' + dateStr] || null;
    // キャッシュ未使用（ライブ1行処理）: ログから直接検索
    return getExistingLogStatus_(logSh, studentId, lessonDate);
  }
  function updateCache(studentId, internal) {
    if (!statusCache) return;
    var key = studentId + '|' + dateStr;
    var prev = statusCache[key] || null;
    if (!prev || (STATUS_PRIORITY[internal] || 0) > (STATUS_PRIORITY[prev] || 0)) {
      statusCache[key] = internal;
    }
  }

  // ① レギュラー生徒の処理
  var processedIds = {};
  for (var i = 0; i < targets.length; i++) {
    var st = targets[i];
    var colIdx = findStudentColumnInFormHeaders_(headerToIndex, st.name);
    if (colIdx === undefined) continue;
    processedIds[st.studentId] = true;

    var rawStatus = rowValues[colIdx];
    var internal = toInternalStatus_(rawStatus);
    if (!internal) internal = 'ABSENT';

    // 同日に既にPRESENT/MAKEUPが記録済みなら ABSENT は書き込まない
    if (internal === 'ABSENT') {
      var cached = getCachedStatus(st.studentId);
      if (cached === 'PRESENT' || cached === 'MAKEUP') continue;
    }

    var eligible = false;
    var consumed = false;
    if (internal === 'ABSENT') {
      eligible = arrayContainsWeekday_(st.regularWeekdays, classWeekday);
    } else if (internal === 'MAKEUP') {
      consumed = true;
    }

    var display = CONFIG.STATUS.PRESENT;
    if (internal === 'ABSENT') display = CONFIG.STATUS.ABSENT;
    if (internal === 'MAKEUP') display = CONFIG.STATUS.MAKEUP;

    updateCache(st.studentId, internal);
    newRows.push([
      uuid_(),
      st.studentId,
      st.name,
      lessonDate,
      classWeekday,
      display,
      eligible,
      consumed,
      row,
      formTs,
      ''
    ]);
  }

  // ② 非レギュラー生徒で「出席」と入力されていた場合 → 振替出席として記録
  for (var j = 0; j < activeStudents.length; j++) {
    var mst = activeStudents[j];
    if (processedIds[mst.studentId]) continue;

    var mColIdx = findStudentColumnInFormHeaders_(headerToIndex, mst.name);
    if (mColIdx === undefined) continue;

    var mRaw = rowValues[mColIdx];
    var mInternal = toInternalStatus_(mRaw);

    if (mInternal === 'PRESENT' || mInternal === 'MAKEUP') {
      // 既にMAKEUPが記録済みなら重複しない
      var mCached = getCachedStatus(mst.studentId);
      if (mCached === 'MAKEUP') continue;

      updateCache(mst.studentId, 'MAKEUP');
      newRows.push([
        uuid_(),
        mst.studentId,
        mst.name,
        lessonDate,
        classWeekday,
        CONFIG.STATUS.MAKEUP,
        false,
        true,
        row,
        formTs,
        '振替（非レギュラー日出席）'
      ]);
    }
  }

  if (newRows.length === 0) {
    throw new Error(
      '出欠ログに書き込める生徒がありません。該当曜日の生徒について、列見出しがマスタの「氏名」と一致するか確認してください（「生徒名 [氏名]」形式は可）。行: ' +
        row
    );
  }

  var startRow = logSh.getLastRow() + 1;
  logSh.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);

  if (!skipRecompute) {
    recomputeSummary_();
    updateFromLog();
    updateSummary();
  }
}

/**
 * デバッグ用：スプレッドシート内の全シート名を表示
 */
function debugListSheetNames_() {
  var ss = getSpreadsheet_();
  var sheets = ss.getSheets();
  var names = sheets.map(function(s) {
    var name = s.getName();
    var codes = [];
    for (var i = 0; i < name.length; i++) {
      codes.push(name.charCodeAt(i));
    }
    return '"' + name + '" [' + codes.join(',') + ']';
  });
  SpreadsheetApp.getUi().alert('シート一覧:\n\n' + names.join('\n'));
}

/**
 * 指定生徒・日付の既存ログステータスを返す（ライブ処理時の重複防止用）
 * 戻り値: 'PRESENT' | 'ABSENT' | 'MAKEUP' | null
 */
function getExistingLogStatus_(logSh, studentId, lessonDate) {
  if (!logSh || logSh.getLastRow() < 2) return null;
  var numRows = logSh.getLastRow() - 1;
  var data = logSh.getRange(2, 1, numRows, CONFIG.LOG_COL.STATUS).getValues();
  var targetDateStr = Utilities.formatDate(lessonDate, CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var bestPriority = 0;
  var bestInternal = null;
  var PRIORITY = { '出席': 2, '欠席': 1, '振替出席': 3 };
  var INTERNAL = { '出席': 'PRESENT', '欠席': 'ABSENT', '振替出席': 'MAKEUP' };
  for (var i = 0; i < data.length; i++) {
    var sid = String(data[i][CONFIG.LOG_COL.STUDENT_ID - 1]);
    if (sid !== String(studentId)) continue;
    var d = data[i][CONFIG.LOG_COL.LESSON_DATE - 1];
    var dStr = d instanceof Date
      ? Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd')
      : String(d).substring(0, 10);
    if (dStr !== targetDateStr) continue;
    var statusDisplay = String(data[i][CONFIG.LOG_COL.STATUS - 1]);
    var p = PRIORITY[statusDisplay] || 0;
    if (p > bestPriority) {
      bestPriority = p;
      bestInternal = INTERNAL[statusDisplay] || null;
    }
  }
  return bestInternal;
}

function logErrorToSheet_(kind, message) {
  try {
    var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.NOTIFICATIONS);
    if (!sh) return;
    sh.appendRow([new Date(), kind, message, 'ERROR']);
  } catch (e) {
    console.error(e);
  }
}
