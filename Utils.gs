/**
 * 共通ユーティリティ
 */

/** ウェブアプリ・トリガー実行時に参照するブックを明示する（clasp 単一デプロイで複製ブックを読む際に必須） */
var SCRIPT_PROP_WEB_APP_DATA_SPREADSHEET_ID = 'WEB_APP_DATA_SPREADSHEET_ID';

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var overrideId = String(props.getProperty(SCRIPT_PROP_WEB_APP_DATA_SPREADSHEET_ID) || '').trim();
  if (overrideId) {
    try {
      return SpreadsheetApp.openById(overrideId);
    } catch (e) {}
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function registerWebAppDataSpreadsheetFromActive_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var id = ss.getId();
  PropertiesService.getScriptProperties().setProperty(SCRIPT_PROP_WEB_APP_DATA_SPREADSHEET_ID, id);
  SpreadsheetApp.getUi().alert(
    'Webアプリのデータ参照先をこのブックに設定しました。\n\n' +
      'スプレッドシートID:\n' +
      id +
      '\n\n※ このメニューが動いた「このApps Scriptプロジェクト」のスクリプトプロパティに保存されています。' +
      'clasp で別プロジェクトをデプロイしている場合は、そのプロジェクトのエディタ→プロジェクトの設定→スクリプトのプロパティで、' +
      'キー WEB_APP_DATA_SPREADSHEET_ID に同じIDを手入力してください。\n\n' +
      '※ ウェブアプリを再デプロイ後、「URLリスト」を出力し直してください。'
  );
}

function clearWebAppDataSpreadsheetOverride_() {
  PropertiesService.getScriptProperties().deleteProperty(SCRIPT_PROP_WEB_APP_DATA_SPREADSHEET_ID);
  SpreadsheetApp.getUi().alert('Webアプリのデータ参照先の上書きを解除しました。');
}

/**
 * 日付のみ（時刻切り捨て）東京基準
 */
function toDateOnly_(d) {
  if (d instanceof Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  if (typeof d === 'string') {
    var s = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split('-');
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    }
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
      var p2 = s.split('/');
      return new Date(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]));
    }
  }
  return null;
}

/**
 * 氏名照合用（全角スペースを半角に揃え、連続空白を1つに）
 */
function normalizeNameForMatch_(s) {
  return String(s == null ? '' : s)
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Googleフォームが作る回答シートのよくある名前（順に検索）
 */
function getFormAnswerSheetAliases_() {
  return [
    CONFIG.SHEET.FORM_ANSWERS,
    'フォームの回答',
    'フォームの回答 1',
    'フォーム回答 1',
    'Form Responses',
    'Form Response',
    'Form_Responses',
    'Form_Response'
  ];
}

/**
 * フォーム回答シート（既定名・Google標準の別名）
 * シート名の前後スペースを無視して照合する
 */
function getFormAnswersSheet_() {
  var ss = getSpreadsheet_();
  var aliases = getFormAnswerSheetAliases_().map(function(a) { return a.trim(); });
  var sheets = ss.getSheets();
  for (var j = 0; j < sheets.length; j++) {
    var name = sheets[j].getName().trim();
    for (var i = 0; i < aliases.length; i++) {
      if (name === aliases[i]) return sheets[j];
    }
  }
  return null;
}

function isFormAnswersSheetName_(name) {
  var n = String(name == null ? '' : name).trim();
  var aliases = getFormAnswerSheetAliases_().map(function(a) { return a.trim(); });
  for (var i = 0; i < aliases.length; i++) {
    if (n === aliases[i]) return true;
  }
  return false;
}

/**
 * 「生徒名 [山田太郎]」形式から括弧内の氏名を取り出す（該当しなければ全体を正規化）
 */
function extractNameFromFormHeader_(header) {
  var s = String(header == null ? '' : header).trim();
  var m = s.match(/^生徒名\s*[\[［]\s*(.+?)\s*[\]］]\s*$/);
  if (m) return normalizeNameForMatch_(m[1]);
  return normalizeNameForMatch_(s);
}

/**
 * 1行目から列インデックスへ（生徒列の別名・空白正規化込み）
 */
function buildFormHeaderToIndex_(headers) {
  var map = {};
  function put(key, colIdx) {
    var k = normalizeNameForMatch_(key);
    if (!k) return;
    if (map[k] === undefined) map[k] = colIdx;
  }
  for (var c = 0; c < headers.length; c++) {
    var raw = String(headers[c] == null ? '' : headers[c]).trim();
    if (!raw) continue;
    put(raw, c);
    var inner = extractNameFromFormHeader_(raw);
    if (inner) put(inner, c);
  }
  return map;
}

function findStudentColumnInFormHeaders_(headerToIndex, studentName) {
  var name = String(studentName || '').trim();
  if (headerToIndex[name] !== undefined) return headerToIndex[name];
  var n = normalizeNameForMatch_(name);
  if (n && headerToIndex[n] !== undefined) return headerToIndex[n];
  return undefined;
}

/**
 * フォームの実施日セルの値を yyyy-MM-dd に統一（アラート照合用）
 */
function parseFormLessonDateToIso_(cell) {
  var d = toDateOnly_(cell);
  if (d) return formatDateIso_(d);
  if (cell instanceof Date && !isNaN(cell.getTime())) {
    return formatDateIso_(toDateOnly_(cell));
  }
  var s = String(cell == null ? '' : cell).trim();
  if (!s) return '';
  var tryDate = new Date(s);
  if (!isNaN(tryDate.getTime())) {
    return formatDateIso_(toDateOnly_(tryDate));
  }
  return '';
}

function formatDateIso_(d) {
  if (!d) return '';
  var tz = CONFIG.TIMEZONE;
  return Utilities.formatDate(d, tz, 'yyyy-MM-dd');
}

/**
 * マスタの「レギュラー曜日」文字列を配列へ（例: "月,木" → ["月","木"]）
 */
function parseRegularWeekdays_(cell) {
  if (cell == null || cell === '') return [];
  return String(cell)
    .split(/[,、\s]+/)
    .map(function (x) {
      return normalizeWeekdayLabel_(x);
    })
    .filter(function (x) {
      return x;
    });
}

/**
 * 指定日の曜日（月火木金…）を返す
 */
function weekdayOfDate_(date) {
  var d = toDateOnly_(date);
  if (!d) return '';
  var js = d.getDay();
  return CONFIG.JS_DAY_TO_WEEKDAY[js] || '';
}

/**
 * 配列内に曜日が含まれるか
 */
function arrayContainsWeekday_(arr, wd) {
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === wd) return true;
  }
  return false;
}

function uuid_() {
  return Utilities.getUuid();
}
