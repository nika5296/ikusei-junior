/**
 * 生徒マスタ読み込み・トークン発行
 */

function loadMasterRecords_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!sh) throw new Error('生徒マスタシートがありません。初期化を実行してください。');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var c = CONFIG.MASTER_COL;
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    var id = String(row[c.STUDENT_ID - 1] || '').trim();
    if (!id || id === 'studentId') continue;
    var name = String(row[c.NAME - 1] || '').trim();
    var course = String(row[c.COURSE - 1] || '').trim();
    var reg = parseRegularWeekdays_(row[c.REGULAR_WEEKDAYS - 1]);
    var opening = Number(row[c.OPENING_BALANCE - 1]) || 0;
    var token = normalizeToken_(row[c.VIEW_TOKEN - 1]);
    var disabledBool = isTokenDisabledValue_(row[c.TOKEN_DISABLED - 1]);
    var grade = c.GRADE ? String(row[c.GRADE - 1] || '').trim() : '';

    // 入会月: Google Sheets が "2026/5" を Date に自動変換する場合があるため
    // Date オブジェクトは直接年月を取り出し、文字列経由の変換を避ける
    var enrollMonth = '';
    if (c.ENROLL_MONTH) {
      var emRaw = row[c.ENROLL_MONTH - 1];
      if (emRaw instanceof Date && !isNaN(emRaw.getTime())) {
        enrollMonth = emRaw.getFullYear() + '/' + (emRaw.getMonth() + 1);
      } else if (emRaw) {
        enrollMonth = String(emRaw).trim();
      }
    }
    out.push({
      rowIndex: i + 1,
      studentId: id,
      name: name,
      course: course,
      regularWeekdays: reg,
      openingBalance: opening,
      viewToken: token,
      tokenDisabled: disabledBool,
      grade: grade,              // 学年（列9: 例 中1 / 中3）
      enrollMonth: enrollMonth   // 入会月（列10: 例 2026/5）。空なら全月対象
    });
  }
  return out;
}

function findStudentsForClassWeekday_(records, classWeekday) {
  var wd = normalizeWeekdayLabel_(classWeekday);
  var list = [];
  for (var i = 0; i < records.length; i++) {
    if (arrayContainsWeekday_(records[i].regularWeekdays, wd)) {
      list.push(records[i]);
    }
  }
  return list;
}

function findStudentByToken_(records, token) {
  if (!token) return null;
  var needle = normalizeToken_(token);
  if (!needle) return null;
  var matched = null;
  for (var i = 0; i < records.length; i++) {
    var candidate = normalizeToken_(records[i].viewToken);
    if (candidate === needle && !records[i].tokenDisabled) {
      if (matched) {
        // 同一token重複時は誤表示を避けるため無効扱い
        return null;
      }
      matched = records[i];
    }
  }
  return matched;
}

function normalizeToken_(token) {
  var s = String(token || '').trim().toLowerCase();
  if (!s) return '';
  var n = CONFIG.TOKEN_LENGTH || 40;

  if (new RegExp('^[a-z0-9]{' + n + '}$').test(s)) return s;

  var fromParam = s.match(new RegExp('[?&]token=([a-z0-9]{' + n + '})'));
  if (fromParam) return fromParam[1];

  var compact = s.replace(/[^a-z0-9]/g, '');
  if (new RegExp('^[a-z0-9]{' + n + '}$').test(compact)) return compact;

  return '';
}

function isTokenDisabledValue_(value) {
  var s = String(value == null ? '' : value).trim().toLowerCase();
  return value === true || value === 1 || s === 'true' || s === '1' || s === 'yes' || s === 'はい';
}

function buildReservedTokenMap_(sh, lastRow, cId, cTok) {
  var reserved = {};
  for (var r = 2; r <= lastRow; r++) {
    var id = String(sh.getRange(r, cId).getValue() || '').trim();
    if (!id) continue;
    var t = normalizeToken_(sh.getRange(r, cTok).getValue());
    if (t) reserved[t] = true;
  }
  return reserved;
}

function generateUniqueToken_(usedMap) {
  while (true) {
    var t = normalizeToken_(generateToken_());
    if (t && !usedMap[t]) {
      usedMap[t] = true;
      return t;
    }
  }
}

/**
 * 生徒マスタの有効tokenを重複・空欄なしに補正する
 * @return {{regenerated: number, duplicated: number}} 変更件数
 */
