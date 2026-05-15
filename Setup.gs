/**
 * シート初期化・メニュー・トリガー登録ヘルパー
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('育成出欠V1')

    // ── 一括更新（最上位に配置）──────────────────────────
    .addItem('🚀 一括更新（全処理）', 'runAllUpdates_')
    .addSeparator()

    // ── 月別出欠名簿 ──────────────────────────────────────
    .addSubMenu(ui.createMenu('📋 月別出欠名簿')
      .addItem('今月・来月・再来月の名簿シートを確認/作成', 'ensureSheets')
      .addItem('名簿をログから更新（全月）', 'updateFromLog')
      .addItem('集計を更新（全月）', 'updateSummary')
      .addItem('未入力チェック・アラート（当月）', 'checkMissing')
      .addSeparator()
      .addItem('今月の名簿シートを再作成', 'recreateCurrentMonthRoster_')
    )

    // ── 生徒管理 ──────────────────────────────────────────
    .addSeparator()
    .addSubMenu(ui.createMenu('👤 生徒管理')
      .addItem('【新規入会】入会受付シートを作成/設定', 'initNewEnrollmentSheet_')
      .addItem('未処理の入会申込を一括処理', 'processAllPendingEnrollments_')
      .addSeparator()
      .addItem('変更予定シートを作成/設定（プルダウン付き）', 'initChangesSheet_')
      .addItem('氏名プルダウンをマスタの最新状態に更新', 'refreshNameDropdown_')
      .addItem('生徒IDを氏名から一括補完（未入力行）', 'fillChangeSheetNames_')
    )

    // ── 初期設定・管理（日運用で使う項目に絞る）──────────
    .addSeparator()
    .addSubMenu(ui.createMenu('⚙️ 初期設定・管理')
      .addItem('操作パネルシートを作成/更新', 'initControlPanel_')
      .addSeparator()
      .addItem('🔧 不足シートを追加（既存データを保持）', 'repairMissingSheets_')
      .addItem('シートを初期化（全シート＋ヘッダー・データ消去）⚠', 'initializeSheets_')
      .addItem('新規スプレッドシートを別ファイルで作成', 'createNewSpreadsheetForProject_')
      .addSeparator()
      .addItem('閲覧トークンを再生成（選択行のみ）', 'regenerateTokensForSelection_')
      .addItem('URLリストを出力（設定の保護者ポータルURLどおり）', 'exportStudentUrls_')
      .addItem('本番Vercelを設定に書き込み→URLリスト', 'registerDefaultParentPortalUrlAndExportUrls_')
      .addItem('短縮URLを一括生成', 'shortenAllStudentUrls_')
      .addSeparator()
      .addItem('GASのWebアプリURL（…/exec）を設定シートに登録', 'syncDeployedWebAppUrlToSettingsSheet_')
      .addSeparator()
      .addItem('複製ブック用: Webアプリのデータ参照先をこのブックに', 'registerWebAppDataSpreadsheetFromActive_')
      .addItem('データ参照先の上書きを解除', 'clearWebAppDataSpreadsheetOverride_')
      .addSeparator()
      .addItem('既存表取込シート → 生徒マスタに追記', 'importLegacyRowsToMaster_')
    )

    // ── 集計・復旧・開発（メンテ・テンプレ用はここへ）───
    .addSeparator()
    .addSubMenu(ui.createMenu('🔧 集計・復旧・開発')
      .addItem('振替集計を再計算（全員）', 'recomputeSummary_')
      .addItem('フォーム回答の全行を再処理（ログ再構築）', 'reprocessAllFormRows_')
      .addItem('フォーム回答の最終行を再処理', 'reprocessLastFormRow_')
      .addItem('【診断】シート名一覧を表示', 'debugListSheetNames_')
      .addSeparator()
      .addItem('URLリストの閲覧URLを現在の…/execに差し替え（token維持）', 'repairUrlListBaseUrlToCurrentDeploy_')
      .addSeparator()
      .addItem('【テンプレ】AIテンプレ複製→デモ氏名に置換', 'copyAiTemplateAndApplyDemoMask_')
      .addItem('【テンプレ】このブックのみデモ氏名に置換', 'replaceDemoMaskedNamesInActiveSpreadsheet_')
    )

    // ── トリガー登録 ──────────────────────────────────────
    .addSeparator()
    .addSubMenu(ui.createMenu('⏰ トリガー登録')
      .addItem('自動化トリガーを登録（推奨・一式）', 'installScheduledAutomationTriggers_')
    )

    .addToUi();
}

/**
 * 不足シートだけを追加する（既存シートのデータは一切変更しない）
 * 誤って出欠ログ等を消した場合の復旧用。
 */
