/**
 * 操作パネルシート
 *
 * チェックボックスをクリックするだけで各処理を実行できる「ボタン」シート。
 * 「育成出欠V1」→「操作パネルを初期化」で作成する。
 *
 * 【使い方】
 *   A列のチェックボックスをクリック → 処理が実行 → 自動的にチェックが外れる
 */

var PANEL_SHEET_NAME = '操作パネル';

/**
 * 操作パネルシートに定義するボタン一覧
 * { key, label, desc, func, color }
 *   key  : onEdit で照合するための識別子（B列に書く）
 *   label: ボタンに表示するテキスト
 *   desc : 説明文（C列）
 *   func : 実行する GAS 関数名（文字列）
 *   color: 行の背景色
 */
var PANEL_BUTTONS = [
  {
    key:   'ALL',
    label: '🚀  一括更新（全処理）',
    desc:  '名簿作成・ログ反映・集計更新・未入力チェックをまとめて実行します',
    func:  'runAllUpdates_',
    color: '#ffd966'
  },
  { key: 'SEP1', label: '', desc: '', func: null, color: '#efefef' }, // 区切り線
  {
    key:   'ENSURE',
    label: '📋  今月・来月・再来月の名簿を確認/作成',
    desc:  '名簿シートが存在しない場合に自動作成します（3ヶ月分）',
    func:  'ensureSheets',
    color: '#d9ead3'
  },
  {
    key:   'LOG',
    label: '🔄  名簿をログから更新',
    desc:  '出欠ログのデータを全月の名簿に反映します',
    func:  'updateFromLog',
    color: '#d9ead3'
  },
  {
    key:   'SUMMARY',
    label: '📊  集計を更新',
    desc:  '欠席数・振替使用数・振替残数・未入力数を再計算します',
    func:  'updateSummary',
    color: '#d9ead3'
  },
  {
    key:   'MISSING',
    label: '🔔  未入力チェック・アラート',
    desc:  '過去の未入力セルをハイライトし、メール通知を送信します',
    func:  'checkMissing',
    color: '#d9ead3'
  },
  { key: 'SEP2', label: '', desc: '', func: null, color: '#efefef' },
  {
    key:   'ENROLL',
    label: '👤  未処理の入会申込を一括処理',
    desc:  '新規入会受付シートの未処理行をすべて処理します',
    func:  'processAllPendingEnrollments_',
    color: '#cfe2f3'
  },
  {
    key:   'RECREATE',
    label: '🔁  今月の名簿シートを再作成',
    desc:  '当月の名簿を一旦削除して再生成します（レイアウト崩れの修正など）',
    func:  'recreateCurrentMonthRoster_',
    color: '#f4cccc'
  }
];

// 操作パネルのデータ開始行（1=タイトル, 2=列ヘッダー, 3以降=ボタン行）
var PANEL_DATA_ROW = 3;

// =============================================
// 一括更新（メイン関数）
// =============================================

/**
 * 全処理を一括で実行する
 *   1. 今月・来月の名簿シートを確認/作成
 *   2. 名簿をログから更新（全月）
 *   3. 集計を更新（全月）
 *   4. 未入力チェック・アラート（当月）
 */
function runAllUpdates_() {
  var ui = SpreadsheetApp.getUi();
  var start = new Date();

  try {
    // ステータスを更新しながら処理
    setPanelStatus_('ENSURE',  '⏳ 実行中...');
    ensureSheets();
    setPanelStatus_('ENSURE',  '✅ 完了');

    setPanelStatus_('LOG',     '⏳ 実行中...');
    updateFromLog();
    setPanelStatus_('LOG',     '✅ 完了');

    setPanelStatus_('SUMMARY', '⏳ 実行中...');
    updateSummary();
    setPanelStatus_('SUMMARY', '✅ 完了');

    setPanelStatus_('MISSING', '⏳ 実行中...');
    checkMissing();
    setPanelStatus_('MISSING', '✅ 完了');

    var elapsed = Math.round((new Date() - start) / 1000);
    setPanelStatus_('ALL', '✅ 完了 (' + elapsed + '秒)');

    ui.alert('✅ 一括更新が完了しました（' + elapsed + '秒）');

  } catch (err) {
    setPanelStatus_('ALL', '⚠️ エラー: ' + err.message);
    ui.alert('⚠️ エラーが発生しました:\n' + err.message);
    Logger.log('runAllUpdates_ エラー: ' + err.message);
  }
}

// =============================================
// 操作パネルシート 初期化
// =============================================

/**
 * 操作パネルシートを作成（または再初期化）する
 */
