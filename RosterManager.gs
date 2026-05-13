/**
 * 月別出欠名簿 自動生成・管理
 *
 * 依存: Config.gs / Utils.gs / Master.gs
 *
 * 設計思想:
 *   出欠ログを唯一の正とし、名簿は表示専用として自動生成する。
 *   直接セル編集は行わず、フォーム → ログ → 名簿反映 のフローを守る。
 */

// =============================================
// 定数
// =============================================

var ROSTER = {
  /** 表示ステータス変換（ログ値 → 名簿表示文字） */
  STATUS_DISPLAY: {
    '出席':    '○',
    '振替出席': '振替',
    '欠席':    '欠',
    '休会':    '休'
  },

  /** 背景色 */
  COLOR: {
    GRAY:         '#b7b7b7', // レギュラー外（入力不可）濃いグレー
    WHITE:        '#ffffff', // レギュラー日（入力対象）
    LIGHT_YELLOW: '#fff2cc', // 振替出席
    LIGHT_RED:    '#ffd6d6', // 未入力アラート
    TITLE_BG:     '#e8f0fe', // タイトル行
    HEADER_BG:    '#4a86e8', // ヘッダー行（日付列）
    HEADER_FG:    '#ffffff',
    DATE_BG:      '#c9daf8', // 日付行
    SUMMARY_BG:   '#f6b26b', // 集計ヘッダー
    SUMMARY_DATE_BG: '#fce5cd' // 集計日付行
  },

  /** 固定列数（名前・学年・レギュラー曜日） */
  FIXED_COLS: 3,

  /** 集計列数（欠席・振替使用・振替残・未入力） */
  SUMMARY_COL_COUNT: 4,
  SUMMARY_HEADERS: ['欠席数', '振替使用', '振替残', '未入力'],

  /** シート名の接尾辞 */
  SHEET_SUFFIX: '出欠名簿',

  /** 設定キー: 名簿自動作成開始日（月末何日以降に翌月シートを作るか） */
  SETTINGS_KEY_AUTO_DAY: '名簿自動作成開始日'
};

// =============================================
// ユーティリティ
// =============================================

/**
 * シート名を生成する
 * @param {number} year
 * @param {number} month
 * @returns {string} 例: "2026年5月 出欠名簿"
 */
function getRosterSheetName_(year, month) {
  return year + '年' + month + '月 ' + ROSTER.SHEET_SUFFIX;
}

/**
 * 現在の日本時間の年・月・日を返す
 */
function getNowJST_() {
  var tz = String(getSetting_(CONFIG.SETTINGS_KEYS.TIMEZONE, CONFIG.TIMEZONE) || CONFIG.TIMEZONE);
  var now = new Date();
  return {
    year:  Number(Utilities.formatDate(now, tz, 'yyyy')),
    month: Number(Utilities.formatDate(now, tz, 'M')),
    day:   Number(Utilities.formatDate(now, tz, 'd'))
  };
}

// =============================================
// 生徒ソート
// =============================================

/**
 * 学年文字列を数値に変換する（大きい = 上の学年）
 *
 * 変換ルール:
 *   中3 → 9, 中2 → 8, 中1 → 7
 *   小6 or 6 → 6, 小5 or 5 → 5, ..., 小1 or 1 → 1
 *
 * @param {string} grade
 * @returns {number} ソート用数値（大きいほど上の学年）
 */
function gradeToSortKey_(grade) {
  var s = String(grade || '').trim();
  // 中X (中1=7, 中2=8, 中3=9)
  var mMatch = s.match(/^中(\d)$/);
  if (mMatch) return 6 + parseInt(mMatch[1], 10);
  // 小X or 数字のみ
  var eMatch = s.match(/^(?:小)?(\d+)$/);
  if (eMatch) return parseInt(eMatch[1], 10);
  return 0; // 不明 → 最後に配置
}

/**
 * 生徒リストを並び替える
 *
 * ソート優先順:
 *   1. 学年（降順）: 中3 → 中2 → 中1 → 小6(6) → 小5(5) → ... → 小1(1)
 *   2. コース（昇順）: 週1 → 週2 → 週3
 *   3. レギュラー曜日の先頭（昇順）: 月 → 火 → 木 → 金
 *
 * @param {Array} students  getStudentsForMonth_ の戻り値
 * @returns {Array} ソート済みの新配列
 */