function repairMissingSheets_() {
  var ss = getSpreadsheet_();
  var created = [];
  var skipped = [];

  var checks = [
    { name: CONFIG.SHEET.SETTINGS,        builder: buildSettingsTemplate_,       label: '設定' },
    { name: CONFIG.SHEET.MASTER,          builder: buildMasterHeaders_,          label: '生徒マスタ' },
    { name: CONFIG.SHEET.FORM_ANSWERS,    builder: null,                         label: 'フォーム回答' },
    { name: CONFIG.SHEET.ATTENDANCE_LOG,  builder: buildLogHeaders_,             label: '出欠ログ' },
    { name: CONFIG.SHEET.SUMMARY,         builder: buildSummaryHeaders_,         label: '集計' },
    { name: CONFIG.SHEET.NOTIFICATIONS,   builder: buildNotificationHeaders_,    label: '通知管理' },
    { name: CONFIG.SHEET.LEGACY_IMPORT,   builder: buildLegacyImportHeaders_,    label: '既存表取込_作業' }
  ];

  checks.forEach(function(c) {
    var sh = ss.getSheetByName(c.name);
    if (!sh) {
      if (c.name === CONFIG.SHEET.FORM_ANSWERS) {
        ensureFormAnswersSheet_(ss);
      } else {
        var rows = c.builder();
        var maxCols = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 1);
        var padded = rows.map(function(r) {
          var row = r.slice();
          while (row.length < maxCols) row.push('');
          return row;
        });
        sh = ss.insertSheet(c.name);
        sh.getRange(1, 1, padded.length, maxCols).setValues(padded);
      }
      created.push(c.label + '（' + c.name + '）');
    } else {
      skipped.push(c.label);
    }
  });

  var msg = created.length > 0
    ? '✅ 以下のシートを新規作成しました：\n・' + created.join('\n・')
    : '✅ 不足シートはありませんでした。';

  if (skipped.length > 0) {
    msg += '\n\n（既存シートは変更していません：' + skipped.join('・') + '）';
  }

  SpreadsheetApp.getUi().alert(msg);
}

/**
 * 初回セットアップ：全シート作成とヘッダー行
 * ⚠️ 既存シートのデータをすべてクリアします。通常は「不足シートを追加」を使ってください。
 */
function initializeSheets_() {
  var ss = getSpreadsheet_();
  ensureSheet_(ss, CONFIG.SHEET.SETTINGS, buildSettingsTemplate_());
  ensureSheet_(ss, CONFIG.SHEET.MASTER, buildMasterHeaders_());
  ensureFormAnswersSheet_(ss);
  ensureSheet_(ss, CONFIG.SHEET.ATTENDANCE_LOG, buildLogHeaders_());
  ensureSheet_(ss, CONFIG.SHEET.SUMMARY, buildSummaryHeaders_());
  ensureSheet_(ss, CONFIG.SHEET.NOTIFICATIONS, buildNotificationHeaders_());
  ensureSheet_(ss, CONFIG.SHEET.LEGACY_IMPORT, buildLegacyImportHeaders_());
  SpreadsheetApp.getUi().alert(
    '初期化が完了しました。Googleフォームは手作業で作成し回答先を接続してください。「設定」シートの予約URL・メールも確認してください。'
  );
}

/** コードを貼り付けた直後の空ブック用：名前付きで新規ファイルを作りURLを表示 */
function createNewSpreadsheetForProject_() {
  var name = '育成クラス出欠管理_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd_HHmm');
  var ss = SpreadsheetApp.create(name);
  SpreadsheetApp.getUi().alert(
    '新しいスプレッドシートを作成しました。\n\n① 次のURLを開く\n' +
      ss.getUrl() +
      '\n\n② メニュー「拡張機能」→「Apps Script」で、元のブックと同じ .gs / HTML をコピーして保存\n③ スプレッドシートに戻り、本メニュー「シートを初期化」を実行\n\n※この操作を実行したブックとは別ファイルです。'
  );
}

/** フォーム連携済みの回答を消さないよう、無いときだけ作成 */
function ensureFormAnswersSheet_(ss) {
  var sh = ss.getSheetByName(CONFIG.SHEET.FORM_ANSWERS);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET.FORM_ANSWERS);
    sh.getRange(1, 1).setValue('※Googleフォームをこのスプレッドシートに接続すると、1行目に質問見出しが入ります');
  }
  return sh;
}

function ensureSheet_(ss, name, rows) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  if (rows && rows.length) {
    sh.clear();
    sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }
  return sh;
}

