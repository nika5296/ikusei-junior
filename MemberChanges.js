/**
 * メンバー変更予定管理
 *
 * 月ごとのレギュラー曜日・コース・在籍状況の変更を管理する。
 * 変更は「メンバー変更予定」シートに記入し、名簿作成時に自動適用される。
 *
 * 対応ケース:
 *   - 翌月からコース変更（週1→週2、曜日変更など）
 *   - 月途中での新規入会（次月分から名簿に反映）
 *   - 休会（名簿に残るが全セルグレー・人数には含む）
 *   - 退会（名簿から完全に非表示）
 */

var CHANGES_SHEET_NAME = 'メンバー変更予定';

var CHANGES_COL = {
  CHANGE_ID:    1, // 変更ID（自動採番 or 手入力）
  STUDENT_ID:   2, // 生徒ID（マスタと一致させる）
  NAME:         3, // 氏名（参照用 – 自動補完）
  APPLY_MONTH:  4, // 適用年月（YYYY/M 例: 2026/5）
  REGULAR_DAYS: 5, // レギュラー曜日（新）カンマ区切り。空欄=変更なし
  COURSE:       6, // コース（新）空欄=変更なし
  STATUS:       7, // 在籍状況: 在籍 / 休会 / 退会
  NOTE:         8  // メモ
};

// =============================================
// データ読み込み
// =============================================

/**
 * 変更予定シートから全エントリを読み込む
 * @returns {Array<Object>} 変更オブジェクトの配列
 */
function loadScheduledChanges_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CHANGES_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];

  var values = sh.getDataRange().getValues();
  var changes = [];

  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var studentId   = String(row[CHANGES_COL.STUDENT_ID - 1] || '').trim();
    var applyRawVal = row[CHANGES_COL.APPLY_MONTH - 1];
    if (!studentId || applyRawVal === '' || applyRawVal === null || applyRawVal === undefined) continue;

    // 適用年月を解析
    // Google Sheets が "2026/6" を Date に自動変換する場合も考慮する
    var applyYear = 0, applyMonth = 0;
    if (applyRawVal instanceof Date && !isNaN(applyRawVal.getTime())) {
      applyYear  = applyRawVal.getFullYear();
      applyMonth = applyRawVal.getMonth() + 1;
    } else {
      // 文字列形式: YYYY/M, YYYY年M月, YYYY-M
      var applyRaw   = String(applyRawVal).trim();
      var normalized = applyRaw.replace(/年/g, '/').replace(/月/g, '').replace(/-/g, '/');
      var parts      = normalized.split('/');
      if (parts.length >= 2) {
        applyYear  = Number(parts[0]);
        applyMonth = Number(parts[1]);
      }
    }
    if (!applyYear || !applyMonth) continue;

    var daysRaw = String(row[CHANGES_COL.REGULAR_DAYS - 1] || '').trim();
    var regularDays = daysRaw ? parseRegularWeekdays_(daysRaw) : null; // null = 変更なし

    changes.push({
      changeId:   String(row[CHANGES_COL.CHANGE_ID - 1] || '').trim(),
      studentId:  studentId,
      name:       String(row[CHANGES_COL.NAME - 1] || '').trim(),
      applyYear:  applyYear,
      applyMonth: applyMonth,
      regularDays: regularDays,
      course:     String(row[CHANGES_COL.COURSE - 1] || '').trim() || null,
      status:     String(row[CHANGES_COL.STATUS - 1] || '').trim() || null,
      note:       String(row[CHANGES_COL.NOTE - 1] || '').trim()
    });
  }

  return changes;
}

// =============================================
// 月別有効生徒リスト生成
// =============================================

/**
 * 年月文字列（例: "2026/5", "2026年5月", "2026-5"）を
 * { year, month } オブジェクトに変換する。解析できない場合は null を返す。
 * @param {string} raw
 * @returns {{year: number, month: number}|null}
 */
