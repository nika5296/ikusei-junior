/**
 * is.gd / v.gd による短縮URL生成ユーティリティ
 *
 * （TinyURL はプレビュー画面・広告が挟まることがあるため使用しない）
 *
 * 使い方:
 *   メニュー「育成出欠V1」→「短縮URLを一括生成」
 *
 * 動作:
 *   「URLリスト」シートの C列（閲覧URL）を読み、
 *   D列（短縮URL）に短縮URLを書き込む。
 *   すでに is.gd / v.gd のURLが入っている行はスキップ。
 *   過去に TinyURL だけ入っている行は、再実行で is.gd に置き換え可能。
 */

var URL_LIST_SHEET_NAME = 'URLリスト';
var SHORT_URL_COL       = 4; // D列
var LONG_URL_COL        = 3; // C列
var IS_GD_API           = 'https://is.gd/create.php?format=simple&url=';
var V_GD_API            = 'https://v.gd/create.php?format=simple&url=';

/**
 * is.gd を試し、失敗時は v.gd にフォールバック
 * @param {string} longUrl 元のURL
 * @return {string} 短縮URL
 */
function shortenLongUrl_(longUrl) {
  var firstErr = '';
  try {
    return shortenWithSimpleApi_(longUrl, IS_GD_API, 'https://is.gd/');
  } catch (e) {
    firstErr = e.message;
  }
  try {
    return shortenWithSimpleApi_(longUrl, V_GD_API, 'https://v.gd/');
  } catch (e2) {
    throw new Error(firstErr + ' → ' + e2.message);
  }
}

/**
 * @param {string} longUrl
 * @param {string} apiPrefix API のベース（query に url= を付ける）
 * @param {string} expectedPrefix 成功時に返る短縮URLの先頭
 */
function shortenWithSimpleApi_(longUrl, apiPrefix, expectedPrefix) {
  var response = UrlFetchApp.fetch(apiPrefix + encodeURIComponent(longUrl), {
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code !== 200) {
    throw new Error('HTTP ' + code);
  }
  var text = response.getContentText().trim();
  if (text.indexOf('Error:') === 0) {
    throw new Error(text);
  }
  if (!text || text.indexOf(expectedPrefix) !== 0) {
    throw new Error('レスポンス異常: ' + text);
  }
  return text;
}

/** D列がすでに当サービスで短縮済みか（再生成のとき TinyURL 行は上書き対象にする） */
function isShortUrlAlreadyGenerated_(url) {
  var u = String(url || '').trim();
  return u.indexOf('https://is.gd/') === 0 || u.indexOf('https://v.gd/') === 0;
}

/**
 * 「URLリスト」シートの全生徒の閲覧URLを一括短縮し、D列に書き込む
 * ・すでに短縮済み（is.gd / v.gd）の行はスキップ
 * ・エラーが出た行はスキップし最後にまとめて表示
 */
function shortenAllStudentUrls_() {
  var ss = getSpreadsheet_();
  var listSh = ss.getSheetByName(URL_LIST_SHEET_NAME);

  if (!listSh) {
    SpreadsheetApp.getUi().alert(
      '「URLリスト」シートが見つかりません。\n' +
        'メニュー「生徒ごとのURLを「URLリスト」シートに出力」を先に実行してください。'
    );
    return;
  }

  var lastRow = listSh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('URLリストにデータ行がありません。');
    return;
  }

  if (String(listSh.getRange(1, SHORT_URL_COL).getValue()).trim() !== '短縮URL') {
    listSh.getRange(1, SHORT_URL_COL).setValue('短縮URL');
  }

  var dataRange = listSh.getRange(2, 1, lastRow - 1, SHORT_URL_COL);
  var data = dataRange.getValues();

  var successCount = 0;
  var skipCount = 0;
  var errors = [];

  for (var i = 0; i < data.length; i++) {
    var longUrl = String(data[i][LONG_URL_COL - 1] || '').trim();
    var existShort = String(data[i][SHORT_URL_COL - 1] || '').trim();
    var name = String(data[i][1] || '');
    var rowNum = i + 2;

    if (existShort && isShortUrlAlreadyGenerated_(existShort)) {
      skipCount++;
      continue;
    }

    if (!longUrl || longUrl.indexOf('http') !== 0) {
      skipCount++;
      continue;
    }

    var shortUrl = null;
    var lastErr = '';
    for (var attempt = 1; attempt <= 3; attempt++) {
      try {
        shortUrl = shortenLongUrl_(longUrl);
        break;
      } catch (e) {
        lastErr = e.message;
        Utilities.sleep(attempt * 1500);
      }
    }
    if (shortUrl) {
      listSh.getRange(rowNum, SHORT_URL_COL).setValue(shortUrl);
      successCount++;
      Utilities.sleep(1000);
    } else {
      errors.push(rowNum + '行目（' + name + '）: ' + lastErr);
    }
  }

  listSh.setColumnWidth(SHORT_URL_COL, 230);

  var msg =
    '短縮URLを生成しました（is.gd / v.gd。クリックで直接開きます）。\n\n' +
    '　生成済み : ' +
    successCount +
    '件\n' +
    '　スキップ : ' +
    skipCount +
    '件（生成済みまたはURL未設定）';
  if (errors.length > 0) {
    msg += '\n\nエラーが発生した行（要確認）:\n' + errors.join('\n');
  }
  SpreadsheetApp.getUi().alert(msg);
}