function sortStudents_(students) {
  var WEEKDAY_ORDER = { '月': 1, '火': 2, '木': 3, '金': 4 };

  // コース文字列から数値を抽出（'週1'/'週1回'/'1回/週' など形式を問わず対応）
  function getCourseNum(course) {
    var m = String(course || '').match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 99;
  }

  return students.slice().sort(function(a, b) {
    // 1. コース（昇順）: 週1 → 週2 → 週3
    var ca = getCourseNum(a.course);
    var cb = getCourseNum(b.course);
    if (ca !== cb) return ca - cb;

    // 2. レギュラー曜日の先頭（昇順）: 月 → 火 → 木 → 金
    var wa = (a.regularWeekdays && a.regularWeekdays.length > 0)
             ? (WEEKDAY_ORDER[a.regularWeekdays[0]] || 99)
             : 99;
    var wb = (b.regularWeekdays && b.regularWeekdays.length > 0)
             ? (WEEKDAY_ORDER[b.regularWeekdays[0]] || 99)
             : 99;
    if (wa !== wb) return wa - wb;

    // 3. 学年（降順）: 中3 → 中2 → 中1 → 小6(6) → ...
    var ga = gradeToSortKey_(a.grade);
    var gb = gradeToSortKey_(b.grade);
    return gb - ga;  // 降順
  });
}

// =============================================
// レッスン日生成
// =============================================

/**
 * 指定月のレッスン日を返す（月火木金 × 各4回まで、時系列順）
 *
 * @param {number} year
 * @param {number} month
 * @returns {Date[]} 時系列順の Date 配列
 */
function getLessonDates(year, month) {
  var counts = {};
  CONFIG.TARGET_WEEKDAYS.forEach(function(wd) { counts[wd] = 0; });

  var results = [];
  var lastDay = new Date(year, month, 0).getDate(); // 月末日

  for (var d = 1; d <= lastDay; d++) {
    var date = new Date(year, month - 1, d);
    var wd = weekdayOfDate_(date);
    if (CONFIG.TARGET_WEEKDAYS.indexOf(wd) >= 0 && counts[wd] < 4) {
      counts[wd]++;
      results.push(date);
    }
  }

  // 時系列順
  results.sort(function(a, b) { return a.getTime() - b.getTime(); });
  return results;
}

// =============================================
// シート作成
// =============================================

/**
 * 月別出欠名簿シートを作成する
 *
 * @param {{rebuildLayout?: boolean}=} opt
 *        既存シート: true（既定）で生徒行を作り直す。false は背景のみ（日次用）
 */
function createSheetForMonth(year, month, opt) {
  var rebuildLayout = !opt || opt.rebuildLayout !== false;

  var ss = getSpreadsheet_();
  var name = getRosterSheetName_(year, month);

  var existing = ss.getSheetByName(name);
  if (existing) {
    if (rebuildLayout) {
      Logger.log('シート「' + name + '」既存: レイアウト＋背景を更新します。');
      applyLayout(existing, year, month);
    } else {
      Logger.log('シート「' + name + '」既存: 背景のみ更新します。');
    }
    applyBackground(existing, year, month);
    return existing;
  }

  var sheet = ss.insertSheet(name);
  applyLayout(sheet, year, month);
  applyBackground(sheet, year, month);
  Logger.log('シート「' + name + '」を作成しました。');
  return sheet;
}

// =============================================
// レイアウト適用
// =============================================

/**
 * 名簿シートにレイアウト（ヘッダー・生徒行・書式）を適用する
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} year
 * @param {number} month
 */
