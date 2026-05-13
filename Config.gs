/**
 * 育成クラス出欠・振替管理システム V1
 * 定数・設定キー（列レイアウトと合わせて変更しないこと）
 */
var CONFIG = {
  TIMEZONE: 'Asia/Tokyo',

  /** 対象クラス曜日（レッスン実施曜日） */
  TARGET_WEEKDAYS: ['月', '火', '木', '金'],

  /** JavaScript getDay() → 内部曜日コード */
  JS_DAY_TO_WEEKDAY: {
    0: '日',
    1: '月',
    2: '火',
    3: '水',
    4: '木',
    5: '金',
    6: '土'
  },

  SHEET: {
    SETTINGS: '設定',
    MASTER: '生徒マスタ',
    FORM_ANSWERS: 'フォーム回答',
    ATTENDANCE_LOG: '出欠ログ',
    SUMMARY: '集計',
    NOTIFICATIONS: '通知管理',
    LEGACY_IMPORT: '既存表取込_作業'
  },

  /** 設定シートのキー列・値列 */
  SETTINGS_KEY_COL: 1,
  SETTINGS_VAL_COL: 2,
  SETTINGS_KEYS: {
    RESERVATION_URL: '予約ページURL',
    ALERT_EMAIL: 'アラート送信先メール',
    /** 未入力アラートメール本文に記載する育成クラス出欠フォームのURL */
    ATTENDANCE_FORM_URL: '出欠フォームURL',
    TIMEZONE: 'タイムゾーン',
    /** カンマ区切り yyyy-MM-dd。該当日は未入力アラートを送らない */
    SKIP_ALERT_DATES: '未入力アラート除外日',
    /** フォームの実施日の列見出し（ヘッダー文字列） */
    FORM_HEADER_LESSON_DATE: 'フォーム_実施日列名',
    FORM_HEADER_CLASS_WEEKDAY: 'フォーム_所属曜日列名',
    /** TRUE のとき「所属曜日」列が無くても実施日から曜日を決める */
    FORM_DERIVE_WEEKDAY_FROM_LESSON_DATE: 'フォーム_所属曜日なしは実施日から',
    /** TRUE のとき、出席のみチェック形式で空欄を欠席として扱う */
    FORM_EMPTY_MEANS_ABSENT: 'フォーム_出席のみで空欄は欠席',
    FORM_HEADER_COACH: 'フォーム_コーチ名列名',
    /** Surge で公開した styles.css のURL（例: https://xxx.surge.sh/styles.css） */
    SURGE_STYLESHEET: 'Surge_スタイルシートURL',
    /** デプロイ済みウェブアプリのベースURL（例: https://script.google.com/macros/s/xxx/exec） */
    WEBAPP_BASE_URL: 'WebアプリURL',
    /** 保護者向け Next.js（Vercel）のオリジン。末尾スラッシュなし。設定時は閲覧URLが /student/{token} になる */
    PARENT_PORTAL_BASE_URL: '保護者ポータルURL',
    /** 説明用（実際の参照先はスクリプトプロパティ WEB_APP_DATA_SPREADSHEET_ID。メニューで登録） */
    WEB_APP_DATA_SPREADSHEET_NOTE: 'Webアプリデータ参照（説明）'
  },

  /**
   * Surge で公開した styles.css の既定URL（設定シートの値が空のとき）
   * デプロイ後に実サブドメインへ必ず差し替え
   */
  SURGE_STYLESHEET_URL: 'https://kamakura-green-ikusei.surge.sh/styles.css',

  /** 振替予約（設定シートが空のときの既定） */
  DEFAULT_RESERVATION_URL: 'https://reserva.be/kamakuragreen',

  /** 育成クラス出欠フォーム（設定シートが空のときの既定。アラート本文に使用） */
  DEFAULT_ATTENDANCE_FORM_URL:
    'https://docs.google.com/forms/d/e/1FAIpQLSeW7H0GdT9OZYmfhxmc_5AgsdyKhCIcAJuNy9SVdu7GWVbIsQ/viewform',

  /** 生徒マスタ列（1始まり） */
  MASTER_COL: {
    STUDENT_ID: 1,
    NAME: 2,
    COURSE: 3,
    REGULAR_WEEKDAYS: 4,
    OPENING_BALANCE: 5,
    VIEW_TOKEN: 6,
    TOKEN_DISABLED: 7,
    NOTE: 8,
    GRADE: 9,         // 学年（例: 中1 / 5 / 中3）。列9が空の場合は空欄表示
    ENROLL_MONTH: 10  // 入会月（例: 2026/5）。空の場合は制限なし（全月対象）
  },

  /** 出欠ログ列 */
  LOG_COL: {
    LOG_ID: 1,
    STUDENT_ID: 2,
    NAME: 3,
    LESSON_DATE: 4,
    CLASS_WEEKDAY: 5,
    STATUS: 6,
    ABSENT_CREDIT_ELIGIBLE: 7,
    MAKEUP_CONSUMED: 8,
    SOURCE_FORM_ROW: 9,
    FORM_TIMESTAMP: 10,
    NOTE: 11
  },

  /** 集計列 */
  SUMMARY_COL: {
    STUDENT_ID: 1,
    NAME: 2,
    GENERATED: 3,
    CONSUMED: 4,
    REMAINING: 5,
    UPDATED_AT: 6
  },

  STATUS: {
    PRESENT: '出席',
    ABSENT: '欠席',
    MAKEUP: '振替出席'
  },

  /** トークン長（バイト相当ではなく英数字文字数） */
  TOKEN_LENGTH: 40,

  LOCK_TIMEOUT_MS: 30000
};