function initControlPanel_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(PANEL_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(PANEL_SHEET_NAME, 0); // 先頭タブに作成
  } else {
    sh.clear();
    sh.clearFormats();
  }

  // ── タイトル行（1行目）───────────────────────────────
  sh.getRange(1, 1, 1, 4).merge()
    .setValue('育成クラス 出欠管理システム　操作パネル')
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setFontSize(14)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 40);

  // ── 列ヘッダー（2行目）──────────────────────────────
  var headerRange = sh.getRange(2, 1, 1, 4);
  headerRange.setValues([['実行', 'ボタン', '説明', '状態']]);
  headerRange.setBackground('#e8eaf6')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sh.setRowHeight(2, 22);

  // ── ボタン行 ─────────────────────────────────────────
  for (var i = 0; i < PANEL_BUTTONS.length; i++) {
    var btn = PANEL_BUTTONS[i];
    var row = PANEL_DATA_ROW + i;

    sh.setRowHeight(row, btn.key.indexOf('SEP') === 0 ? 8 : 36);

    if (btn.key.indexOf('SEP') === 0) {
      // 区切り行（グレー帯）
      sh.getRange(row, 1, 1, 4).merge()
        .setValue('')
        .setBackground('#efefef');
      continue;
    }

    // チェックボックス（A列）
    var cbCell = sh.getRange(row, 1);
    cbCell.insertCheckboxes().setValue(false);
    cbCell.setHorizontalAlignment('center')
          .setVerticalAlignment('middle');

    // ボタン名（B列）
    var labelCell = sh.getRange(row, 2);
    labelCell.setValue(btn.label)
      .setBackground(btn.color)
      .setFontSize(11)
      .setFontWeight('bold')
      .setVerticalAlignment('middle')
      .setBorder(true, true, true, true, false, false,
                 '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

    // 説明（C列）
    sh.getRange(row, 3)
      .setValue(btn.desc)
      .setBackground(btn.color)
      .setFontSize(10)
      .setFontColor('#444444')
      .setVerticalAlignment('middle')
      .setWrap(true);

    // 状態（D列）
    sh.getRange(row, 4)
      .setValue('')
      .setBackground('#ffffff')
      .setFontColor('#666666')
      .setFontSize(10)
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');

    // 行全体の背景
    sh.getRange(row, 1).setBackground('#ffffff');
  }

  // ── 列幅 ────────────────────────────────────────────
  sh.setColumnWidth(1, 50);   // チェックボックス
  sh.setColumnWidth(2, 300);  // ボタン名
  sh.setColumnWidth(3, 400);  // 説明
  sh.setColumnWidth(4, 180);  // 状態

  sh.setFrozenRows(2);

  SpreadsheetApp.getUi().alert(
    '「' + PANEL_SHEET_NAME + '」シートを作成しました。\n\n' +
    '【使い方】\n' +
    'A列のチェックボックスをクリックすると、\n' +
    'その行の処理が自動的に実行されます。\n\n' +
    '一番上の「🚀 一括更新」で全処理をまとめて実行できます。'
  );
}

// =============================================
// ヘルパー
// =============================================

/**
 * 指定キーのボタン行のD列（状態）を更新する
 * @param {string} key  PANEL_BUTTONS の key
 * @param {string} text 表示テキスト
 */
function setPanelStatus_(key, text) {
  try {
    var ss = getSpreadsheet_();
    var sh = ss.getSheetByName(PANEL_SHEET_NAME);
    if (!sh) return;

    for (var i = 0; i < PANEL_BUTTONS.length; i++) {
      if (PANEL_BUTTONS[i].key === key) {
        var row = PANEL_DATA_ROW + i;
        var cell = sh.getRange(row, 4);
        cell.setValue(text);
        var isError = text.indexOf('⚠️') >= 0;
        var isDone  = text.indexOf('✅') >= 0;
        cell.setBackground(isError ? '#fce8e6' : isDone ? '#d9ead3' : '#fff9c4')
            .setFontColor(isError ? '#a61c00' : isDone ? '#274e13' : '#7a5c00');
        SpreadsheetApp.flush();
        return;
      }
    }
  } catch (e) {
    // 状態表示の失敗は無視（本処理に影響させない）
  }
}

/**
 * 操作パネルのチェックボックスが押されたときに実行する関数を返す
 * onEdit から呼ばれる
 * @param {string} key  PANEL_BUTTONS の key
 * @returns {string|null} 実行する関数名
 */
function getPanelFuncByKey_(key) {
  for (var i = 0; i < PANEL_BUTTONS.length; i++) {
    if (PANEL_BUTTONS[i].key === key) {
      return PANEL_BUTTONS[i].func || null;
    }
  }
  return null;
}

/**
 * 操作パネルの全ステータスをクリアする
 */
function clearPanelStatus_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(PANEL_SHEET_NAME);
  if (!sh) return;

  for (var i = 0; i < PANEL_BUTTONS.length; i++) {
    var btn = PANEL_BUTTONS[i];
    if (btn.key.indexOf('SEP') === 0 || !btn.func) continue;
    var row = PANEL_DATA_ROW + i;
    sh.getRange(row, 4)
      .setValue('')
      .setBackground('#ffffff')
      .setFontColor('#666666');
    // チェックボックスをリセット
    sh.getRange(row, 1).setValue(false);
  }
}
