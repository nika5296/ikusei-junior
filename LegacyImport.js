/**
 * 既存表（4月名簿など）からコピペした作業シート → 生徒マスタへドラフト反映
 */

function importLegacyRowsToMaster_() {
  var ss = getSpreadsheet_();
  var src = ss.getSheetByName(CONFIG.SHEET.LEGACY_IMPORT);
  var dst = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!src || !dst) {
    throw new Error('既存表取込シートまたは生徒マスタがありません。');
  }

  var last = src.getLastRow();
  if (last < 3) {
    throw new Error('既存表取込シートの3行目以降にデータを貼り付けてください（2行目は見出し）。');
  }

  var data = src.getRange(3, 1, last, 3).getValues();
  var masterLast = dst.getLastRow();
  var existingIds = dst.getRange(2, CONFIG.MASTER_COL.STUDENT_ID, Math.max(masterLast, 2), CONFIG.MASTER_COL.STUDENT_ID).getValues();
  var maxNum = 0;
  for (var i = 0; i < existingIds.length; i++) {
    var m = String(existingIds[i][0] || '').match(/^S(\d+)$/);
    if (m) {
      maxNum = Math.max(maxNum, Number(m[1]));
    }
  }

  var rows = [];
  for (var j = 0; j < data.length; j++) {
    var name = String(data[j][0] || '').trim();
    if (!name) continue;
    maxNum += 1;
    var id = 'S' + ('0000' + maxNum).slice(-4);
    var reg = String(data[j][1] || '').trim();
    var course = String(data[j][2] || '').trim();
    rows.push([id, name, course, reg, 0, generateToken_(), false, '取込ドラフト']);
  }

  if (!rows.length) {
    throw new Error('取り込める行がありません（氏名が空）。');
  }

  var start = dst.getLastRow() + 1;
  dst.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  SpreadsheetApp.getUi().alert(rows.length + '名を生徒マスタに追記しました。内容・studentIdを確認し、サンプル行があれば削除してください。');
}

