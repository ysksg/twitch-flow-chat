const translations = {
    ja: {
        title: "Twitch Flow Chat",
        language: "言語",
        displaySettings: "表示設定",
        visibility: "表示",
        on: "ON",
        off: "OFF",
        commentColor: "コメント色",
        outlineColor: "縁取り色",
        outlineSize: "縁取りサイズ (px)",
        opacity: "不透明度",
        fontFamily: "フォント",
        fontSizeMode: "フォントサイズ算出モード",
        autoMode: "Auto (自動計算)",
        customMode: "Custom (固定サイズ)",
        fontSize: "フォントサイズ",
        maxLines: "表示最大行数",
        anchorPosition: "コメント表示エリア アンカー位置",
        center: "Center (中央)",
        top: "Top (上部)",
        bottom: "Bottom (下部)",
        scrollDuration: "スクロール秒数",
        showBadges: "バッジを表示",
        showUsername: "ユーザー名を表示",
        useUserColor: "ユーザー名に色を付ける",
        enableQueue: "溢れたコメントをストック",
        enableMultiLayer: "レーン満杯時に隙間に強制表示",
        ttsSettings: "音声読み上げ（TTS）機能",
        ttsEnabled: "音声読み上げ機能を有効にする",
        ttsVoice: "読み上げ音声",
        ttsSample: "サンプル再生",
        ttsVolume: "音量 (0.0 ~ 1.0)",
        ttsSpeed: "基本速度 (0.1 ~ 3.0)",
        ttsMaxQueue: "読み上げ待ちの最大許容数",
        ttsAutoSpeed: "コメント量に応じて速度を上げる",
        reset: "デフォルトに戻す",
        confirmReset: "設定をデフォルトに戻しますか？",
        loading: "(読み込み中...)",
        systemDefault: "(システムデフォルト)",
        sampleJa: "これはサンプル音声です",
        sampleEn: "This is a sample voice"
    },
    en: {
        title: "Twitch Flow Chat",
        language: "Language",
        displaySettings: "Display Settings",
        visibility: "Visibility",
        on: "ON",
        off: "OFF",
        commentColor: "Comment Color",
        outlineColor: "Outline Color",
        outlineSize: "Outline Size (px)",
        opacity: "Opacity",
        fontFamily: "Font Family",
        fontSizeMode: "Font Size Mode",
        autoMode: "Auto",
        customMode: "Custom",
        fontSize: "Font Size",
        maxLines: "Max Display Lines",
        anchorPosition: "Anchor Position",
        center: "Center",
        top: "Top",
        bottom: "Bottom",
        scrollDuration: "Scroll Duration (sec)",
        showBadges: "Show Badges",
        showUsername: "Show Username",
        useUserColor: "Color Username",
        enableQueue: "Queue Overflow Comments",
        enableMultiLayer: "Force Display on Full Lanes",
        ttsSettings: "Text-to-Speech (TTS)",
        ttsEnabled: "Enable TTS",
        ttsVoice: "Voice",
        ttsSample: "Play Sample",
        ttsVolume: "Volume (0.0 ~ 1.0)",
        ttsSpeed: "Speed (0.1 ~ 3.0)",
        ttsMaxQueue: "Max TTS Queue",
        ttsAutoSpeed: "Increase Speed by Volume",
        reset: "Reset to Default",
        confirmReset: "Reset settings to default?",
        loading: "(Loading...)",
        systemDefault: "(System Default)",
        sampleJa: "これはサンプル音声です",
        sampleEn: "This is a sample voice"
    }
};

/**
 * 現在の言語設定を取得
 * ブラウザ設定または保存された設定を返す
 */
function getAppLanguage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['language'], (res) => {
            if (res.language) {
                resolve(res.language);
            } else {
                // ブラウザの言語設定を取得
                const uiLang = chrome.i18n.getUILanguage();
                const lang = uiLang.startsWith('ja') ? 'ja' : 'en';
                resolve(lang);
            }
        });
    });
}

/**
 * UIのテキストを現在の言語に更新
 */
async function applyTranslations() {
    const lang = await getAppLanguage();
    const t = translations[lang];

    // 言語設定セレクトボックスを更新
    const langEl = document.getElementById('language');
    if (langEl) langEl.value = lang;

    // data-i18n 属性を持つ要素を置換
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = t[key];
            } else if (el.id === 'ttsSpeakSample') {
                // サンプル再生ボタンは中身を置換せず、title属性（ツールチップ）のみ更新
                el.title = t[key];
            } else {
                el.innerText = t[key];
            }
        }
    });

    // 特殊な要素の処理 (placeholderなど)
    const customFontSize = document.getElementById('customFontSize');
    if (customFontSize) customFontSize.placeholder = "32px, 1.5em";

    // セレクトボックスのオプション
    const fontSizeMode = document.getElementById('fontSizeMode');
    if (fontSizeMode) {
        fontSizeMode.options[0].text = t.autoMode;
        fontSizeMode.options[1].text = t.customMode;
    }

    const anchorPosition = document.getElementById('anchorPosition');
    if (anchorPosition) {
        anchorPosition.options[0].text = t.center;
        anchorPosition.options[1].text = t.top;
        anchorPosition.options[2].text = t.bottom;
    }

    const visibility = document.getElementById('visibility');
    if (visibility) {
        visibility.options[0].text = t.on;
        visibility.options[1].text = t.off;
    }

    // TTS Voice のプレースホルダーなどは initVoiceList 内で別途更新される可能性があるが
    // ここでも初期表示を日本語化しておく
    const ttsVoice = document.getElementById('ttsVoice');
    if (ttsVoice && ttsVoice.options.length > 0 && ttsVoice.options[0].value === "") {
         ttsVoice.options[0].text = t.loading;
    }
}