function applyLayout(sheet, year, month) {
  var students = sortStudents_(getStudentsForMonth_(year, month));
  var dates = getLessonDates(year, month);
  var fc = ROSTER.FIXED_COLS;
  var sc = ROSTER.SUMMARY_COL_COUNT;
  var totalCols = fc + dates.length + sc;
  var dataRows = students.length;

  // ── クリア ──────────────────────────────────────────────
  sheet.clearContents();
  sheet.clearFormats();

  // ── 1行目: タイトル ────────────────────────────────────
  // ※ 全列結合 + 列固定の組み合わせは Google Sheets で禁止されているため、
  //    固定列（名前・学年・レギュラー）のみ結合してタイトルを表示する。
  //    日付列以降は背景色のみ設定して視覚的に統一する。
  sheet.getRange(1, 1).setValue(year + '年' + month + '月 育成クラス出欠名簿');
  if (ROSTER.FIXED_COLS > 1) {
    sheet.getRange(1, 1, 1, ROSTER.FIXED_COLS).merge();
  }
  sheet.getRange(1, 1)
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground(ROSTER.COLOR.TITLE_BG)
    .setFontColor('#1a1a1a');
  // タイトル行の残り（日付列 + 集計列）も同じ背景色に揃える
  if (totalCols > ROSTER.FIXED_COLS) {
    sheet.getRange(1, ROSTER.FIXED_COLS + 1, 1, totalCols - ROSTER.FIXED_COLS)
      .setBackground(ROSTER.COLOR.TITLE_BG)
      .setValue('');
  }
  sheet.setRowHeight(1, 38);

  // ── 2行目: 曜日ヘッダー + 集計ヘッダー ────────────────
  var row2Values = ['名前', '学年', 'レギュラー'];
  for (var i = 0; i < dates.length; i++) {
    row2Values.push(weekdayOfDate_(dates[i]));
  }
  ROSTER.SUMMARY_HEADERS.forEach(function(h) { row2Values.push(h); });
  sheet.getRange(2, 1, 1, row2Values.length).setValues([row2Values]);

  // ── 3行目: 日付 ────────────────────────────────────────
  var row3Values = ['', '', ''];
  for (var j = 0; j < dates.length; j++) {
    var d = dates[j];
    row3Values.push((d.getMonth() + 1) + '/' + d.getDate());
  }
  for (var k = 0; k < sc; k++) { row3Values.push(''); }
  sheet.getRange(3, 1, 1, row3Values.length).setValues([row3Values]);

  // ── 4行目以降: 生徒データ ──────────────────────────────
  if (dataRows > 0) {
    var studentData = students.map(function(st) {
      // 休会中の生徒は名前に "(休会)" を付けて視覚的に区別
      var displayName = st.name + (st.enrollmentStatus === '休会' ? ' (休会)' : '');
      var row = [displayName, st.grade || '', st.regularWeekdays.join(',')];
      for (var d = 0; d < dates.length + sc; d++) { row.push(''); }
      return row;
    });
    sheet.getRange(4, 1, dataRows, totalCols).setValues(studentData);
  }

  // ── 書式 ───────────────────────────────────────────────

  // タイトル行（1行目）は上記で設定済み

  // 2行目: 曜日ヘッダー
  sheet.getRange(2, 1, 1, totalCols)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground(ROSTER.COLOR.HEADER_BG)
    .setFontColor(ROSTER.COLOR.HEADER_FG);
  // 集計ヘッダー列を橙色で区別
  sheet.getRange(2, fc + dates.length + 1, 1, sc)
    .setBackground(ROSTER.COLOR.SUMMARY_BG)
    .setFontColor('#1a1a1a');

  // 3行目: 日付行
  sheet.getRange(3, 1, 1, totalCols)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setBackground(ROSTER.COLOR.DATE_BG)
    .setFontColor('#1a1a1a');
  sheet.getRange(3, fc + dates.length + 1, 1, sc)
    .setBackground(ROSTER.COLOR.SUMMARY_DATE_BG);

  // データ行
  if (dataRows > 0) {
    sheet.getRange(4, 1, dataRows, totalCols)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle')
      .setFontSize(10);
    // 名前列のみ左揃え
    sheet.getRange(4, 1, dataRows, 1).setHorizontalAlignment('left');
    // 集計列を薄橙背景
    sheet.getRange(4, fc + dates.length + 1, dataRows, sc)
      .setBackground(ROSTER.COLOR.SUMMARY_DATE_BG);
  }

  // 罫線（全データ範囲）
  if (totalCols > 0 && dataRows + 2 > 0) {
    sheet.getRange(2, 1, dataRows + 2, totalCols)
      .setBorder(true, true, true, true, true, true,
        '#aaaaaa', SpreadsheetApp.BorderStyle.SOLID);
  }

  // ── 列幅 ───────────────────────────────────────────────
  sheet.setColumnWidth(1, 155); // 名前（長い名前が切れないよう広め）
  sheet.setColumnWidth(2, 48);  // 学年
  sheet.setColumnWidth(3, 95);  // レギュラー曜日
  for (var ci = 1; ci <= dates.length; ci++) {
    sheet.setColumnWidth(fc + ci, 42);
  }
  for (var cj = 1; cj <= sc; cj++) {
    sheet.setColumnWidth(fc + dates.length + cj, 65);
  }


  // ── 行高 ───────────────────────────────────────────────
  sheet.setRowHeight(2, 24);
  sheet.setRowHeight(3, 24);
  for (var r = 4; r < 4 + dataRows; r++) {
    sheet.setRowHeight(r, 22);
  }

  // ── 行・列固定 ──────────────────────────────────────────
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(ROSTER.FIXED_COLS);

  // ── 曜日別人数サマリー ──────────────────────────────────
  buildDaySummary_(sheet, year, month, students);

  // ── 変更点メモ欄 ────────────────────────────────────────
  buildMemo_(sheet, year, month, students.length);

  ensureRosterMakeupConditionalFormat_(sheet, year, month);
}

function ensureRosterMakeupConditionalFormat_(sheet, year, month) {
  var fc = ROSTER.FIXED_COLS;
  var dates = getLessonDates(year, month);
  if (dates.length === 0) return;
  var lastDateCol = fc + dates.length;
  var maxRow = 500;

  var rules = sheet.getConditionalFormatRules();
  var kept = [];
  for (var i = 0; i < rules.length; i++) {
    if (isRosterMakeupYellowCfRule_(rules[i], fc, lastDateCol)) continue;
    kept.push(rules[i]);
  }

  var rng = sheet.getRange(4, fc + 1, maxRow, lastDateCol);
  kept.push(
    SpreadsheetApp.newConditionalFormatRule()
      .setRanges([rng])
      .whenTextEqualTo('振')
      .setBackground(ROSTER.COLOR.LIGHT_YELLOW)
      .build()
  );
  sheet.setConditionalFormatRules(kept);
}