function parseApplyMonth_(raw) {
  if (!raw) return null;
  var s = String(raw).trim()
    .replace(/年/g, '/').replace(/月/g, '').replace(/-/g, '/');
  var parts = s.split('/');
  if (parts.length < 2) return null;
  var y = Number(parts[0]);
  var m = Number(parts[1]);
  if (!y || !m) return null;
  return { year: y, month: m };
}

/**
 * メンバー変更予定の「在籍状況」が退会か（空白のゆらぎを吸収）
 */
function isWithdrawnEnrollmentStatus_(status) {
  var s = String(status || '').replace(/[\s　]/g, '').trim();
  return s === '退会' || s === '退會';
}

/**
 * 指定月に有効な生徒リストを返す
 *
 * 処理順:
 *   1. 生徒マスタを読み込む（入会月フィルタ適用）
 *   2. 変更予定シートから「指定月以前の最新変更」をオーバーレイ
 *   3. 退会者を除外
 *
 * @param {number} year
 * @param {number} month
 * @returns {Array<Object>} 有効な生徒オブジェクト（enrollmentStatus フィールド付き）
 */
function getStudentsForMonth_(year, month) {
  var base    = loadMasterRecords_();
  var changes = loadScheduledChanges_();

  // 生徒IDごとに「指定月以前で最新」の変更を抽出
  var latestMap = {};
  for (var i = 0; i < changes.length; i++) {
    var ch = changes[i];
    var isApplicable = ch.applyYear < year ||
                       (ch.applyYear === year && ch.applyMonth <= month);
    if (!isApplicable) continue;

    var prev = latestMap[ch.studentId];
    var isNewer = !prev ||
                  ch.applyYear > prev.applyYear ||
                  (ch.applyYear === prev.applyYear && ch.applyMonth > prev.applyMonth);
    if (isNewer) latestMap[ch.studentId] = ch;
  }

  // マスタ生徒に変更を適用
  var existingIds = {};
  var result = [];

  base.forEach(function(st) {
    existingIds[st.studentId] = true;

    // ── 入会月チェック: まだ入会していない生徒は除外 ──────
    if (st.enrollMonth) {
      var em = parseApplyMonth_(st.enrollMonth);
      if (em) {
        var notYetEnrolled = em.year > year || (em.year === year && em.month > month);
        if (notYetEnrolled) return;
      }
    }

    var ch = latestMap[st.studentId];

    var effective = {
      rowIndex:         st.rowIndex,
      studentId:        st.studentId,
      name:             st.name,
      course:           st.course,
      regularWeekdays:  st.regularWeekdays.slice(),
      openingBalance:   st.openingBalance,
      viewToken:        st.viewToken,
      tokenDisabled:    st.tokenDisabled,
      grade:            st.grade || '',
      enrollmentStatus: '在籍' // デフォルト
    };

    if (ch) {
      if (ch.regularDays !== null) effective.regularWeekdays = ch.regularDays;
      if (ch.course)               effective.course           = ch.course;
      if (ch.status)               effective.enrollmentStatus = ch.status;
    }

    if (isWithdrawnEnrollmentStatus_(effective.enrollmentStatus)) return;
    result.push(effective);
  });

  // 変更予定のみに存在する生徒（マスタ未登録）は新規扱い不可
  // → 新規入会は 新規入会受付シート→生徒マスタ の流れで完結させるため除外

  return result;
}

/**
 * 指定年月の直前月を返す（メモ欄の「変更元」用）
 */
function prevYearMonth_(year, month) {
  if (month > 1) return { year: year, month: month - 1 };
  return { year: year - 1, month: 12 };
}

/**
 * 1名分の「その月時点の」コース・レギュラー曜日・在籍状況（getStudentsForMonth_ と同じ合成ルール）
 * 入会前の月は null
 *
 * @param {string} studentId
 * @param {number} year
 * @param {number} month
 * @returns {{name:string,course:string,regularWeekdays:Array<string>,enrollmentStatus:string}|null}
 */
