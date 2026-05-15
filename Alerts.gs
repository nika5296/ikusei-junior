/**
 * 未入力アラート（フォーム回答の有無）。
 * 朝バッチ（9時）では名簿メールを送った日は呼ばれず、こちらのみ送る場合がある。
 */

function dailyAttendanceAlert_() {
  var jst = getNowJST_();
  var today = new Date(jst.year, jst.month - 1, jst.day);
  var yesterday = new Date(today.getTime());
  yesterday.setDate(yesterday.getDate() - 1);
  var yWd = weekdayOfDate_(yesterday);
  /** 月・火・木・金のレッスン日のみ（水・土・日は対象外） */
  if (!arrayContainsWeekday_(CONFIG.TARGET_WEEKDAYS, yWd)) {
    return;
  }

  var skipRaw = String(getSetting_(CONFIG.SETTINGS_KEYS.SKIP_ALERT_DATES, '') || '');
  var yIso = formatDateIso_(yesterday);
  if (skipRaw) {
    var parts = skipRaw.split(/[,、\s]+/);
    for (var i = 0; i < parts.length; i++) {
      if (String(parts[i]).trim() === yIso) {
        return;
      }
    }
  }

  if (hasAttendanceSubmissionFor_(yesterday, yWd)) {
    return;
  }

  var email = String(getSetting_(CONFIG.SETTINGS_KEYS.ALERT_EMAIL, '') || '').trim();
  if (!email) {
    return;
  }

  var subject = '【育成クラス】前日（' + yIso + '・' + yWd + '曜）の出欠が未入力の可能性があります';
  var formUrl = getAttendanceFormUrl_();
  var body =
    '育成クラス出欠・振替管理システム（V1）からの自動通知です。\n\n' +
    '・対象日: ' +
    yIso +
    '（' +
    yWd +
    '曜）\n' +
    '・確認内容: Googleフォームの「フォーム回答」シートに、上記実施日・所属曜日の回答行が見つかりませんでした。\n\n' +
    '休校・実施なしの場合は、設定シートの「未入力アラート除外日」に ' +
    yIso +
    ' を追加すると、以降この通知を抑止できます。\n\n' +
    'スプレッドシートを開き、フォームから出欠を入力済みかご確認ください。\n\n' +
    '【育成クラス出欠フォーム（記入はこちら）】\n' +
    formUrl +
    '\n';

  MailApp.sendEmail({ to: email, subject: subject, body: body });

  var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.NOTIFICATIONS);
  if (sh) {
    sh.appendRow([new Date(), '未入力アラート', subject, 'SENT']);
  }
}

/**
 * フォーム回答に、該当実施日・所属曜日の行があるか
 */
function hasAttendanceSubmissionFor_(lessonDate, classWeekday) {
  var sh = getFormAnswersSheet_();
  if (!sh || sh.getLastRow() < 2) {
    return false;
  }

  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var headerToIndex = buildFormHeaderToIndex_(headers);

  var lessonHeader = getSetting_(CONFIG.SETTINGS_KEYS.FORM_HEADER_LESSON_DATE, '実施日');
  var weekdayHeader = getSetting_(CONFIG.SETTINGS_KEYS.FORM_HEADER_CLASS_WEEKDAY, '所属曜日');
  var lessonCol = findStudentColumnInFormHeaders_(headerToIndex, lessonHeader);
  var weekdayCol = findStudentColumnInFormHeaders_(headerToIndex, weekdayHeader);
  var deriveWeekday = settingIsTrue_(CONFIG.SETTINGS_KEYS.FORM_DERIVE_WEEKDAY_FROM_LESSON_DATE, true);

  if (lessonCol === undefined) {
    return false;
  }
  if (weekdayCol === undefined && !deriveWeekday) {
    return false;
  }

  var targetIso = formatDateIso_(lessonDate);
  var wantWd = normalizeWeekdayLabel_(classWeekday);

  var last = sh.getLastRow();
  var vals = sh.getRange(2, 1, last, sh.getLastColumn()).getValues();
  for (var r = 0; r < vals.length; r++) {
    var row = vals[r];
    var d = row[lessonCol];
    var iso = parseFormLessonDateToIso_(d);
    var wd;
    if (weekdayCol !== undefined) {
      wd = normalizeWeekdayLabel_(row[weekdayCol]);
    } else {
      var lessonD = toDateOnly_(d);
      if (!lessonD && d instanceof Date) lessonD = toDateOnly_(d);
      if (!lessonD && typeof d === 'string') {
        var tryDt = new Date(d);
        if (!isNaN(tryDt.getTime())) lessonD = toDateOnly_(tryDt);
      }
      wd = lessonD ? weekdayOfDate_(lessonD) : '';
    }
    if (iso === targetIso && wd === wantWd) {
      return true;
    }
  }
  return false;
}