function isRosterMakeupYellowCfRule_(rule, fc, lastDateCol) {
  var bc = rule.getBooleanCondition();
  if (!bc) return false;
  if (bc.getCriteriaType() !== SpreadsheetApp.BooleanCriteria.TEXT_EQ) return false;
  var vals = bc.getCriteriaValues();
  if (!vals || String(vals[0]).trim() !== '振') return false;
  var ranges = rule.getRanges();
  if (!ranges.length) return false;
  var r = ranges[0];
  return r.getRow() >= 4 && r.getColumn() >= fc + 1 && r.getLastColumn() <= lastDateCol;
}

// =============================================
// 背景色適用（レギュラー曜日判定）
// =============================================

/**
 * 生徒ごとのレギュラー曜日と日付列を照合して背景色を一括設定する
 * ・一致 → 白（入力対象）
 * ・不一致 → グレー（入力不可）
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} year
 * @param {number} month
 */
function applyBackground(sheet, year, month) {
  var students = sortStudents_(getStudentsForMonth_(year, month));
  var dates = getLessonDates(year, month);
  var fc = ROSTER.FIXED_COLS;

  if (students.length === 0 || dates.length === 0) return;

  var valueMatrix = sheet.getRange(4, fc + 1, students.length, dates.length).getValues();

  var backgrounds = students.map(function(st, si) {
    var isOnLeave = st.enrollmentStatus === '休会';
    return dates.map(function(date, di) {
      var cellVal = String(valueMatrix[si][di] || '').trim();
      if (cellVal === '振') return ROSTER.COLOR.LIGHT_YELLOW;
      if (isOnLeave) return ROSTER.COLOR.GRAY;
      var wd = weekdayOfDate_(date);
      return arrayContainsWeekday_(st.regularWeekdays, wd)
        ? ROSTER.COLOR.WHITE
        : ROSTER.COLOR.GRAY;
    });
  });

  sheet.getRange(4, fc + 1, students.length, dates.length)
    .setBackgrounds(backgrounds);
}

// =============================================
// ログ → 名簿反映
// =============================================

/**
 * 出欠ログ全体を読み込み、各月の名簿シートを最新状態に更新する
 * 同一生徒×同一日付に複数エントリがある場合は最新タイムスタンプを優先する
 */
function updateFromLog() {
  var ss = getSpreadsheet_();
  var logSh = ss.getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  if (!logSh || logSh.getLastRow() < 2) return;

  var logData = logSh.getDataRange().getValues();
  var lc = CONFIG.LOG_COL;

  // 「生徒ID_yyyy-M-d」をキーとして最新エントリのみを保持するマップ
  var latestMap = {};

  for (var i = 1; i < logData.length; i++) {
    var row = logData[i];
    var sid = String(row[lc.STUDENT_ID - 1] || '').trim();
    var dateVal = row[lc.LESSON_DATE - 1];
    if (!sid || !dateVal) continue;

    var d = toDateOnly_(dateVal);
    if (!d) continue;

    var dateKey = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var key = sid + '_' + dateKey;

    var ts = row[lc.FORM_TIMESTAMP - 1];
    var tsMs = ts instanceof Date ? ts.getTime() : 0;

    if (!latestMap[key] || tsMs > latestMap[key].tsMs) {
      var rawStatus = String(row[lc.STATUS - 1] || '').trim();
      latestMap[key] = {
        tsMs:      tsMs,
        studentId: sid,
        date:      d,
        status:    ROSTER.STATUS_DISPLAY[rawStatus] || rawStatus
      };
    }
  }

  // エントリから更新対象の年月を収集
  var monthSet = {};
  Object.keys(latestMap).forEach(function(key) {
    var entry = latestMap[key];
    var mKey = entry.date.getFullYear() + '_' + (entry.date.getMonth() + 1);
    monthSet[mKey] = true;
  });

  // 各月の名簿シートを更新
  Object.keys(monthSet).forEach(function(mKey) {
    var parts = mKey.split('_');
    var year  = Number(parts[0]);
    var month = Number(parts[1]);
    var sheetName = getRosterSheetName_(year, month);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // ログ反映前に必ずグレー背景を確定させる（旧シートの色ずれも解消）
    applyBackground(sheet, year, month);
    updateSheetFromLogMap_(sheet, year, month, latestMap);
    ensureRosterMakeupConditionalFormat_(sheet, year, month);
  });
}

/**
 * latestMap を使って特定月の名簿シートを更新する
 */
