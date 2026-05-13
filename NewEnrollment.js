/**
 * 新規入会受付シート
 *
 * 必要事項をシートに入力するだけで、自動的に：
 *   1. 生徒マスタに新しい行を追加（生徒IDを自動生成）
 *   2. メンバー変更予定シートに入会月を自動登録
 *   3. 処理状況を「✅ 処理済み」に更新
 *
 * 入力必須: 氏名 / レギュラー曜日 / 入会日
 * 入力任意: 学年 / コース / メモ
 */

var NEW_ENROLLMENT_SHEET_NAME = '新規入会受付';

var NE_COL = {
  STATUS:       1, // 処理状況（自動入力）
  NAME:         2, // 氏名（必須）
  GRADE:        3, // 学年
  REGULAR_DAYS: 4, // レギュラー曜日（必須）カンマ区切り
  COURSE:       5, // コース
  START_DATE:   6, // 入会日（必須）例: 2026/5/1
  STUDENT_ID:   7, // 生徒ID（自動入力）
  NOTE:         8  // メモ
};

var NE_STATUS_DONE  = '✅ 処理済み';
var NE_STATUS_ERROR = '⚠️ エラー';

/** 実データ開始行（1=ヘッダー、2=説明行、3以降=実データ） */
var NE_DATA_START_ROW = 3;

// =============================================
// シート初期化
// =============================================

/**
 * 「新規入会受付」シートを作成し、書式・プルダウンを設定する
 */
function initNewEnrollmentSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(NEW_ENROLLMENT_SHEET_NAME);
  var isNew = !sh;

  if (!isNew) {
    var ui = SpreadsheetApp.getUi();
    var res = ui.alert('確認',
      '「' + NEW_ENROLLMENT_SHEET_NAME + '」シートは既に存在します。\n' +
      'ヘッダーと書式を再設定しますか？（既存データは残します）',
      ui.ButtonSet.YES_NO);
    if (res !== ui.Button.YES) return;
  } else {
    sh = ss.insertSheet(NEW_ENROLLMENT_SHEET_NAME);
  }

  // ── ヘッダー（1行目）────────────────────────────────────
  var headers = [
    '処理状況', '氏名（必須）', '学年',
    'レギュラー曜日（必須）', 'コース', '入会日（必須）',
    '生徒ID（自動）', 'メモ'
  ];
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#34a853')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // ── 説明行（2行目）──────────────────────────────────────
  var desc = [[
    '← 自動入力されます', '山田 太郎', '中1',
    '月,木（カンマ区切り）', '週2', '2026/5/1（年/月/日）',
    '← 自動入力', '備考など'
  ]];
  sh.getRange(2, 1, 1, headers.length)
    .setValues(desc)
    .setBackground('#ceead6')
    .setFontColor('#666666')
    .setFontStyle('italic');

  // ── 実データ行（3行目〜）の初期スタイル ───────────────
  sh.getRange(NE_DATA_START_ROW, 1, 200, headers.length)
    .setBackground('#ffffff')
    .setFontColor('#000000')
    .setFontStyle('normal');

  // ── コース列にプルダウン ───────────────────────────────
  var courseRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['週1', '週2', '週3'], true)
    .setAllowInvalid(true)
    .build();
  sh.getRange(NE_DATA_START_ROW, NE_COL.COURSE, 200, 1)
    .setDataValidation(courseRule);

  // ── 入会日列の書式を文字列に（日付の自動変換を防ぐ）────
  sh.getRange(NE_DATA_START_ROW, NE_COL.START_DATE, 200, 1)
    .setNumberFormat('@STRING@');

  // ── 列幅 ──────────────────────────────────────────────
  sh.setColumnWidth(NE_COL.STATUS,       135);
  sh.setColumnWidth(NE_COL.NAME,         145);
  sh.setColumnWidth(NE_COL.GRADE,         65);
  sh.setColumnWidth(NE_COL.REGULAR_DAYS, 160);
  sh.setColumnWidth(NE_COL.COURSE,        80);
  sh.setColumnWidth(NE_COL.START_DATE,   120);
  sh.setColumnWidth(NE_COL.STUDENT_ID,   100);
  sh.setColumnWidth(NE_COL.NOTE,         200);

  sh.setFrozenRows(1);
  sh.setRowHeight(1, 24);
  sh.setRowHeight(2, 22);

  SpreadsheetApp.getUi().alert(
    '「' + NEW_ENROLLMENT_SHEET_NAME + '」シートを設定しました。\n\n' +
    '【入力手順】\n' +
    '① B列（氏名）に名前を入力\n' +
    '② C列（学年）に学年を入力（省略可）\n' +
    '③ D列（レギュラー曜日）を入力 例: 月  /  月,木\n' +
    '④ E列（コース）を入力（省略可）\n' +
    '⑤ F列（入会日）を入力 例: 2026/5/1\n\n' +
    '→ 必須3項目（氏名・曜日・入会日）がそろった時点で\n' +
    '　 自動的に生徒マスタへ登録されます。\n\n' +
    '処理状況が「✅ 処理済み」になれば完了です。'
  );
}

// =============================================
// 入会処理（1行分）
// =============================================