/**
 * 設定値を取得（設定シート）。見つからない場合は defaultValue
 */
function getSetting_(key, defaultValue) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET.SETTINGS);
  if (!sh) return defaultValue;
  var last = sh.getLastRow();
  for (var r = 2; r <= last; r++) {
    var k = sh.getRange(r, CONFIG.SETTINGS_KEY_COL).getValue();
    if (String(k).trim() === key) {
      return sh.getRange(r, CONFIG.SETTINGS_VAL_COL).getValue();
    }
  }
  return defaultValue;
}

/**
 * アラートメール用の出欠フォームURL（設定シートの「出欠フォームURL」が優先）
 */
function getAttendanceFormUrl_() {
  var u = String(
    getSetting_(CONFIG.SETTINGS_KEYS.ATTENDANCE_FORM_URL, CONFIG.DEFAULT_ATTENDANCE_FORM_URL) || ''
  ).trim();
  return u || CONFIG.DEFAULT_ATTENDANCE_FORM_URL;
}

/**
 * 設定の真偽（TRUE/FALSE/はい 等）
 */
function settingIsTrue_(key, defaultValue) {
  var defStr = defaultValue ? 'TRUE' : 'FALSE';
  var v = String(getSetting_(key, defStr) || '').trim().toUpperCase();
  if (v === 'TRUE' || v === '1' || v === 'はい' || v === 'YES') return true;
  if (v === 'FALSE' || v === '0' || v === 'いいえ' || v === 'NO') return false;
  return defaultValue;
}

/**
 * 設定シートにキーで値を書く（なければ行を追加）
 */
function setSettingValue_(key, value) {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.SHEET.SETTINGS);
  if (!sh) throw new Error('設定シートがありません。');
  var last = sh.getLastRow();
  var val = value == null ? '' : String(value);
  for (var r = 2; r <= last; r++) {
    var k = String(sh.getRange(r, CONFIG.SETTINGS_KEY_COL).getValue()).trim();
    if (k === key) {
      sh.getRange(r, CONFIG.SETTINGS_VAL_COL).setValue(val);
      return;
    }
  }
  sh.appendRow([key, val, '']);
}

/**
 * 曜日表記を「月火木金」の1文字に正規化
 */
function normalizeWeekdayLabel_(label) {
  if (label == null || label === '') return '';
  var s = String(label).trim();
  var map = {
    '月曜': '月', '月曜日': '月', '月': '月',
    '火曜': '火', '火曜日': '火', '火': '火',
    '水曜': '水', '水曜日': '水', '水': '水',
    '木曜': '木', '木曜日': '木', '木': '木',
    '金曜': '金', '金曜日': '金', '金': '金',
    '土曜': '土', '土曜日': '土', '土': '土',
    '日曜': '日', '日曜日': '日', '日': '日'
  };
  return map[s] || s.charAt(0);
}

/**
 * 内部用ステータス
 */
function toInternalStatus_(displayStatus) {
  var s = String(displayStatus).trim();
  if (s === CONFIG.STATUS.PRESENT) return 'PRESENT';
  if (s === CONFIG.STATUS.ABSENT) return 'ABSENT';
  if (s === CONFIG.STATUS.MAKEUP) return 'MAKEUP';
  return '';
}
