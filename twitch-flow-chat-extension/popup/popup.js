const DEFAULT_CONFIG = {
    language: '', // 空の場合はOS/ブラウザ設定に従う
    visibility: "visible",
    color: '#ffffff',
    outlineColor: '#000000',
    outlineSize: 2,
    opacity: 0.6,
    fontFamily: 'sans-serif',
    fontSizeMode: 'Auto',
    customFontSize: '32px',
    displayLines: 15,
    anchorPosition: 'Center',
    duration: 5,
    showBadges: true,
    showUsername: true,
    useUserColor: true,
    enableQueue: false,
    enableMultiLayer: true,
    ttsEnabled: false,
    ttsVolume: 1.0,
    ttsSpeed: 1.0,
    ttsMaxQueue: 5,
    ttsAutoSpeed: true
};

// 要素の取得
const fields = [
    'language', 'visibility', 'color', 'outlineColor', 'outlineSize', 'opacity',
    'fontFamily', 'fontSizeMode', 'customFontSize', 'displayLines',
    'anchorPosition', 'duration', 'showBadges',
    'showUsername', 'useUserColor', 'enableQueue',
    'enableMultiLayer', 'ttsEnabled', 'ttsVoice', 'ttsVolume', 'ttsSpeed', 'ttsMaxQueue', 'ttsAutoSpeed'
];

document.addEventListener('DOMContentLoaded', async () => {
    // 翻訳の適用
    await applyTranslations();

    // 音声リストの初期化
    initVoiceList();

    // 現在の設定を読み込んで反映
    chrome.storage.local.get(DEFAULT_CONFIG, (config) => {
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (el.type === 'checkbox') {
                el.checked = config[id];
            } else if (id === 'language') {
                // language が空の場合は getAppLanguage の結果を反映
                if (!config[id]) {
                    getAppLanguage().then(lang => {
                        el.value = lang;
                    });
                } else {
                    el.value = config[id];
                }
            } else {
                el.value = config[id];
            }

            if (id === 'opacity') {
                updateOpacityValue(config[id]);
            }
        });
    });

    // 変更イベントの登録
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener('change', async () => {
            const val = el.type === 'checkbox' ? el.checked : el.value;
            chrome.storage.local.set({ [id]: val });

            if (id === 'language') {
                await applyTranslations();
            }
            if (id === 'opacity') {
                updateOpacityValue(val);
            }
            if (id === 'fontSizeMode') {
                updateFontSizeVisibility(val);
            }
        });
    });

    // 初期表示制御
    chrome.storage.local.get(['fontSizeMode'], (res) => {
        updateFontSizeVisibility(res.fontSizeMode || DEFAULT_CONFIG.fontSizeMode);
    });

    // リセットボタン
    document.getElementById('reset').addEventListener('click', async () => {
        const lang = await getAppLanguage();
        const t = translations[lang];
        if (confirm(t.confirmReset)) {
            chrome.storage.local.set(DEFAULT_CONFIG, () => {
                location.reload();
            });
        }
    });

    // Opacityスライダーのリアルタイム表示
    document.getElementById('opacity').addEventListener('input', (e) => {
        updateOpacityValue(e.target.value);
    });
});

// Sample Speak button
document.getElementById('ttsSpeakSample').addEventListener('click', async () => {
    const lang = await getAppLanguage();
    const t = translations[lang];
    const voiceName = document.getElementById('ttsVoice').value;
    const speed = parseFloat(document.getElementById('ttsSpeed').value) || 1.0;
    const volume = parseFloat(document.getElementById('ttsVolume').value) || 1.0;

    const text = (voiceName.includes('ja') || voiceName.includes('JP'))
        ? t.sampleJa
        : t.sampleEn;

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    if (voice) utterance.voice = voice;
    utterance.rate = speed;
    utterance.volume = volume;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
});

function updateOpacityValue(val) {
    const display = document.getElementById('opacityValue');
    if (display) display.innerText = val;
}

function updateFontSizeVisibility(mode) {
    const field = document.getElementById('customFontSizeField');
    if (field) {
        field.style.display = (mode === 'Custom') ? 'flex' : 'none';
    }
}

function initVoiceList() {
    const voiceSelect = document.getElementById('ttsVoice');
    if (!voiceSelect) return;

    const updateVoices = () => {
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) return;

        // 保存されている値を取得
        chrome.storage.local.get(['ttsVoice'], (res) => {
            const savedVoice = res.ttsVoice || '';

            voiceSelect.innerHTML = '<option value="">(システムデフォルト)</option>';

            // 日本語と英語を優先的にソート
            const sortedVoices = [...voices].sort((a, b) => {
                const aIsJa = a.lang.startsWith('ja');
                const bIsJa = b.lang.startsWith('ja');
                if (aIsJa && !bIsJa) return -1;
                if (!aIsJa && bIsJa) return 1;

                const aIsEn = a.lang.startsWith('en');
                const bIsEn = b.lang.startsWith('en');
                if (aIsEn && !bIsEn) return -1;
                if (!aIsEn && bIsEn) return 1;

                return a.name.localeCompare(b.name);
            });

            sortedVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                if (voice.name === savedVoice) option.selected = true;
                voiceSelect.appendChild(option);
            });
        });
    };

    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = updateVoices;
    }
    updateVoices();
}