function updateSheetFromLogMap_(sheet, year, month, latestMap) {
  var students = sortStudents_(getStudentsForMonth_(year, month));
  var dates    = getLessonDates(year, month);
  var fc       = ROSTER.FIXED_COLS;

  if (students.length === 0 || dates.length === 0) return;

  // 日付キー → { col, day } マップ（背景チェックを避けるため曜日も格納）
  var dateInfoMap = {};
  for (var i = 0; i < dates.length; i++) {
    var d = dates[i];
    var k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    dateInfoMap[k] = { col: fc + 1 + i, day: weekdayOfDate_(d) };
  }

  // 生徒ID → { row, regularDays } マップ
  var studentMap = {};
  for (var j = 0; j < students.length; j++) {
    studentMap[students[j].studentId] = {
      row:         4 + j,
      regularDays: students[j].regularWeekdays
    };
  }

  // 更新値を収集（行→列→値）
  var updates = {};
  Object.keys(latestMap).forEach(function(key) {
    var entry = latestMap[key];
    var dateKey  = entry.date.getFullYear() + '-' + (entry.date.getMonth() + 1) + '-' + entry.date.getDate();
    var dateInfo = dateInfoMap[dateKey];
    var stInfo   = studentMap[entry.studentId];
    if (!dateInfo || !stInfo) return;

    // グレーセルへの書き込みをスキップ（レギュラー外）
    if (!arrayContainsWeekday_(stInfo.regularDays, dateInfo.day)) return;

    if (!updates[stInfo.row]) updates[stInfo.row] = {};
    updates[stInfo.row][dateInfo.col] = entry.status;
  });

  // 一括書き込み（値 + 背景色）
  Object.keys(updates).forEach(function(rowStr) {
    var row = Number(rowStr);
    Object.keys(updates[rowStr]).forEach(function(colStr) {
      var rawStatus  = updates[rowStr][colStr];
      var displayVal = ROSTER.STATUS_DISPLAY[rawStatus] || rawStatus;
      // ステータス別の背景色
      var bg;
      if (rawStatus === '振替出席') {
        bg = ROSTER.COLOR.LIGHT_YELLOW;
      } else if (rawStatus === '休会') {
        bg = ROSTER.COLOR.GRAY;
      } else {
        bg = ROSTER.COLOR.WHITE; // 出席・欠席は白
      }
      var cell = sheet.getRange(row, Number(colStr));
      cell.setValue(displayVal).setBackground(bg);
    });
  });

  // 集計を更新
  updateSummaryForSheet_(sheet, year, month);
}

// =============================================
// 集計更新
// =============================================

/**
 * 全名簿シートの集計列を更新する
 */
function updateSummary() {
  var ss = getSpreadsheet_();
  ss.getSheets().forEach(function(sheet) {
    var name = sheet.getName();
    if (name.indexOf(ROSTER.SHEET_SUFFIX) < 0) return;
    var m = name.match(/^(\d{4})年(\d{1,2})月/);
    if (!m) return;
    updateSummaryForSheet_(sheet, Number(m[1]), Number(m[2]));
  });
}

/**
 * 特定月の名簿シートの集計列（欠席・振替使用・振替残・未入力）を更新する
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} year
 * @param {number} month
 */
function updateSummaryForSheet_(sheet, year, month) {
  var students = sortStudents_(getStudentsForMonth_(year, month));
  var dates    = getLessonDates(year, month);
  var fc       = ROSTER.FIXED_COLS;
  var sc       = ROSTER.SUMMARY_COL_COUNT;

  if (students.length === 0 || dates.length === 0) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var numRows = students.length;
  var numCols = dates.length;

  // セル値を一括取得（背景色はレギュラー曜日で判定するため不要）
  var values = sheet.getRange(4, fc + 1, numRows, numCols).getValues();

  var summaryData = [];
  for (var s = 0; s < numRows; s++) {
    var st2      = students[s];
    var isLeave2 = (st2.enrollmentStatus === '休会');
    var absent = 0, makeup = 0, missing = 0;
    for (var d = 0; d < numCols; d++) {
      // 背景色ではなくレギュラー曜日で集計対象か判定
      var isRegular2 = !isLeave2 &&
                       arrayContainsWeekday_(st2.regularWeekdays, weekdayOfDate_(dates[d]));
      if (!isRegular2) continue;

      var val      = String(values[s][d] || '').trim();
      var dateOnly = new Date(dates[d].getFullYear(), dates[d].getMonth(), dates[d].getDate());

      if (val === '欠') absent++;
      if (val === '振替') makeup++;
      if (val === '' && dateOnly <= today) missing++;
    }
    summaryData.push([absent, makeup, absent - makeup, missing]);
  }

  sheet.getRange(4, fc + dates.length + 1, numRows, sc).setValues(summaryData);

  // 曜日別人数サマリーを更新
  buildDaySummary_(sheet, year, month, students);

  // 変更点メモ欄を更新
  buildMemo_(sheet, year, month, students.length);
}