/**
 * 指定行を読み取り、入会処理（マスタ追加・変更予定登録）を実行する
 *
 * 必須チェック:
 *   - 氏名が空 → スキップ（まだ入力途中）
 *   - レギュラー曜日が空 → スキップ
 *   - 入会日が空 → スキップ
 *   - 処理状況が「✅ 処理済み」→ スキップ（二重処理防止）
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} row
 * @returns {boolean} 処理が実行されたか
 */
function processEnrollmentRow_(sheet, row) {
  var cols = Object.keys(NE_COL).length;
  var vals = sheet.getRange(row, 1, 1, cols).getValues()[0];

  var status   = String(vals[NE_COL.STATUS - 1]       || '').trim();
  var name     = String(vals[NE_COL.NAME - 1]         || '').trim();
  var grade    = String(vals[NE_COL.GRADE - 1]        || '').trim();
  var days     = String(vals[NE_COL.REGULAR_DAYS - 1] || '').trim();
  var course   = String(vals[NE_COL.COURSE - 1]       || '').trim();
  var dateRaw  = vals[NE_COL.START_DATE - 1];
  var note     = String(vals[NE_COL.NOTE - 1]         || '').trim();

  // 処理済み or 必須項目未入力はスキップ
  if (status === NE_STATUS_DONE) return false;
  if (!name || !days || !dateRaw)  return false;

  // 入会日をパース（Date / "YYYY/M/D" / "YYYY年M月D日" など）
  var startDate = parseStartDate_(dateRaw);
  if (!startDate) return false;

  var startYear  = startDate.getFullYear();
  var startMonth = startDate.getMonth() + 1;

  try {
    var ss = getSpreadsheet_();

    // ── 生徒IDを自動生成してマスタに追加 ─────────────────
    var newId = generateNextStudentId_();
    var masterSh = ss.getSheetByName(CONFIG.SHEET.MASTER);
    if (!masterSh) throw new Error('生徒マスタシートが見つかりません');

    var enrollMonthStr = startYear + '/' + startMonth;

    // 列順: studentId / 氏名 / コース / レギュラー曜日 / 初期残振替 / viewToken / token無効 / メモ / 学年 / 入会月
    masterSh.appendRow([newId, name, course, days, 0, '', '', note, grade, enrollMonthStr]);

    // ── 処理完了を記録 ─────────────────────────────────────
    sheet.getRange(row, NE_COL.STATUS)
      .setValue(NE_STATUS_DONE + ' (ID:' + newId + ')')
      .setBackground('#d9ead3')
      .setFontColor('#274e13')
      .setFontStyle('normal');
    sheet.getRange(row, NE_COL.STUDENT_ID)
      .setValue(newId);

    Logger.log('新規入会処理完了: ' + name + ' (' + newId + ') 入会月: ' + enrollMonthStr);

    return true;

  } catch (err) {
    sheet.getRange(row, NE_COL.STATUS)
      .setValue(NE_STATUS_ERROR + ': ' + err.message)
      .setBackground('#fce8e6')
      .setFontColor('#a61c00');
    Logger.log('新規入会処理エラー (行' + row + '): ' + err.message);
    return false;
  }
}

/**
 * 入会日の文字列 / Date を解析して Date オブジェクトを返す
 * @param {*} raw
 * @returns {Date|null}
 */
function parseStartDate_(raw) {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw;
  }
  var s = String(raw || '').trim()
    .replace(/年/g, '/').replace(/月/g, '/').replace(/日/g, '');
  // YYYY/M/D or YYYY-M-D
  var m = s.match(/^(\d{4})[\/\-](\d{1,2})(?:[\/\-](\d{1,2}))?$/);
  if (!m) return null;
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  var d  = parseInt(m[3] || '1', 10);
  var dt = new Date(y, mo - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

// =============================================
// 未処理行の一括処理（メニュー実行用）
// =============================================

/**
 * 新規入会受付シートの未処理行をすべて処理する
 */
function processAllPendingEnrollments_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(NEW_ENROLLMENT_SHEET_NAME);
  if (!sh || sh.getLastRow() < NE_DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('処理対象の行がありません。\n「新規入会受付」シートを先に作成してください。');
    return;
  }

  var processed = 0;
  var skipped   = 0;

  for (var r = NE_DATA_START_ROW; r <= sh.getLastRow(); r++) {
    var status = String(sh.getRange(r, NE_COL.STATUS).getValue() || '').trim();
    if (status === NE_STATUS_DONE) { skipped++; continue; }

    var name  = String(sh.getRange(r, NE_COL.NAME).getValue()         || '').trim();
    var days  = String(sh.getRange(r, NE_COL.REGULAR_DAYS).getValue() || '').trim();
    var date  = sh.getRange(r, NE_COL.START_DATE).getValue();
    if (!name || !days || !date) continue; // 必須未入力はスキップ

    if (processEnrollmentRow_(sh, r)) processed++;
  }

  if (processed > 0) {
    try {
      syncAttendanceBooksAfterMemberChange_();
    } catch (syncErr) {
      Logger.log('一括入会後の名簿同期: ' + syncErr);
    }
  }

  SpreadsheetApp.getUi().alert(
    processed +
      '件を処理しました。\n' +
      '（処理済みスキップ: ' +
      skipped +
      '件）\n\n' +
      (processed > 0 ? '名簿・集計へ反映しました。' : '')
  );
}
