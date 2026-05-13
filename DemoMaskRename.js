/**
 * 【AI】育成クラス出欠_テンプレート 相当ブックの複製と、デモ用氏名への一括置換。
 *
 * 参照元（編集不可の共有テンプレとして Drive にある前提）:
 * https://docs.google.com/spreadsheets/d/1q8Oye8awffcy5T-05jygO1cQwHMHplqNQFQQ2TZbc4w/edit
 *
 * 使い方:
 *   メニュー「育成出欠V1」→「⚙️ 初期設定・管理」→ 複製／または現在ブックのみ置換
 */

/** 参照テンプレのスプレッドシート ID（URL の /d/ と /edit の間） */
var DEMO_MASK_REFERENCE_SPREADSHEET_ID_ = '1q8Oye8awffcy5T-05jygO1cQwHMHplqNQFQQ2TZbc4w';

/**
 * 元氏名 → デモ表示名（長い文字列から先に置換するため長さ降順で並べる）
 * ※スナップショット上の表記に合わせたUnicode（石﨑の「﨑」など）
 */
function getDemoNameReplacementPairsSorted_() {
  var pairs = [
    ['シェイファー 礼凰奈', '育成デモ14'],
    ['山下 正太郎', '育成デモ16'],
    ['松川 晋次郎', '育成デモ02'],
    ['大木 恵一郎', '育成デモ07'],
    ['永山 博之', '育成デモ23'],
    ['船山 渓太', '育成デモ22'],
    ['石﨑 小粋', '育成デモ03'],
    ['内藤 歩空', '育成デモ09'],
    ['中村 匠徒', '育成デモ11'],
    ['村井 佑乃介', '育成デモ19'],
    ['鈴村 賢信', '育成デモ15'],
    ['粟澤 綾亮', '育成デモ12'],
    ['魚住 咲翔', '育成デモ13'],
    ['福島 悠生', '育成デモ08'],
    ['川崎 祥真', '育成デモ21'],
    ['濱 鼓太朗', '育成デモ18'],
    ['木下 陽稀', '育成デモ17'],
    ['河野 篤人', '育成デモ10'],
    ['藤井 葵', '育成デモ06'],
    ['高橋 陽仁', '育成デモ04'],
    ['大熊 見空', '育成デモ05'],
    ['船山 梓', '育成デモ20'],
    ['西 百花', '育成デモ01'],
    ['吉井 レオ', '育成デモ退会01']
  ];
  pairs.sort(function (a, b) {
    return b[0].length - a[0].length;
  });
  return pairs;
}

function applyDemoStringReplacements_(text, pairs) {
  var out = text;
  for (var i = 0; i < pairs.length; i++) {
    var from = pairs[i][0];
    var to = pairs[i][1];
    if (!from) continue;
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * 全シートのデータ範囲について、数式セル以外の文字列セルだけ置換する。
 */
function applyDemoNameMaskToSpreadsheet_(ss) {
  var pairs = getDemoNameReplacementPairsSorted_();
  var sheets = ss.getSheets();
  for (var si = 0; si < sheets.length; si++) {
    var sh = sheets[si];
    var rng = sh.getDataRange();
    if (rng.isBlank()) continue;
    var formulas = rng.getFormulas();
    var values = rng.getValues();
    var changed = false;
    for (var r = 0; r < values.length; r++) {
      for (var c = 0; c < values[r].length; c++) {
        if (formulas[r][c] !== '') continue;
        var cell = values[r][c];
        if (typeof cell !== 'string') continue;
        var next = applyDemoStringReplacements_(cell, pairs);
        if (next !== cell) {
          values[r][c] = next;
          changed = true;
        }
      }
    }
    if (changed) rng.setValues(values);
  }
}

/** Drive 上の参照ブックを複製し、デモ氏名を書き込んだ新ファイルを開く案内をする */
function copyAiTemplateAndApplyDemoMask_() {
  var ui = SpreadsheetApp.getUi();
  var srcId = DEMO_MASK_REFERENCE_SPREADSHEET_ID_;
  var copyFile;
  try {
    copyFile = DriveApp.getFileById(srcId).makeCopy(
      '【デモ・氏名置換済】育成クラス出欠_' +
        Utilities.formatDate(new Date(), CONFIG.TIMEZONE || 'Asia/Tokyo', 'yyyyMMdd_HHmm')
    );
  } catch (e) {
    ui.alert(
      '参照ブックを複製できませんでした。\n' +
        'この Google アカウントで該当ファイルが「閲覧」以上で共有されているか確認してください。\n\n' +
        String(e.message || e)
    );
    return;
  }
  var ss = SpreadsheetApp.openById(copyFile.getId());
  applyDemoNameMaskToSpreadsheet_(ss);
  ui.alert(
    '新しいスプレッドシートを作成し、デモ用の氏名に置き換えました。\n\n' +
      copyFile.getUrl() +
      '\n\n【方式B・親ブックと干渉させない手順】\n' +
      'このコピーには別の Apps Script プロジェクトが付いています（親の clasp デプロイとは別URLになります）。\n\n' +
      '1. 上のリンクでコピーを開く\n' +
      '2. 「拡張機能」→「Apps Script」を開く（このブック専用のエディタ）\n' +
      '3. コード同期は親リポジトリで PowerShell から実行: .\\tools\\clasp-demo.ps1（要: .clasp.demo.json にこのコピーの scriptId）\n' +
      '4. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」（実行:自分、アクセス:全員 など運用に合わせる）\n' +
      '5. 表示された「ウェブアプリのURL」（…/exec）をメモする\n' +
      '6. コピーを開いた状態でスプレッドシートに戻り、「設定」シートの WebアプリURL にその URL を貼る（または空のままでもメニューから URLリスト出力で自動取得できる場合があります）\n' +
      '7. メニュー「生徒ごとのURLを「URLリスト」シートに出力」を実行し直す（token はこのブックのマスタのものになります）\n\n' +
      '※ 親ブック側のデプロイURLや WEB_APP_DATA_SPREADSHEET_ID は触らなくて大丈夫です。'
  );
}

/** いま開いているブック全体をデモ氏名に置換（手動で「コピーを作成」済みの場合など） */
function replaceDemoMaskedNamesInActiveSpreadsheet_() {
  applyDemoNameMaskToSpreadsheet_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().alert(
    '現在のブックで、デモ氏名への置換を実行しました。\n\n' +
      '方式B（干渉なし）で公開する場合は、このブックから Apps Script を開き、ウェブアプリを別デプロイしたうえで URLリストを出力し直してください。'
  );
}