// =============================================
// 変更点メモ欄
// =============================================

function formatMemoCourseDaysLine_(course, weekdays) {
  var wStr =
    weekdays && weekdays.length ? weekdays.join(',') + '曜' : '';
  var cStr = String(course || '').trim();
  if (cStr && wStr) return cStr + ' ' + wStr;
  if (cStr) return cStr;
  if (wStr) return wStr;
  return '';
}

/**
 * 名簿の右下（曜日別人数サマリーと同じ行・集計列エリア）に
 * 当月の変更点サマリーをメモとして描画する
 *
 * 表示内容:
 *   - 新規入会（生徒マスタの enrollMonth が当月）
 *   - 退会 / 休会 / コース変更 / レギュラー曜日変更
 *     （メンバー変更予定シートの当月エントリから生成）
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} year
 * @param {number} month
 * @param {number} numStudents 生徒行数（行位置の計算用）
 */
function buildMemo_(sheet, year, month, numStudents) {
  var fc    = ROSTER.FIXED_COLS;
  var dates = getLessonDates(year, month);
  var sc    = ROSTER.SUMMARY_COL_COUNT;

  // 配置: 曜日別サマリーと同じ開始行
  // 終端列 = 最終集計列（W列相当）、開始列 = W列から10列遡ったM列相当
  var startRow   = 4 + numStudents + 2;
  var memoEndCol = fc + dates.length + sc; // 最終集計列（W列相当）
  var colSpan    = 11;                     // M列〜W列 = 11列分
  var startCol   = memoEndCol - colSpan + 1; // M列相当から開始

  var memoLines = [];

  // ── 1. 新規入会（マスタの enrollMonth が当月） ───────────
  try {
    var allStudents = loadMasterRecords_();
    allStudents.forEach(function(st) {
      if (!st.enrollMonth) return;
      var em = parseApplyMonth_(st.enrollMonth);
      if (em && em.year === year && em.month === month) {
        memoLines.push('★ 新規入会: ' + st.name + '（' + month + '月〜）');
      }
    });
  } catch (e) { /* マスタ読み込み失敗は無視 */ }

  // ── 2. 当月の変更予定（変更予定シート） ──────────────────
  try {
    var changes = loadScheduledChanges_();
    changes.forEach(function(ch) {
      if (ch.applyYear !== year || ch.applyMonth !== month) return;

      var suffix = '（' + month + '月〜）';
      var pm = prevYearMonth_(year, month);
      var beforeState = getEffectiveMemberStateForMonth_(ch.studentId, pm.year, pm.month);
      var beforeTxt = beforeState
        ? formatMemoCourseDaysLine_(beforeState.course, beforeState.regularWeekdays)
        : '';

      if (isWithdrawnEnrollmentStatus_(ch.status)) {
        memoLines.push(
          '■ 退会: ' +
            ch.name +
            (beforeTxt ? ' ' + beforeTxt + ' → 退会' : '') +
            suffix
        );
      } else if (String(ch.status || '').trim() === '休会') {
        memoLines.push(
          '▲ 休会: ' +
            ch.name +
            (beforeTxt ? ' ' + beforeTxt + ' → 休会' : '') +
            suffix
        );
      } else {
        var afterCourse = ch.course
          ? ch.course
          : beforeState
          ? beforeState.course
          : '';
        var afterDays =
          ch.regularDays !== null
            ? ch.regularDays
            : beforeState
            ? beforeState.regularWeekdays
            : [];
        var afterTxt = formatMemoCourseDaysLine_(afterCourse, afterDays);
        if (beforeTxt && afterTxt) {
          memoLines.push(
            '◆ 変更: ' + ch.name + ' ' + beforeTxt + ' → ' + afterTxt + suffix
          );
        } else if (afterTxt) {
          memoLines.push('◆ 変更: ' + ch.name + ' → ' + afterTxt + suffix);
        }
      }
    });
  } catch (e) { /* 変更予定読み込み失敗は無視 */ }

  // ── メモ欄を描画 ──────────────────────────────────────────
  var contentRows = Math.max(memoLines.length, 1);
  var totalRows   = 1 + contentRows; // ヘッダー + 内容行

  // 既存内容を広めにクリア
  sheet.getRange(startRow, startCol, totalRows + 4, colSpan)
    .clearContent()
    .clearFormat()
    .setBackground('#ffffff');

  // ヘッダー
  sheet.getRange(startRow, startCol, 1, colSpan).merge()
    .setValue('【メモ】' + year + '年' + month + '月の変更点')
    .setBackground('#34a853')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setFontSize(9)
    .setHorizontalAlignment('left')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(startRow, 20);

  // 内容行（1情報1行、折り返しなし・フォント9pt）
  if (memoLines.length === 0) {
    sheet.getRange(startRow + 1, startCol, 1, colSpan).merge()
      .setValue('この月の変更はありません')
      .setBackground('#f8f8f8')
      .setFontColor('#999999')
      .setFontSize(9)
      .setWrap(false)
      .setHorizontalAlignment('left')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(startRow + 1, 20);
  } else {
    for (var i = 0; i < memoLines.length; i++) {
      sheet.getRange(startRow + 1 + i, startCol, 1, colSpan).merge()
        .setValue(memoLines[i])
        .setBackground('#ffffff')
        .setFontSize(9)
        .setWrap(false)          // 折り返しなし = 1行に収める
        .setHorizontalAlignment('left')
        .setVerticalAlignment('middle');
      sheet.setRowHeight(startRow + 1 + i, 20);
    }
  }

  // 枠線
  sheet.getRange(startRow, startCol, totalRows, colSpan)
    .setBorder(true, true, true, true, false, false,
               '#aaaaaa', SpreadsheetApp.BorderStyle.SOLID);
}

