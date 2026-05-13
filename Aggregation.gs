/**
 * 集計：残振替 = 初期残振替 + レギュラー欠席による発生 − 振替出席消化
 */

function recomputeSummary_() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);
    recomputeSummaryCore_();
  } finally {
    lock.releaseLock();
  }
}

function recomputeSummaryCore_() {
  var ss = getSpreadsheet_();
  var master = loadMasterRecords_();
  var logSh = ss.getSheetByName(CONFIG.SHEET.ATTENDANCE_LOG);
  if (!logSh) throw new Error('出欠ログがありません。');

  var logs = logSh.getDataRange().getValues();
  if (logs.length < 2) {
    writeSummaryRows_(master, {});
    return;
  }

  var lc = CONFIG.LOG_COL;
  var agg = {};

  for (var i = 1; i < logs.length; i++) {
    var row = logs[i];
    var sid = String(row[lc.STUDENT_ID - 1] || '').trim();
    if (!sid) continue;
    if (!agg[sid]) {
      agg[sid] = { gen: 0, use: 0 };
    }
    var genCell = row[lc.ABSENT_CREDIT_ELIGIBLE - 1];
    var useCell = row[lc.MAKEUP_CONSUMED - 1];
    var isGen = genCell === true || String(genCell).toLowerCase() === 'true' || genCell === 1;
    var isUse = useCell === true || String(useCell).toLowerCase() === 'true' || useCell === 1;
    if (isGen) agg[sid].gen += 1;
    if (isUse) agg[sid].use += 1;
  }

  writeSummaryRows_(master, agg);
}

function writeSummaryRows_(master, agg) {
  var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.SUMMARY);
  var now = new Date();
  var rows = [];
  for (var i = 0; i < master.length; i++) {
    var m = master[i];
    var a = agg[m.studentId] || { gen: 0, use: 0 };
    var rem = m.openingBalance + a.gen - a.use;
    rows.push([m.studentId, m.name, a.gen, a.use, rem, now]);
  }
  sh.clearContents();
  sh.getRange(1, 1, 1, 6).setValues([['studentId', '氏名', '振替発生回数', '振替消化回数', '残振替回数', '最終集計日時']]);
  if (rows.length) {
    sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}