function ensureUniqueActiveTokens_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!sh) return { regenerated: 0, duplicated: 0 };

  var lastRow = sh.getLastRow();
  if (lastRow < 2) return { regenerated: 0, duplicated: 0 };

  var cId = CONFIG.MASTER_COL.STUDENT_ID;
  var cTok = CONFIG.MASTER_COL.VIEW_TOKEN;
  var cDisabled = CONFIG.MASTER_COL.TOKEN_DISABLED;
  var reserved = buildReservedTokenMap_(sh, lastRow, cId, cTok);
  var used = {};
  var regen = 0;
  var dup = 0;

  for (var r = 2; r <= lastRow; r++) {
    var id = String(sh.getRange(r, cId).getValue() || '').trim();
    if (!id) continue;

    var disabledCell = sh.getRange(r, cDisabled).getValue();
    var isDisabled = isTokenDisabledValue_(disabledCell);
    if (isDisabled) continue;

    var raw = sh.getRange(r, cTok).getValue();
    var token = normalizeToken_(raw);

    if (!token || used[token]) {
      if (token && used[token]) dup++;
      token = generateUniqueToken_(reserved);
      used[token] = true;
      sh.getRange(r, cTok).setValue(token);
      regen++;
    } else {
      used[token] = true;
      if (String(raw || '').trim() !== token) {
        sh.getRange(r, cTok).setValue(token);
      }
    }
  }
  return { regenerated: regen, duplicated: dup };
}

/** clasp / 手動で確定させた exec のベース URL（getUrl より優先。複製ブックで古い AKfy が返る問題の対策） */
var SCRIPT_PROP_CANONICAL_WEB_APP_EXEC_URL = 'CANONICAL_WEB_APP_EXEC_URL';

function normalizeWebAppExecUrl_(raw) {
  var u = String(raw == null ? '' : raw).trim().replace(/\/+\s*$/, '');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/i.test(u)) return '';
  return u;
}

function saveCanonicalWebAppExec_(normalizedUrl) {
  var u = normalizeWebAppExecUrl_(normalizedUrl);
  if (!u) throw new Error('無効な exec URL です');
  PropertiesService.getScriptProperties().setProperty(SCRIPT_PROP_CANONICAL_WEB_APP_EXEC_URL, u);
  try {
    setSettingValue_(CONFIG.SETTINGS_KEYS.WEBAPP_BASE_URL, u);
  } catch (e2) {}
}

/**
 * clasp deploy / PowerShell が表示した …/exec を貼り付けて登録（設定シート・スクリプトプロパティの両方）
 */
