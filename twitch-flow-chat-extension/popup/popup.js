const DEFAULT_CONFIG = {
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
    enableQueue: false
};

// 要素の取得
const fields = [
    'visibility', 'color', 'outlineColor', 'outlineSize', 'opacity',
    'fontFamily', 'fontSizeMode', 'customFontSize', 'displayLines',
    'anchorPosition', 'duration', 'showBadges',
    'showUsername', 'useUserColor', 'enableQueue'
];

document.addEventListener('DOMContentLoaded', () => {
    // 現在の設定を読み込んで反映
    chrome.storage.local.get(DEFAULT_CONFIG, (config) => {
        fields.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;

            if (el.type === 'checkbox') {
                el.checked = config[id];
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

        el.addEventListener('change', () => {
            const val = el.type === 'checkbox' ? el.checked : el.value;
            chrome.storage.local.set({ [id]: val });

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
    document.getElementById('reset').addEventListener('click', () => {
        if (confirm('設定をデフォルトに戻しますか？')) {
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