// =============================================
// 未入力チェック・アラート
// =============================================

/**
 * 当月の名簿を走査し、今日以前の未入力セルに薄赤を設定してメール通知する
 * （入力済みセルの薄赤は解除する）
 */
function checkMissing() {
  var jst = getNowJST_();
  var ss  = getSpreadsheet_();
  var sheetName = getRosterSheetName_(jst.year, jst.month);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var students = sortStudents_(getStudentsForMonth_(jst.year, jst.month));
  var dates    = getLessonDates(jst.year, jst.month);
  var fc       = ROSTER.FIXED_COLS;

  if (students.length === 0 || dates.length === 0) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var numRows = students.length;
  var numCols = dates.length;

  var values  = sheet.getRange(4, fc + 1, numRows, numCols).getValues();
  var newBGs  = [];
  var missingList = [];

  for (var s = 0; s < numRows; s++) {
    var st     = students[s];
    var isLeave = (st.enrollmentStatus === '休会');
    var rowBGs  = [];

    for (var d = 0; d < numCols; d++) {
      var val      = String(values[s][d] || '').trim();
      var dateOnly = new Date(dates[d].getFullYear(), dates[d].getMonth(), dates[d].getDate());
      // 背景色ではなくレギュラー曜日で判定（過去の色設定に依存しない）
      var isRegular = !isLeave &&
                      arrayContainsWeekday_(st.regularWeekdays, weekdayOfDate_(dates[d]));

      if (val === '振') {
        rowBGs.push(ROSTER.COLOR.LIGHT_YELLOW);
      } else if (!isRegular) {
        rowBGs.push(ROSTER.COLOR.GRAY);
      } else if (val === '' && dateOnly <= today) {
        rowBGs.push(ROSTER.COLOR.LIGHT_RED);
        missingList.push({
          name: st.name,
          date: (dates[d].getMonth() + 1) + '/' + dates[d].getDate(),
          day:  weekdayOfDate_(dates[d])
        });
      } else {
        rowBGs.push(ROSTER.COLOR.WHITE);
      }
    }
    newBGs.push(rowBGs);
  }

  sheet.getRange(4, fc + 1, numRows, numCols).setBackgrounds(newBGs);

  // メール通知
  if (missingList.length > 0) {
    var email = String(getSetting_(CONFIG.SETTINGS_KEYS.ALERT_EMAIL, '') || '').trim();
    if (email) {
      var lines = missingList.map(function(m) {
        return '  ・' + m.name + '  ' + m.date + '(' + m.day + '曜)';
      }).join('\n');
      var formUrl = getAttendanceFormUrl_();
      try {
        MailApp.sendEmail({
          to: email,
          subject: '【育成クラス出欠名簿】未入力アラート ' + missingList.length + '件 (' +
                   jst.year + '年' + jst.month + '月)',
          body: '出欠未入力のレギュラー日があります。\n\n' + lines +
                '\n\nスプレッドシートを開き、出欠を入力してください。\n' +
                '（入力済みのものは翌日の自動チェックで解除されます）\n\n' +
                '【育成クラス出欠フォーム（記入はこちら）】\n' +
                formUrl +
                '\n'
        });
        var notifSh = ss.getSheetByName(CONFIG.SHEET.NOTIFICATIONS);
        if (notifSh) {
          notifSh.appendRow([new Date(), '名簿_未入力アラート',
            missingList.length + '件', 'SENT']);
        }
      } catch (err) {
        Logger.log('checkMissing メール送信エラー: ' + err.message);
      }
    }
  }

  Logger.log('未入力チェック完了: ' + missingList.length + '件');
}

// =============================================
// シート自動生成・保証
// =============================================

/**
 * 今月・翌月の名簿シートを確認し、存在しなければ作成する（UI向け）
 */