function getEffectiveMemberStateForMonth_(studentId, year, month) {
  var base = loadMasterRecords_();
  var st = null;
  for (var i = 0; i < base.length; i++) {
    if (base[i].studentId === studentId) {
      st = base[i];
      break;
    }
  }
  if (!st) return null;

  if (st.enrollMonth) {
    var em = parseApplyMonth_(st.enrollMonth);
    if (em) {
      var notYetEnrolled = em.year > year || (em.year === year && em.month > month);
      if (notYetEnrolled) return null;
    }
  }

  var changes = loadScheduledChanges_();
  var latestMap = {};
  for (var j = 0; j < changes.length; j++) {
    var ch = changes[j];
    var isApplicable =
      ch.applyYear < year || (ch.applyYear === year && ch.applyMonth <= month);
    if (!isApplicable) continue;
    var prev = latestMap[ch.studentId];
    var isNewer =
      !prev ||
      ch.applyYear > prev.applyYear ||
      (ch.applyYear === prev.applyYear && ch.applyMonth > prev.applyMonth);
    if (isNewer) latestMap[ch.studentId] = ch;
  }

  var ch = latestMap[studentId];
  var course = st.course;
  var regularWeekdays = st.regularWeekdays.slice();
  var enrollmentStatus = '在籍';

  if (ch) {
    if (ch.regularDays !== null) regularWeekdays = ch.regularDays;
    if (ch.course) course = ch.course;
    if (ch.status) enrollmentStatus = ch.status;
  }

  return {
    name: st.name,
    course: course,
    regularWeekdays: regularWeekdays,
    enrollmentStatus: enrollmentStatus
  };
}

// =============================================
// 曜日別人数サマリー
// =============================================

/**
 * 名簿シートに曜日別人数サマリーを描画する
 *
 * 配置: 生徒データ行の下（2行あけて）、左端から5列
 *
 * | 日程 | 定員 | 人数 | 休会 | 空き |
 * | 月   |  10  |   N  |   N  |   N  |
 * | 火   |  10  |   N  |   N  |   N  |
 * | 木   |  10  |   N  |   N  |   N  |
 * | 金   |  10  |   N  |   N  |   N  |
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} year
 * @param {number} month
 * @param {Array<Object>} students  getStudentsForMonth_ の戻り値
 */
function buildDaySummary_(sheet, year, month, students) {
  var capacity = Number(getSetting_('1クラス定員', 10)) || 10;
  var targetDays = CONFIG.TARGET_WEEKDAYS; // ['月', '火', '木', '金']

  // 曜日ごとに 人数 / 休会 を集計
  var counts = {};
  targetDays.forEach(function(wd) { counts[wd] = { total: 0, onLeave: 0 }; });

  // 描画位置（生徒行の下 +2行 = セパレーター分）
  var startRow = 4 + students.length + 2;
  var startCol = 1;
  var colCount = 5;

  // ── 旧データをクリア（生徒数変化時に残留するゴミ行を除去）──
  // startRow（サマリー先頭行）以降のみを広めにクリアし、学生行は絶対に触らない
  sheet.getRange(startRow, startCol, targetDays.length + 8, colCount)
    .clearContent()
    .clearFormat()
    .setBackground('#ffffff');

  students.forEach(function(st) {
    st.regularWeekdays.forEach(function(wd) {
      if (!counts[wd]) return;
      counts[wd].total++;
      if (st.enrollmentStatus === '休会') counts[wd].onLeave++;
    });
  });

  // ヘッダー行
  sheet.getRange(startRow, startCol, 1, colCount)
    .setValues([['日程', '定員', '人数', '休会', '空き']])
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setBackground('#4a86e8')
    .setFontColor('#ffffff');

  // データ行
  var dataRows = targetDays.map(function(wd) {
    var c = counts[wd];
    return [wd, capacity, c.total, c.onLeave, capacity - c.total];
  });
  sheet.getRange(startRow + 1, startCol, dataRows.length, colCount)
    .setValues(dataRows)
    .setHorizontalAlignment('center')
    .setBackground('#ffffff');

  // 空き=0 の行を橙色ハイライト
  for (var r = 0; r < dataRows.length; r++) {
    if (dataRows[r][4] <= 0) {
      sheet.getRange(startRow + 1 + r, startCol, 1, colCount)
        .setBackground('#fce5cd'); // 満員
    }
  }

  // 罫線
  sheet.getRange(startRow, startCol, dataRows.length + 1, colCount)
    .setBorder(true, true, true, true, true, true,
      '#aaaaaa', SpreadsheetApp.BorderStyle.SOLID);

  // 行高
  sheet.setRowHeight(startRow, 22);
  for (var i = 1; i <= dataRows.length; i++) {
    sheet.setRowHeight(startRow + i, 22);
  }

  // 列幅（既存の固定列幅に揃える）
  // ※ 列幅は applyLayout 側で設定済みのためここでは変更しない
}

