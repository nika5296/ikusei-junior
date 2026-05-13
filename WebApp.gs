/**
 * 保護者向け閲覧（トークンURL）
 * ・HTML: 従来どおり ?token=…
 * ・JSON API（Next.js 等）: ?token=…&format=json
 */

function doGet(e) {
  try {
    return doGetMain_(e);
  } catch (err) {
    if (e && e.parameter && String(e.parameter.format || '').toLowerCase() === 'json') {
      return renderJsonError_(String(err));
    }
    return HtmlService.createHtmlOutput(
      '<h2 style="color:red">エラーが発生しました</h2><pre>' +
        String(err) +
        '\n' +
        (err.stack || '') +
        '</pre>'
    )
      .setTitle('エラー')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

function isJsonRequest_(e) {
  if (!e || !e.parameter) return false;
  return String(e.parameter.format || '').toLowerCase() === 'json';
}

function doGetMain_(e) {
  var model = buildStudentViewModel_(e);
  if (isJsonRequest_(e)) {
    return renderJsonFromModel_(model);
  }
  return renderHtmlFromModel_(model);
}

/**
 * 画面テンプレート・JSON API 共通のデータ組み立て（計算ロジックは従来どおり）
 */
function buildStudentViewModel_(e) {
  var token = '';
  if (e && e.parameter && e.parameter.token) {
    token = normalizeToken_(e.parameter.token);
  }

  var reservationUrl = resolveReservationUrl_();
  var logoUrl = getSurgeAssetUrl_('kamakura-green-logo.png');
  var bearLeftUrl = getSurgeAssetUrl_('bear-left.png');
  var bearRightUrl = getSurgeAssetUrl_('bear-right.png');

  var base = {
    error: '',
    name: '',
    remainingMain: '',
    remainingSuffix: '',
    remainingHasUnit: false,
    updated: '',
    reservationUrl: reservationUrl,
    definitionHtml: '',
    logoUrl: logoUrl,
    bearLeftUrl: bearLeftUrl,
    bearRightUrl: bearRightUrl
  };

  if (!token) {
    base.error = 'token が指定されていません。';
    return base;
  }

  var master = loadMasterRecords_();
  var st = findStudentByToken_(master, token);
  if (!st) {
    base.error = '無効なURLです。';
    return base;
  }

  var sum = findSummaryForStudent_(st.studentId);
  var remParts = buildRemainingParts_(sum.remaining);

  base.error = '';
  base.name = st.name;
  base.remainingMain = remParts.main;
  base.remainingSuffix = remParts.suffix;
  base.remainingHasUnit = remParts.hasUnit;
  base.updated = sum.updated;
  base.definitionHtml = getMakeupDefinitionHtml_();
  return base;
}

function renderJsonFromModel_(m) {
  var payload = {
    ok: !m.error,
    error: m.error || '',
    name: m.name,
    remainingMain: m.remainingMain,
    remainingSuffix: m.remainingSuffix,
    remainingHasUnit: m.remainingHasUnit,
    updated: m.updated,
    reservationUrl: m.reservationUrl,
    definitionHtml: m.definitionHtml,
    assets: {
      logoUrl: m.logoUrl,
      bearLeftUrl: m.bearLeftUrl,
      bearRightUrl: m.bearRightUrl
    }
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function renderJsonError_(message) {
  var payload = {
    ok: false,
    error: message,
    name: '',
    remainingMain: '',
    remainingSuffix: '',
    remainingHasUnit: false,
    updated: '',
    reservationUrl: '',
    definitionHtml: '',
    assets: { logoUrl: '', bearLeftUrl: '', bearRightUrl: '' }
  };
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function renderHtmlFromModel_(m) {
  var tpl = getWebTemplate_();
  tpl.data = {
    error: m.error,
    name: m.name,
    remainingMain: m.remainingMain,
    remainingSuffix: m.remainingSuffix,
    remainingHasUnit: m.remainingHasUnit,
    updated: m.updated,
    reservationUrl: m.reservationUrl,
    definitionHtml: m.definitionHtml
  };
  tpl.logoUrl = m.logoUrl;
  tpl.bearLeftUrl = m.bearLeftUrl;
  tpl.bearRightUrl = m.bearRightUrl;
  return tpl
    .evaluate()
    .setTitle('鎌倉グリーン｜振替残数')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 振替残数表示：数値なら「大きい数字＋小さい回」、それ以外は1要素のみ
 */
function buildRemainingParts_(remaining) {
  var raw = remaining;
  if (raw === null || raw === undefined || raw === '') {
    return { main: '—', suffix: '', hasUnit: false };
  }
  if (typeof raw === 'number' && !isNaN(raw)) {
    var s = raw % 1 === 0 ? String(raw) : String(raw);
    return { main: s, suffix: '回', hasUnit: true };
  }
  var str = String(raw).trim();
  if (str === '—' || str === '未集計') {
    return { main: str, suffix: '', hasUnit: false };
  }
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return { main: str, suffix: '回', hasUnit: true };
  }
  return { main: str, suffix: '', hasUnit: false };
}

/**
 * 設定シートの「予約ページURL」優先。未設定なら鎌倉グリーンの振替予約（reserva.be）
 */
function resolveReservationUrl_() {
  var u = String(getSetting_(CONFIG.SETTINGS_KEYS.RESERVATION_URL, '') || '').trim();
  if (u) {
    return u;
  }
  return CONFIG.DEFAULT_RESERVATION_URL;
}

/** 振替残数の定義（HTML。<?!= ?> 用・静的文言のみ） */
function getMakeupDefinitionHtml_() {
  return (
    '<p class="mb-1.5 last:mb-0">レギュラーレッスンを欠席or雨天等でレッスンが中止になった場合は<span class="whitespace-nowrap">振替</span>がたまります。</p>' +
    '<p class="mb-1.5 last:mb-0"><span class="whitespace-nowrap">振替予約</span>した日に出席した時点で残数が<span class="whitespace-nowrap">1つ</span>減ります。</p>' +
    '<p class="mb-0">→予約しただけでは減りません。</p>'
  );
}

function findSummaryForStudent_(studentId) {
  var sh = getSpreadsheet_().getSheetByName(CONFIG.SHEET.SUMMARY);
  if (!sh) {
    return { remaining: '—', updated: '—' };
  }
  var values = sh.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]) === studentId) {
      return {
        remaining: values[i][4],
        updated: values[i][5] instanceof Date ? formatDateTimeDisplay_(values[i][5]) : String(values[i][5] || '')
      };
    }
  }
  return { remaining: '未集計', updated: '—' };
}

function formatDateTimeDisplay_(d) {
  /** H:mm … 時は先頭ゼロなし（例: 2026-04-11 8:00） */
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd H:mm');
}

function getWebTemplate_() {
  return HtmlService.createTemplateFromFile('WebApp');
}

/**
 * Surge のベースURL（設定の styles.css のパスから算出）
 */
function getSurgeBaseUrl_() {
  var fromSheet = getSetting_(CONFIG.SETTINGS_KEYS.SURGE_STYLESHEET, '');
  var css = fromSheet && String(fromSheet).trim() ? String(fromSheet).trim() : CONFIG.SURGE_STYLESHEET_URL;
  if (/styles\.css\s*$/i.test(css)) {
    return css.replace(/styles\.css\s*$/i, '');
  }
  var slash = css.lastIndexOf('/');
  if (slash >= 0) {
    return css.substring(0, slash + 1);
  }
  return css;
}

/**
 * Surge に置いた画像など（ロゴ・ベア）
 */
function getSurgeAssetUrl_(filename) {
  var base = getSurgeBaseUrl_();
  if (base.slice(-1) !== '/') {
    base += '/';
  }
  return base + filename;
}