/**
 * 指定月に対して +N ヶ月を計算する
 * @param {number} year
 * @param {number} month
 * @param {number} addMonths
 * @returns {{year: number, month: number}}
 */
function addMonths_(year, month, addMonths) {
  var total = (month - 1) + addMonths;
  return {
    year:  year + Math.floor(total / 12),
    month: (total % 12) + 1
  };
}

/**
 * 今月〜翌々月（3ヶ月分）の名簿シートを確認/作成してログを反映する（メニュー用）
 */
function ensureSheets() {
  var jst = getNowJST_();
  ensureSheets_internal_({ rebuildLayout: true });
  updateFromLog();

  var m1 = addMonths_(jst.year, jst.month, 1);
  var m2 = addMonths_(jst.year, jst.month, 2);
  SpreadsheetApp.getUi().alert(
    '今月・来月・再来月の名簿シートを確認/作成しました。\n' +
    '・' + getRosterSheetName_(jst.year, jst.month) + '\n' +
    '・' + getRosterSheetName_(m1.year, m1.month) + '\n' +
    '・' + getRosterSheetName_(m2.year, m2.month)
  );
}

/**
 * 今月〜翌々月（3ヶ月分）シート保証（トリガーから呼び出す内部用）
 */
function ensureSheets_internal_(opt) {
  var jst = getNowJST_();
  createSheetForMonth(jst.year, jst.month, opt);

  var m1 = addMonths_(jst.year, jst.month, 1);
  createSheetForMonth(m1.year, m1.month, opt);

  var m2 = addMonths_(jst.year, jst.month, 2);
  createSheetForMonth(m2.year, m2.month, opt);
}

/**
 * 月末自動作成（毎日トリガーから呼び出す）
 * 設定の「名簿自動作成開始日」以降の日に翌月・翌々月シートを作成する
 */
function autoCreateNextMonths() {
  var jst     = getNowJST_();
  var autoDay = Number(getSetting_(ROSTER.SETTINGS_KEY_AUTO_DAY, 25)) || 25;
  if (jst.day < autoDay) return;

  var m1 = addMonths_(jst.year, jst.month, 1);
  var m2 = addMonths_(jst.year, jst.month, 2);
  var light = { rebuildLayout: false };
  createSheetForMonth(m1.year, m1.month, light);
  createSheetForMonth(m2.year, m2.month, light);

  Logger.log('名簿自動作成: ' + m1.year + '年' + m1.month + '月, ' +
                               m2.year + '年' + m2.month + '月');
}

// =============================================
// 毎日バッチ処理（トリガーから呼び出す）
// =============================================

/**
 * 毎朝9時バッチ:
 * 1. 今月・翌月シートを保証
 * 2. ログを名簿へ反映
 * 3. 集計更新
 */
function rosterDailyUpdate_() {
  ensureSheets_internal_({ rebuildLayout: false });
  updateFromLog();
  updateSummary();
}

// =============================================
// 今月シートの再作成（UI向け）
// =============================================

/**
 * 今月の名簿シートを削除して再作成する
 * ※確認ダイアログあり。ログからの再反映も行う
 */
function recreateCurrentMonthRoster_() {
  var jst       = getNowJST_();
  var sheetName = getRosterSheetName_(jst.year, jst.month);
  var ss        = getSpreadsheet_();
  var ui        = SpreadsheetApp.getUi();

  var res = ui.alert(
    '確認',
    '「' + sheetName + '」を再作成します。\n' +
    '既存のセルデータは削除されますが、出欠ログから自動で再反映します。\n\n続けますか？',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  var existing = ss.getSheetByName(sheetName);
  if (existing) ss.deleteSheet(existing);

  createSheetForMonth(jst.year, jst.month);
  updateFromLog();

  ui.alert('「' + sheetName + '」を再作成しました。');
}

// =============================================
// トリガー登録（初回1回手動実行）
// =============================================

/**
 * 名簿関連の時間ベーストリガーを登録する
 * ・毎日8時: 月末チェック・翌月シート自動作成
 * ・毎日9時: ログ反映・集計更新
 * （既存の同名トリガーは先に削除してから再登録）
 */
function installRosterTriggers_() {
  var targets = ['autoCreateNextMonths', 'rosterDailyUpdate_'];
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (targets.indexOf(t.getHandlerFunction()) >= 0) {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('autoCreateNextMonths')
    .timeBased().everyDays(1).atHour(8)
    .inTimezone(CONFIG.TIMEZONE).create();

  ScriptApp.newTrigger('rosterDailyUpdate_')
    .timeBased().everyDays(1).atHour(9)
    .inTimezone(CONFIG.TIMEZONE).create();

  SpreadsheetApp.getUi().alert(
    '名簿トリガーを登録しました。\n' +
    '・毎日8時: 翌月シートの自動作成\n' +
    '・毎日9時: ログ反映・集計更新'
  );
}