// =============================================
// 変更予定シートの初期化・管理UI
// =============================================

/** 例示行の行番号（この行以下は実データ） */
var CHANGES_DATA_START_ROW = 7;

/**
 * 「メンバー変更予定」シートを作成し、入力ガイド・プルダウンを設定する
 *
 * 構成:
 *   1行目   : ヘッダー（青）
 *   2〜6行目 : 入力例（薄黄・斜体）※システム処理対象外
 *   7行目〜  : 実データ入力欄（プルダウン付き）
 */
function initChangesSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CHANGES_SHEET_NAME);
  var isNew = !sh;
  if (isNew) {
    sh = ss.insertSheet(CHANGES_SHEET_NAME);
  } else {
    var ui = SpreadsheetApp.getUi();
    var res = ui.alert('確認',
      '「' + CHANGES_SHEET_NAME + '」シートは既に存在します。\n' +
      'ヘッダー・入力例・プルダウンを再設定しますか？\n（実データ行は変更しません）',
      ui.ButtonSet.YES_NO);
    if (res !== ui.Button.YES) return;
  }

  // ── ヘッダー（1行目）────────────────────────────────────
  var headers = [
    '変更ID', '生徒ID（自動）', '氏名（プルダウン）', '適用年月',
    'レギュラー曜日（新）', 'コース（新）', '在籍状況', 'メモ'
  ];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4a86e8')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // ── 入力例行（2〜6行目）────────────────────────────────
  // ※ 生徒IDは空欄にすることでシステム処理から除外される
  var exampleRows = [
    ['', '', '← 名前をプルダウンで選ぶと生徒IDが自動入力されます', '例: 2026/6',
     '例: 月,木', '例: 週2', '在籍/休会/退会', '★ 2〜6行目は入力例です（処理されません）'],
    ['', '', '山田太郎', '2026/6', '月,木', '週2', '在籍', 'コース変更（週1→週2）'],
    ['', '', '新入生 花子', '2026/6', '火', '週1', '在籍', '新規入会（マスタ未登録でもOK）'],
    ['', '', '鈴木次郎', '2026/6', '', '', '休会', '6月のみ休会。曜日は変更なし'],
    ['', '', '佐藤三郎', '2026/7', '', '', '退会', '7月から退会・名簿に表示されなくなる']
  ];
  sh.getRange(2, 1, exampleRows.length, headers.length).setValues(exampleRows);

  // 例示行のスタイル（薄黄背景・斜体・グレー文字）
  sh.getRange(2, 1, exampleRows.length, headers.length)
    .setBackground('#fff9c4')
    .setFontColor('#999999')
    .setFontStyle('italic');
  // 1行目の注釈セルを強調
  sh.getRange(2, 8)
    .setFontColor('#e67c73')
    .setFontWeight('bold')
    .setFontStyle('normal');

  // ── 実データ行（7行目〜）の初期化 ─────────────────────
  var maxRows = 200; // プルダウン・書式の適用上限行
  sh.getRange(CHANGES_DATA_START_ROW, 1, maxRows, headers.length)
    .setBackground('#ffffff')
    .setFontColor('#000000')
    .setFontStyle('normal')
    .setFontWeight('normal');

  // ── 氏名列（C列）にプルダウンを設定 ───────────────────
  setNameDropdown_(sh);

  // ── 在籍状況列（G列）にプルダウンを設定 ───────────────
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['在籍', '休会', '退会'], true)
    .setAllowInvalid(false)
    .setHelpText('在籍 / 休会 / 退会 から選択してください')
    .build();
  sh.getRange(CHANGES_DATA_START_ROW, CHANGES_COL.STATUS, maxRows, 1)
    .setDataValidation(statusRule);

  // ── 列幅 ──────────────────────────────────────────────
  sh.setColumnWidth(1, 75);   // 変更ID
  sh.setColumnWidth(2, 95);   // 生徒ID（自動）
  sh.setColumnWidth(3, 140);  // 氏名
  sh.setColumnWidth(4, 90);   // 適用年月
  sh.setColumnWidth(5, 155);  // レギュラー曜日
  sh.setColumnWidth(6, 90);   // コース
  sh.setColumnWidth(7, 80);   // 在籍状況
  sh.setColumnWidth(8, 260);  // メモ

  sh.setFrozenRows(1);
  sh.setRowHeight(1, 24);
  for (var r = 2; r <= 6; r++) { sh.setRowHeight(r, 22); }

  SpreadsheetApp.getUi().alert(
    '「' + CHANGES_SHEET_NAME + '」シートを設定しました。\n\n' +
    '【使い方】\n' +
    '① C列（氏名）のプルダウンで生徒を選ぶ\n' +
    '  → B列（生徒ID）が自動で入力されます\n' +
    '② 在籍状況が「新規入会」の場合は C列に直接名前を入力（プルダウン外もOK）\n' +
    '③ D列に適用年月を入力（例: 2026/6）\n' +
    '④ 空欄の列は変更なし\n\n' +
    '2〜6行目は入力例です。削除しても構いません。\n\n' +
    '入力後は「📋 月別出欠名簿」→「今月の名簿シートを再作成」で反映されます。'
  );
}