function buildSettingsTemplate_() {
  var k = CONFIG.SETTINGS_KEYS;
  return [
    ['キー', '値', '説明'],
    [k.RESERVATION_URL, 'https://reserva.be/kamakuragreen', '保護者向け「振替予約」ボタンの遷移先'],
    [k.ALERT_EMAIL, 'vnika0305@gmail.com', '未入力アラートの送信先'],
    [k.ATTENDANCE_FORM_URL, CONFIG.DEFAULT_ATTENDANCE_FORM_URL, '未入力アラート本文に載せる育成クラス出欠フォームのURL'],
    [k.TIMEZONE, CONFIG.TIMEZONE, '日付・曜日判定の基準'],
    [k.SKIP_ALERT_DATES, '', 'カンマ区切り yyyy-MM-dd。学校都合で実施なしの日はここに入れると前日アラートを抑止'],
    [k.FORM_HEADER_LESSON_DATE, '実施日', 'フォームの実施日列の見出しと完全一致（例: 実施日・今日の日付）'],
    [k.FORM_HEADER_CLASS_WEEKDAY, '所属曜日', '「所属曜日」列見出し。列が無い場合は下の「実施日から」を TRUE'],
    [k.FORM_DERIVE_WEEKDAY_FROM_LESSON_DATE, 'TRUE', 'TRUE: 所属曜日列が無くても実施日の暦曜日で判定'],
    [k.FORM_EMPTY_MEANS_ABSENT, 'FALSE', 'TRUE: 出席のみフォームで空欄を欠席としてログに残す'],
    [k.FORM_HEADER_COACH, 'コーチ名', '任意。列が無ければ空でも可'],
    [
      k.SURGE_STYLESHEET,
      CONFIG.SURGE_STYLESHEET_URL,
      'surge フォルダの styles.css を公開したURL（末尾 /styles.css）。Config.gs の既定値も要確認'
    ],
    [k.WEBAPP_BASE_URL, '', 'デプロイ後のウェブアプリURL（https://script.google.com/macros/s/xxx/exec）。GAS画面のまま使う場合'],
    [
      k.PARENT_PORTAL_BASE_URL,
      '',
      'Vercel の保護者画面のオリジン（例: https://xxx.vercel.app）。入力すると URLリストの閲覧URLが /student/トークン 形式になる'
    ],
    [
      k.WEB_APP_DATA_SPREADSHEET_NOTE,
      '',
      'ウェブアプリが読むブックはメニュー「複製ブック用: Webアプリのデータ参照先をこのブックに」でスクリプトプロパティに保存します（複製のみ共有する運用で必要）'
    ],
    ['名簿自動作成開始日', '25', '月の何日以降に翌月・翌々月の出欠名簿シートを自動作成するか（既定: 25）'],
    ['1クラス定員', '10', '1クラスあたりの定員人数（曜日別人数サマリーの「空き」算出に使用）']
  ];
}

function buildMasterHeaders_() {
  return [
    [
      'studentId',
      '氏名',
      'コース',
      'レギュラー曜日',
      '初期残振替',
      'viewToken',
      'token無効',
      'メモ',
      '学年',    // 列9: 例 中1 / 5 / 中3（出欠名簿の「学年」列に表示）
      '入会月'   // 列10: 例 2026/5（入会受付シートで自動入力。空なら全月対象）
    ],
    [
      'S001',
      'サンプル太郎',
      '週2',
      '月,木',
      '0',
      '',
      '',
      '初期行は削除してOK。コースは週1/週2/週3。レギュラー曜日はカンマ区切り（月,木）',
      '中1',
      ''  // 既存生徒は入会月空欄でOK（全月対象）
    ]
  ];
}

function buildLogHeaders_() {
  return [
    [
      'logId',
      'studentId',
      '氏名',
      '実施日',
      '所属曜日',
      '出欠',
      '欠席による振替発生',
      '振替消化',
      '元フォーム行',
      'フォーム受信時刻',
      'メモ'
    ]
  ];
}

function buildSummaryHeaders_() {
  return [['studentId', '氏名', '振替発生回数', '振替消化回数', '残振替回数', '最終集計日時']];
}

function buildNotificationHeaders_() {
  return [['送信日時', '種別', '内容', '結果']];
}

function buildLegacyImportHeaders_() {
  return [
    ['※既存「出欠管理票_2026」の4月表から、氏名・曜日・コースをコピペ（下の見出し行は残す）'],
    ['氏名', 'レギュラー曜日（カンマ区切り: 月,木）', 'コース（週1/週2/週3）']
  ];
}

/**
 * 毎朝9時に集計を自動更新するトリガーを登録（手動で1回実行）
 */
function installDailyAggregation9am_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'recomputeSummary_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('recomputeSummary_')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
  SpreadsheetApp.getUi().alert('毎朝9時の集計自動更新トリガーを登録しました（' + CONFIG.TIMEZONE + '）。');
}

/**
 * フォーム送信トリガー（手動で1回実行）
 */
function installFormSubmitTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  var ssId = getSpreadsheet_().getId();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ssId)
    .onFormSubmit()
    .create();
  SpreadsheetApp.getUi().alert('フォーム送信トリガーを登録しました。');
}

/**
 * 毎朝9時（東京）フォーム未入力アラート（単体トリガー用・推奨は自動化一式）
 */
function installDailyTrigger7am_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailyAttendanceAlert_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('dailyAttendanceAlert_').timeBased().atHour(9).everyDays(1).inTimezone(CONFIG.TIMEZONE).create();
  SpreadsheetApp.getUi().alert('毎朝9時の「フォーム未入力アラート」トリガーを登録しました（' + CONFIG.TIMEZONE + '）。');
}