function registerCanonicalWebAppExecUrl_() {
  var ui = SpreadsheetApp.getUi();
  var hint = '';
  try {
    var g = normalizeWebAppExecUrl_(ScriptApp.getService().getUrl());
    if (g) {
      hint =
        '\n\n※ ScriptApp.getService().getUrl() の値（参考です。複製ブックでは誤った古いデプロイになることがあります）:\n' +
        g;
    }
  } catch (e) {}
  var resp = ui.prompt(
    '正しい Web アプリ exec URL の登録',
    'clasp-demo.ps1 -Deploy の出力にある …/exec の URL をそのまま貼ってください。' + hint,
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var pasted = normalizeWebAppExecUrl_(resp.getResponseText());
  if (!pasted) {
    ui.alert('URL が無効です。\n例: https://script.google.com/macros/s/AKfyxxxxxxxx/exec');
    return;
  }
  saveCanonicalWebAppExec_(pasted);
  ui.alert(
    '登録しました（この値が URL 生成で最優先になります）。\n\n次に「URLリスト出力」または「ベースURL差し替え」を実行してください。\n\n' +
      pasted
  );
}

/**
 * URL生成に使う exec のベース（末尾 /exec、クエリなし）
 * 優先順: スクリプトプロパティ CANONICAL → 設定シート → getUrl（※ getUrl だけでは自動で設定シートを上書きしない）
 */
function resolveWebAppBaseUrl_() {
  var propUrl = normalizeWebAppExecUrl_(
    PropertiesService.getScriptProperties().getProperty(SCRIPT_PROP_CANONICAL_WEB_APP_EXEC_URL)
  );
  if (propUrl) return propUrl;

  var settingsUrl = normalizeWebAppExecUrl_(getSetting_(CONFIG.SETTINGS_KEYS.WEBAPP_BASE_URL, ''));
  if (settingsUrl) return settingsUrl;

  var deployed = '';
  try {
    deployed = normalizeWebAppExecUrl_(ScriptApp.getService().getUrl());
  } catch (e) {}

  return deployed || '';
}

/** 保護者ポータル（Next.js / Vercel）のオリジン。末尾スラッシュは除去 */
function resolveParentPortalBaseUrl_() {
  var u = String(getSetting_(CONFIG.SETTINGS_KEYS.PARENT_PORTAL_BASE_URL, '') || '').trim();
  if (!u) return '';
  return u.replace(/\/+$/, '');
}

/**
 * 保護者向け閲覧URL（保護者ポータルURL が設定されていればそちらを優先）
 */
function buildStudentPublicViewUrl_(token, parentPortalBase, webAppUrl) {
  if (parentPortalBase) {
    return parentPortalBase + '/student/' + encodeURIComponent(token);
  }
  if (webAppUrl) {
    return webAppUrl + '?token=' + token;
  }
  return '（デプロイ後に取得）?token=' + token;
}

function findStudentById_(records, studentId) {
  for (var i = 0; i < records.length; i++) {
    if (records[i].studentId === studentId) return records[i];
  }
  return null;
}

/**
 * ランダムトークン生成（英小文字・数字）
 */
function generateToken_() {
  var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  var len = CONFIG.TOKEN_LENGTH;
  var out = '';
  for (var i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * 選択したマスタ行にトークンを新規付与（未選択ならデータ行すべて）
 */
function regenerateTokensForSelection_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  var range = sh.getActiveRange();
  var start = range ? range.getRow() : 2;
  var end = range ? range.getLastRow() : sh.getLastRow();
  if (start < 2) start = 2;
  var cTok = CONFIG.MASTER_COL.VIEW_TOKEN;
  var reserved = buildReservedTokenMap_(sh, sh.getLastRow(), CONFIG.MASTER_COL.STUDENT_ID, cTok);
  var cDisabled = CONFIG.MASTER_COL.TOKEN_DISABLED;
  for (var r = start; r <= end; r++) {
    var id = sh.getRange(r, CONFIG.MASTER_COL.STUDENT_ID).getValue();
    if (!id) continue;
    var disabled = sh.getRange(r, cDisabled).getValue();
    if (isTokenDisabledValue_(disabled)) continue;
    sh.getRange(r, cTok).setValue(generateUniqueToken_(reserved));
  }
  SpreadsheetApp.getUi().alert('トークンを更新しました（選択範囲）。');
}

/**
 * 生徒ごとの閲覧URLを「URLリスト」シートに出力
 * トークン未発行の生徒には自動で発行する
 */
function exportStudentUrls_() {
  var ss = getSpreadsheet_();
  var masterSh = ss.getSheetByName(CONFIG.SHEET.MASTER);
  if (!masterSh) throw new Error('生徒マスタシートがありません。');

  var fix = ensureUniqueActiveTokens_();

  // トークン未発行の生徒に発行
  var lastRow = masterSh.getLastRow();
  var cId  = CONFIG.MASTER_COL.STUDENT_ID;
  var cTok = CONFIG.MASTER_COL.VIEW_TOKEN;
  for (var r = 2; r <= lastRow; r++) {
    var id  = masterSh.getRange(r, cId).getValue();
    var tok = normalizeToken_(masterSh.getRange(r, cTok).getValue());
    var disabled = masterSh.getRange(r, CONFIG.MASTER_COL.TOKEN_DISABLED).getValue();
    if (id && !tok && !isTokenDisabledValue_(disabled)) {
      // 一意化は ensureUniqueActiveTokens_ で保証する
      masterSh.getRange(r, cTok).setValue(generateToken_());
    }
  }

  // コピー後に旧URLが残っていても、現デプロイURLを優先して使う
  var webAppUrl = resolveWebAppBaseUrl_();
  var parentPortalBase = resolveParentPortalBaseUrl_();

  // URLリストシートを作成（既存なら上書き）
  var listShName = 'URLリスト';
  var listSh = ss.getSheetByName(listShName);
  if (!listSh) {
    listSh = ss.insertSheet(listShName);
  } else {
    listSh.clearContents();
  }

  var headers = ['studentId', '氏名', '閲覧URL', '短縮URL'];
  listSh.getRange(1, 1, 1, headers.length).setValues([headers]);

  var master = loadMasterRecords_();
  var rows = [];
  var disabledCount = 0;
  for (var i = 0; i < master.length; i++) {
    var st = master[i];
    if (!st.studentId) continue;
    var url = '';
    if (st.tokenDisabled) {
      disabledCount++;
      url = '（token無効のため発行対象外）';
    } else {
      url = buildStudentPublicViewUrl_(st.viewToken, parentPortalBase, webAppUrl);
    }
    rows.push([st.studentId, st.name, url]);
  }

  if (rows.length > 0) {
    listSh.getRange(2, 1, rows.length, 3).setValues(rows);
    // URL列を広げて見やすく
    listSh.setColumnWidth(3, 500);
  }

  ss.setActiveSheet(listSh);

  if (!webAppUrl && !parentPortalBase) {
    SpreadsheetApp.getUi().alert(
      'URLリストを出力しました。\n\n' +
        '⚠ 閲覧URLのベースが未登録です。\n\n' +
        '・Vercel の保護者画面を使う場合: 設定シートの「保護者ポータルURL」に https://（あなた）.vercel.app まで入力（末尾スラッシュなし）\n' +
        '・従来の GAS 画面のままにする場合: 「WebアプリURL」に …/exec を登録\n\n' +
        '登録後、本メニューを再実行してください。'
    );
  } else {
    SpreadsheetApp.getUi().alert(
      'URLリストを「URLリスト」シートに出力しました（' + rows.length + '名）。\n\n' +
        (parentPortalBase
          ? '※閲覧URLは保護者ポータル形式（/student/トークン）です。Vercel 側の GAS_STUDENT_API_BASE_URL も設定してください。\n\n'
          : '') +
        '各生徒のURLを LINE・メール等でお知らせください。' +
        (disabledCount ? ('\n\n※ token無効の生徒: ' + disabledCount + '名（URL未発行）') : '') +
        ((fix.regenerated || fix.duplicated)
          ? ('\n\n※ token補正: ' + fix.regenerated + '件（重複検出 ' + fix.duplicated + '件）')
          : '')
    );
  }
}

/** メニュー互換名（旧 getUrl 依存はやめる） */
function syncDeployedWebAppUrlToSettingsSheet_() {
  registerCanonicalWebAppExecUrl_();
}

/**
 * 方式Bまとめ: canonical exec があれば URLリスト出力（無ければ登録メニューへ誘導）
 */
function runDemoVariantSetup_syncUrlAndExportUrls_() {
  var url = resolveWebAppBaseUrl_();
  if (!url) {
    SpreadsheetApp.getUi().alert(
      'Web アプリの exec URL が未登録です。\n\n' +
        '1. clasp-demo.ps1 -Deploy の出力で …/exec をコピー\n' +
        '2. メニュー「方式B: デプロイURLを設定シートに書く」（exec を貼る）で登録\n' +
        '3. もう一度このメニューを実行'
    );
    return;
  }
  exportStudentUrls_();
}

/**
 * URLリストの閲覧URLだけ、古い …/macros/s/別ID/exec を現在デプロイのベースに差し替える（?token= はそのまま）。
 * シート複製後や別デプロイへ clasp したあと、C列だけ過去の AKfy が残っているときに使用。
 */
function repairUrlListBaseUrlToCurrentDeploy_() {
  var base = resolveWebAppBaseUrl_();
  if (!base) {
    SpreadsheetApp.getUi().alert(
      'exec のベース URL が未定義です。\n\n「方式B: デプロイURLを設定シートに書く」で clasp の …/exec を貼って登録してから再実行してください。'
    );
    return;
  }

  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName('URLリスト');
  if (!sh) {
    SpreadsheetApp.getUi().alert('「URLリスト」シートがありません。');
    return;
  }

  var rng = sh.getDataRange();
  var vals = rng.getValues();
  var colUrl = 2;
  var colShort = 3;
  var fixed = 0;

  for (var r = 1; r < vals.length; r++) {
    var url = String(vals[r][colUrl] || '').trim();
    if (!url || url.indexOf('token=') === -1) continue;
    var qi = url.indexOf('?');
    if (qi < 0) continue;
    var tail = url.substring(qi);
    if (tail.indexOf('token=') === -1) continue;

    vals[r][colUrl] = base + tail;
    vals[r][colShort] = '';
    fixed++;
  }

  if (fixed > 0) {
    rng.setValues(vals);
    sh.setColumnWidth(colUrl + 1, 500);
    SpreadsheetApp.getUi().alert(
      '閲覧URL のベースを現在のデプロイに差し替えました（' +
        fixed +
        '件）。設定シートの WebアプリURL も更新済みです。\n\n' +
        'D列（短縮URL）はクリアしました。「短縮URLを一括生成」を実行してください。'
    );
  } else {
    SpreadsheetApp.getUi().alert(
      '差し替え対象がありませんでした（C列に ?token= 付きURL が無いか、すでに同じベースの可能性があります）。'
    );
  }
}