/**
 * 変更予定シートの氏名列（C列）にマスタ名一覧のプルダウンを設定する
 * initChangesSheet_ から呼ばれるほか、マスタ更新後に単独でも実行可能
 */
function setNameDropdown_(sh) {
  var ss = getSpreadsheet_();
  if (!sh) sh = ss.getSheetByName(CHANGES_SHEET_NAME);
  if (!sh) return;

  var masterSh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!masterSh) return;

  // マスタの氏名列（B列）のデータ行範囲
  var lastMasterRow = Math.max(masterSh.getLastRow(), 2);
  var nameRange = masterSh.getRange(2, CONFIG.MASTER_COL.NAME, lastMasterRow - 1, 1);

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(nameRange, true) // プルダウン表示あり
    .setAllowInvalid(true)                // 直接入力も許可（新規入会者対応）
    .setHelpText('生徒マスタの名前一覧。新規入会は直接入力も可能です。')
    .build();

  var maxRows = 200;
  sh.getRange(CHANGES_DATA_START_ROW, CHANGES_COL.NAME, maxRows, 1)
    .setDataValidation(rule);
}

// =============================================
// 生徒ID自動生成
// =============================================

/**
 * 生徒マスタの既存IDを読み取り、次の連番IDを生成する
 * 形式: S001, S002, ... （現在の最大番号 +1）
 *
 * @returns {string} 例: "S024"
 */
function generateNextStudentId_() {
  var ss = getSpreadsheet_();
  var masterSh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!masterSh || masterSh.getLastRow() < 2) return 'S001';

  var lastRow = masterSh.getLastRow();
  var idValues = masterSh
    .getRange(2, CONFIG.MASTER_COL.STUDENT_ID, lastRow - 1, 1)
    .getValues();

  var maxNum = 0;
  idValues.forEach(function(row) {
    var id = String(row[0] || '').trim();
    var m = id.match(/^[Ss](\d+)$/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });

  var nextNum = maxNum + 1;
  return 'S' + String(nextNum).padStart(3, '0'); // 例: S001, S024
}

