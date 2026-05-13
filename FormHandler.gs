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
    SpreadsheetApp.getUi().alert('フォーム回答シートがありません（「フォーム回答」または「フォームの回答」）。');
    return;
  }
  var last = sh.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getUi().alert('処理する回答がありません。\nフォームから回答が送信されると自動的に処理されます。');
    return;
  }

  var ss = getSpreadsheet_();
  var logSh = ss.getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  if (logSh && logSh.getLastRow() > 1) {
    logSh.getRange(2, 1, logSh.getLastRow() - 1, logSh.getLastColumn()).clearContent();
  }

  var errors = [];
  for (var row = 2; row <= last; row++) {
    try {
      processFormRow_(sh, row, true); // skipRecompute=true で集計は後でまとめて実行
    } catch (e) {
      errors.push('行' + row + ': ' + e.message);
    }
  }

  recomputeSummary_(); // 全行処理後に1回だけ集計

  if (errors.length > 0) {
    ui.alert('一部の行でエラーが発生しました:\n\n' + errors.join('\n'));
  } else {
    ui.alert('全 ' + (last - 1) + ' 行の再処理が完了しました。');
  }
}

/**
 * 最終回答行を読み、processFormRow と同じ条件で失敗理由をダイアログ表示（デバッグ用）
 */
function diagnoseFormLastRow_() {
  var sh = getFormAnswersSheet_();
  if (!sh) {
    SpreadsheetApp.getUi().alert('フォーム回答シートが見つかりません。');
    return;
  }
  var last = sh.getLastRow();
  if (last < 2) {
    SpreadsheetApp.getUi().alert('フォームに回答行がありません（2行目以降）。');
    return;
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    processFormRow_(sh, last);
  } catch (err) {
    SpreadsheetApp.getUi().alert('【診断】この行は出欠ログに書けません:\n\n' + err + '\n\n※設定シート・生徒マスタ・フォーム1行目の列名を確認してください。');
    return;
  } finally {
    lock.releaseLock();
  }
  SpreadsheetApp.getUi().alert('【診断】問題なく処理できました。出欠ログ・集計を確認してください。');
}

/**
 * 1行分をパースして出欠ログへ追記し、集計更新
 * skipRecompute=true のときは集計再計算をスキップ（一括処理用）
 */
function processFormRow_(sheet, row, skipRecompute) {
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

  var lessonYear = lessonDate.getFullYear();
  var lessonMonth = lessonDate.getMonth() + 1;
  var activeStudents = getStudentsForMonth_(lessonYear, lessonMonth);
  var targets = findStudentsForClassWeekday_(activeStudents, classWeekday);

  var logSh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  var newRows = [];

  for (var i = 0; i < targets.length; i++) {
    var st = targets[i];
    var colIdx = findStudentColumnInFormHeaders_(headerToIndex, st.name);
    if (colIdx === undefined) {
      continue;
    }
    var rawStatus = rowValues[colIdx];
    var internal = toInternalStatus_(rawStatus);
    if (!internal) {
      // レギュラー曜日の生徒は空白＝欠席として扱う
      internal = 'ABSENT';
    }

    var eligible = false;
    var consumed = false;
    if (internal === 'PRESENT') {
      // 出席：集計は変化なし（監査用にログのみ残す）
    } else if (internal === 'ABSENT') {
      eligible = arrayContainsWeekday_(st.regularWeekdays, classWeekday);
    } else if (internal === 'MAKEUP') {
      consumed = true;
    }

    var display = CONFIG.STATUS.PRESENT;
    if (internal === 'ABSENT') display = CONFIG.STATUS.ABSENT;
    if (internal === 'MAKEUP') display = CONFIG.STATUS.MAKEUP;

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

  if (newRows.length === 0) {
    throw new Error(
      '出欠ログに書き込める生徒がありません。該当曜日の生徒について、列見出しがマスタの「氏名」と一致するか確認してください（「生徒名 [氏名]」形式は可）。行: ' +
        row
    );
  }

  var startRow = logSh.getLastRow() + 1;
  logSh.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);

  if (!skipRecompute) recomputeSummary_();
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

function logErrorToSheet_(kind, message) {
  try {
    var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.NOTIFICATIONS);
    if (!sh) return;
    sh.appendRow([new Date(), kind, message, 'ERROR']);
  } catch (e) {
    console.error(e);
  }
}