// =============================================
// 新規生徒追加ウィザード
// =============================================

/**
 * ダイアログ形式で新規生徒の情報を入力し、
 * 生徒マスタに自動IDで追加するウィザード
 *
 * 入力項目: 氏名 / 学年 / レギュラー曜日 / コース
 * 生徒IDは自動生成（現在の最大番号 +1）
 */
function addNewStudentWizard_() {
  var ui = SpreadsheetApp.getUi();

  // ── 氏名（必須）──────────────────────────────────────
  var nameRes = ui.prompt(
    '新規生徒追加 ① 氏名',
    '氏名を入力してください（必須）\n例: 山田 太郎',
    ui.ButtonSet.OK_CANCEL
  );
  if (nameRes.getSelectedButton() !== ui.Button.OK) return;
  var name = nameRes.getResponseText().trim();
  if (!name) { ui.alert('氏名が入力されませんでした。処理を中断します。'); return; }

  // 重複チェック
  var master = loadMasterRecords_();
  for (var i = 0; i < master.length; i++) {
    if (master[i].name === name) {
      var dup = ui.alert(
        '確認',
        '「' + name + '」はすでにマスタに登録されています。\n' +
        '（生徒ID: ' + master[i].studentId + '）\n\n続けて追加しますか？',
        ui.ButtonSet.YES_NO
      );
      if (dup !== ui.Button.YES) return;
      break;
    }
  }

  // ── 学年 ──────────────────────────────────────────────
  var gradeRes = ui.prompt(
    '新規生徒追加 ② 学年',
    '学年を入力してください\n例: 中1 / 5 / 中3\n（空欄でも可）',
    ui.ButtonSet.OK_CANCEL
  );
  if (gradeRes.getSelectedButton() !== ui.Button.OK) return;
  var grade = gradeRes.getResponseText().trim();

  // ── レギュラー曜日（必須）────────────────────────────
  var daysRes = ui.prompt(
    '新規生徒追加 ③ レギュラー曜日',
    'レギュラー曜日をカンマ区切りで入力してください（必須）\n' +
    '例: 月  /  月,木  /  火,金\n' +
    '（対応: 月・火・木・金）',
    ui.ButtonSet.OK_CANCEL
  );
  if (daysRes.getSelectedButton() !== ui.Button.OK) return;
  var days = daysRes.getResponseText().trim();
  if (!days) { ui.alert('レギュラー曜日が入力されませんでした。処理を中断します。'); return; }

  // ── コース ────────────────────────────────────────────
  var courseRes = ui.prompt(
    '新規生徒追加 ④ コース',
    'コースを入力してください\n例: 週1 / 週2 / 週3\n（空欄でも可）',
    ui.ButtonSet.OK_CANCEL
  );
  if (courseRes.getSelectedButton() !== ui.Button.OK) return;
  var course = courseRes.getResponseText().trim();

  // ── 生徒IDを自動生成してマスタに追加 ─────────────────
  var newId = generateNextStudentId_();
  var ss = getSpreadsheet_();
  var masterSh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!masterSh) {
    ui.alert('生徒マスタシートが見つかりません。先に初期化を実行してください。');
    return;
  }

  // マスタ列順: studentId / 氏名 / コース / レギュラー曜日 / 初期残振替 / viewToken / token無効 / メモ / 学年
  masterSh.appendRow([newId, name, course, days, 0, '', '', '', grade]);

  // 変更予定シートのプルダウンを更新
  var changesSh = ss.getSheetByName(CHANGES_SHEET_NAME);
  if (changesSh) setNameDropdown_(changesSh);

  ui.alert(
    '✅ 新規生徒を追加しました\n\n' +
    '生徒ID  : ' + newId + '\n' +
    '氏名    : ' + name + '\n' +
    '学年    : ' + (grade || '（未入力）') + '\n' +
    '曜日    : ' + days + '\n' +
    'コース  : ' + (course || '（未入力）') + '\n\n' +
    '生徒マスタに追加されました。\n' +
    'トークン発行・URL出力は「⚙️ 初期設定・管理」メニューから行ってください。'
  );
}

// =============================================
// onEdit: マスタへの氏名入力 & 変更予定の氏名選択を処理
// =============================================

/**
 * セル編集時の自動処理（シンプルトリガー）
 *
 * 【生徒マスタ】
 *   氏名（B列）に入力があり、生徒ID（A列）が空 → 次の連番IDを自動付与
 *
 * 【変更予定シート】
 *   氏名（C列）でプルダウン選択 → 生徒ID（B列）をマスタから自動入力
 *   氏名を消した場合 → 生徒IDもクリア
 *   マスタ未登録の名前 → 生徒IDは空欄のまま（新規入会として処理）
 *
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 */

/**
 * 操作パネルのボタン関数を名前で呼び出す
 * GASでは this[funcName] がグローバル関数を指さないため、明示的マップで対応
 * @param {string} funcName
 */
function dispatchPanelFunc_(funcName) {
  var dispatch = {
    'runAllUpdates_':               runAllUpdates_,
    'ensureSheets':                 ensureSheets,
    'updateFromLog':                updateFromLog,
    'updateSummary':                updateSummary,
    'checkMissing':                 checkMissing,
    'processAllPendingEnrollments_': processAllPendingEnrollments_,
    'recreateCurrentMonthRoster_':  recreateCurrentMonthRoster_
  };
  var fn = dispatch[funcName];
  if (fn) {
    fn();
  } else {
    throw new Error('未定義のパネル関数: ' + funcName);
  }
}

function onEdit(e) {
  var range     = e.range;
  var sheet     = range.getSheet();
  var sheetName = sheet.getName();
  var col       = range.getColumn();
  var row       = range.getRow();

  // ── 操作パネル: チェックボックスをクリック → 対応関数を実行 ──
  if (sheetName === PANEL_SHEET_NAME) {
    if (col !== 1) return;                        // A列のみ
    if (row < PANEL_DATA_ROW) return;             // ヘッダー行は無視
    if (e.value !== 'TRUE') return;               // チェックが入った瞬間のみ

    // チェックをすぐ外す（見た目をボタンらしく）
    sheet.getRange(row, 1).setValue(false);

    // 実行するボタンのキーを取得（B列）
    var btnKey = sheet.getRange(row, 2).getValue();
    // ラベルからキーを逆引き
    var funcName = null;
    for (var bi = 0; bi < PANEL_BUTTONS.length; bi++) {
      if (PANEL_BUTTONS[bi].label === btnKey) {
        funcName = PANEL_BUTTONS[bi].func;
        break;
      }
    }

    if (funcName) {
      setPanelStatus_(PANEL_BUTTONS[bi].key, '⏳ 実行中...');
      try {
        dispatchPanelFunc_(funcName);
        if (funcName !== 'runAllUpdates_') {
          setPanelStatus_(PANEL_BUTTONS[bi].key, '✅ 完了');
        }
      } catch (err) {
        setPanelStatus_(PANEL_BUTTONS[bi].key, '⚠️ ' + err.message);
        SpreadsheetApp.getUi().alert('⚠️ エラー:\n' + err.message);
      }
    }
    return;
  }

  // ── 生徒マスタ: 氏名入力 → 生徒ID自動付与 ─────────────
  if (sheetName === CONFIG.SHEET.MASTER) {
    if (col === CONFIG.MASTER_COL.NAME && row > 1) {
      var masterName = String(e.value || '').trim();
      if (!masterName) return;

      var idCell = sheet.getRange(row, CONFIG.MASTER_COL.STUDENT_ID);
      // すでにIDが入っている場合は上書きしない
      if (String(idCell.getValue() || '').trim()) return;

      idCell.setValue(generateNextStudentId_());
    }
    return;
  }

  // ── 新規入会受付シート: 必須3項目入力完了 → 自動処理 ───
  if (sheetName === NEW_ENROLLMENT_SHEET_NAME) {
    if (row < NE_DATA_START_ROW) return; // ヘッダー・説明行は無視

    // 処理済みチェック
    var neStatus = String(sheet.getRange(row, NE_COL.STATUS).getValue() || '').trim();
    if (neStatus === NE_STATUS_DONE) return;

    // 必須3項目がすべて入力されたら自動処理
    var neName = String(sheet.getRange(row, NE_COL.NAME).getValue()         || '').trim();
    var neDays = String(sheet.getRange(row, NE_COL.REGULAR_DAYS).getValue() || '').trim();
    var neDate = sheet.getRange(row, NE_COL.START_DATE).getValue();

    if (neName && neDays && neDate) {
      if (processEnrollmentRow_(sheet, row)) {
        syncAttendanceBooksAfterMemberChange_();
      }
    }
    return;
  }

  // ── 変更予定シート: 氏名・適用内容の変更 → 生徒ID補完 + 名簿同期 ──
  if (sheetName === CHANGES_SHEET_NAME && row >= CHANGES_DATA_START_ROW) {
    if (col === CHANGES_COL.NAME) {
      var inputName = String(e.value || '').trim();
      if (!inputName) {
        sheet.getRange(row, CHANGES_COL.STUDENT_ID).clearContent();
      } else {
        var master = loadMasterRecords_();
        for (var i = 0; i < master.length; i++) {
          if (master[i].name === inputName) {
            sheet.getRange(row, CHANGES_COL.STUDENT_ID).setValue(master[i].studentId);
            break;
          }
        }
      }
      scheduleAttendanceSyncAfterMemberEdit_();
      return;
    }
    if (col >= CHANGES_COL.STUDENT_ID && col <= CHANGES_COL.NOTE) {
      scheduleAttendanceSyncAfterMemberEdit_();
    }
    return;
  }
}

/**
 * 変更予定シートのプルダウン（氏名一覧）をマスタ最新状態に更新する
 * 生徒マスタに新しい生徒を追加した後に実行する
 */
function refreshNameDropdown_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CHANGES_SHEET_NAME);
  if (!sh) {
    SpreadsheetApp.getUi().alert('変更予定シートが見つかりません。先にシートを作成してください。');
    return;
  }
  setNameDropdown_(sh);
  SpreadsheetApp.getUi().alert('氏名プルダウンをマスタの最新状態に更新しました。');
}

/**
 * 変更予定シートの生徒IDをマスタの氏名から一括補完する
 * （氏名はあるが生徒IDが空の行を補完したいときに手動実行）
 */
function fillChangeSheetNames_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CHANGES_SHEET_NAME);
  if (!sh || sh.getLastRow() < CHANGES_DATA_START_ROW) {
    SpreadsheetApp.getUi().alert('変更予定シートに実データ行がありません。');
    return;
  }

  var master = loadMasterRecords_();
  var idByName = {};
  master.forEach(function(st) { idByName[st.name] = st.studentId; });

  var lastRow = sh.getLastRow();
  if (lastRow < CHANGES_DATA_START_ROW) return;

  var dataRows = lastRow - CHANGES_DATA_START_ROW + 1;
  var ids   = sh.getRange(CHANGES_DATA_START_ROW, CHANGES_COL.STUDENT_ID, dataRows, 1).getValues();
  var names = sh.getRange(CHANGES_DATA_START_ROW, CHANGES_COL.NAME,       dataRows, 1).getValues();
  var filled = 0;

  for (var i = 0; i < names.length; i++) {
    var name = String(names[i][0] || '').trim();
    var id   = String(ids[i][0]   || '').trim();
    if (name && !id && idByName[name]) {
      ids[i][0] = idByName[name];
      filled++;
    }
  }

  sh.getRange(CHANGES_DATA_START_ROW, CHANGES_COL.STUDENT_ID, dataRows, 1).setValues(ids);
  SpreadsheetApp.getUi().alert('生徒IDを補完しました（' + filled + '件）。');
}
