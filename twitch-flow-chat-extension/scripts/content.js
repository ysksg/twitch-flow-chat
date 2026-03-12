const SCRIPTNAME = 'ScreenCommentScroller';

/**
 * デフォルト設定
 */
const DEFAULT_CONFIG = {
    visibility: "visible",
    color: '#ffffff',
    outlineColor: '#000000',
    opacity: 0.6,
    displayLines: 15,         // Tampermonkey版の maxLanes (名前を同期)
    fontSizeMode: 'Auto',      // サイズ計算モード (Auto/Custom)
    customFontSize: '32px',    // カスタムサイズ (Customモード用)
    fontFamily: 'sans-serif',  // フォントファミリー
    anchorPosition: 'Center',  // 表示アンカー (Center/Top/Bottom)
    duration: 5,
    showBadges: true,
    showUsername: true,
    useUserColor: true,
    enableQueue: false,
    outlineSize: 2,            // 縁取りサイズ (px)
    enableMultiLayer: true,    // マルチレイヤー表示フラグ
    ttsEnabled: false,         // 音声読み上げフラグ
    ttsVoice: null,            // 読み上げ音声
    ttsVolume: 1.0,            // 読み上げ音量
    ttsSpeed: 1.0,             // 読み上げ基本速度
    ttsMaxQueue: 5,            // 読み上げ待ちの最大許容数
    ttsAutoSpeed: true         // 数に応じた速度自動調整
};

let config = { ...DEFAULT_CONFIG };

/**
 * 設定の読み込み
 */
async function loadConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(DEFAULT_CONFIG, (items) => {
            config = { ...config, ...items };
            console.debug(SCRIPTNAME, 'Config loaded:', config);
            resolve();
        });
    });
}

// 設定変更を監視
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        for (let key in changes) {
            config[key] = changes[key].newValue;
        }
        console.debug(SCRIPTNAME, 'Config updated:', config);
        // スタイルを再適用する必要がある場合がある
        core.addStyle();
        // 表示/非表示の切り替え
        document.querySelectorAll('.flow-text').forEach(el => el.style.visibility = config.visibility);
        core.updateToggleButtonState();
    }
});

/**
 * サイト定義
 * TwitchのDOM構造に依存するセレクタをここで一元管理
 */
const site = {
    // コメントを表示するスクリーン (動画プレイヤーのオーバーレイ)
    getScreen: () => document.querySelector('.video-ref') || //PC版
        document.querySelector('.video-ref--BLEPn') || //モバイル版 
        document.querySelector('[data-a-target="video-player"]'),

    // 動画要素自体の取得
    getVideo: () => document.querySelector('video'),

    // コメントリストのコンテナ (Live: チャットエリア, VOD: リスト)
    getBoard: () => document.querySelector('.chat-scrollable-area__message-container') ||
        document.querySelector('[data-test-selector="chat-scrollable-area__message-container"]') ||
        document.querySelector('.video-chat__message-list-wrapper ul'),

    // 個別のコメントノード (MutationObserverで検知されたノードから検索)
    getCommentNode: (node) => node.querySelector('.vod-message, .chat-line__message') ||
        (node.classList.contains('chat-line__message') ? node : null),
};

/**
 * チャット解析オブジェクト
 */
const chatParser = {
    getBadges(node) {
        if (!config.showBadges) return [];
        return Array.from(node.querySelectorAll('img.chat-badge')).map(img => ({
            type: 'image',
            src: img.src,
            class: 'scroller-badge',
            ratio: (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1
        }));
    },

    getAuthor(node) {
        if (!config.showUsername) return null;
        const authorNode = node.querySelector('.chat-author__display-name');
        if (!authorNode) return null;
        return {
            type: 'text',
            text: authorNode.innerText,
            color: config.useUserColor ? (authorNode.style.color || config.color) : config.color,
            class: 'scroller-username'
        };
    },

    getBody(node) {
        const bodyNode = node.querySelector('.video-chat__message, [data-a-target="chat-line-message-body"]');
        if (!bodyNode) return [];

        const fragments = [];

        /**
         * 要素内のテキストと画像を順番に抽出する内部関数
         * @param {Node} parent - 走査対象の親ノード
         */
        const parseNodes = (parent) => {
            parent.childNodes.forEach(child => {
                if (child.nodeType === 3) { // テキストノード
                    const text = child.textContent; // trimしない（連続するスタンプ間のスペース保持のため）
                    if (text) fragments.push({ type: 'text', text });
                } else if (child.nodeType === 1) { // 要素ノード
                    // 不要な要素（VODのタイムスタンプ後のコロンなど）を除外
                    if (child.textContent === ':' && child.classList.contains('fViKsQ')) return;

                    if (child.classList.contains('text-fragment')) {
                        // 通常のテキスト
                        fragments.push({ type: 'text', text: child.textContent });
                    } else if (child.tagName === 'IMG' || child.querySelector('img.chat-image')) {
                        // 画像そのもの、または画像を含む要素（スタンプ）
                        const imgs = child.tagName === 'IMG' ? [child] : child.querySelectorAll('img.chat-image');
                        imgs.forEach(img => {
                            // 元画像のサイズからアスペクト比を計算
                            const ratio = (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1;
                            fragments.push({ type: 'image', src: img.src, class: 'scroller-image', ratio: ratio });
                        });
                    } else if (child.childNodes.length > 0) {
                        // class="InjectLayout-sc-1i43xsx-0" 等のラップ要素は中身を再帰的に見る
                        parseNodes(child);
                    } else if (child.textContent) {
                        // その他（リンクなど）はテキストとして扱う
                        fragments.push({ type: 'text', text: child.textContent });
                    }
                }
            });
        };

        parseNodes(bodyNode);
        return fragments;
    }
};

let screen, board;
let commentContainer; // 16:9を維持するコメント描画用コンテナ
let resizeObserver;   // 画面リサイズ検知用
let commentQueue = [];
let queueTimer = null;
const QUEUE_PROCESS_INTERVAL = 100;

let lanes = {}; // 0.5刻みを保持するためオブジェクトとして扱う
let ttsCount = 0; // 読み上げ中のコメント数
let recentTtsTexts = []; // 重複読み上げ防止用履歴
const MAX_TTS_HISTORY = 20; // 保持する履歴の最大件数

let managedTtsQueue = [];   // アプリ側で管理する読み上げ待ちキュー
let isTtsSpeaking = false;    // 現在読み上げ中かどうか
let activeUtterance = null;   // GC対策: 現在再生中のUtteranceを保持
let ttsHeartbeatTimer = null; // 読み上げ停止防止用ハートビート
let ttsTimeoutTimer = null;   // スタック防止用タイムアウト

let activeAnimations = new Set(); // 実行中のアニメーション管理
let isVideoPaused = false; // 動画の一時停止状態フラグ

let url = document.location.href;
let commentObserver;
let controlsObserver;
let keyEvent;

const core = {
    async waitStart() {
        console.log(SCRIPTNAME, 'waitStart');
        await loadConfig();

        window.setInterval(() => {
            const screen_ = site.getScreen();
            const board_ = site.getBoard();
            const url_ = document.location.href;

            if (screen_ && board_ && (screen_ !== screen || board_ !== board || url_ !== url)) {
                console.log(SCRIPTNAME, 'PageChange or Init detected.');
                screen = screen_;
                board = board_;
                url = url_;
                core.initialize();
            }

            core.createToggleButton();
        }, 3000);
    },

    initialize() {
        console.log(SCRIPTNAME, 'initialize');
        lanes = {};
        ttsCount = 0;
        recentTtsTexts = [];
        managedTtsQueue = [];
        isTtsSpeaking = false;
        activeAnimations.clear();
        isVideoPaused = false;
        commentQueue = [];
        if (queueTimer) {
            clearInterval(queueTimer);
            queueTimer = null;
        }
        core.addKeyEvent();
        core.addStyle();
        core.createContainer(); // コンテナ生成
        core.createToggleButton();
        core.setupVideoSync(); // 動画同期の設定
        core.listenComments();
    },

    /**
     * 動画の再生・停止状態を監視し、アニメーションと同期させる
     */
    setupVideoSync() {
        const video = site.getVideo();
        if (!video) return;

        const onPause = () => {
            isVideoPaused = true;
            activeAnimations.forEach(anim => anim.pause());
            console.debug(SCRIPTNAME, 'Video paused. Animations suspended.');
        };

        const onPlay = () => {
            isVideoPaused = false;
            activeAnimations.forEach(anim => anim.play());
            console.debug(SCRIPTNAME, 'Video started. Animations resumed.');
        };

        video.removeEventListener('pause', onPause);
        video.removeEventListener('waiting', onPause);
        video.removeEventListener('play', onPlay);
        video.removeEventListener('playing', onPlay);

        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onPause);
        video.addEventListener('play', onPlay);
        video.addEventListener('playing', onPlay);

        // 初期状態の反映
        if (video.paused) onPause();
    },

    /**
     * 16:9コメント専用コンテナの作成と維持
     */
    createContainer() {
        if (commentContainer) commentContainer.remove();
        if (resizeObserver) resizeObserver.disconnect();

        commentContainer = document.createElement('div');
        commentContainer.id = SCRIPTNAME + '-container';
        // コンテナ自体のスタイルはオーバーレイ全面。
        // 実際のコメント位置計算に必要な基準として機能する。
        commentContainer.style.cssText = `
            position: absolute;
            pointer-events: none;
            overflow: hidden;
            z-index: 10;
        `;
        screen.appendChild(commentContainer);

        // リサイズ検知とコンテナ寸法の再計算
        resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                core.updateContainerSize(entry.contentRect.width, entry.contentRect.height);
            }
        });
        resizeObserver.observe(screen);

        // 初回の算出
        core.updateContainerSize(screen.offsetWidth, screen.offsetHeight);
    },

    /**
     * プレイヤー領域の寸法変更に伴い、コンテナを16:9に合わせて再計算
     */
    updateContainerSize(screenWidth, screenHeight) {
        if (!commentContainer) return;

        const targetRatio = 16 / 9;
        const currentRatio = screenWidth / screenHeight;

        let cWidth = screenWidth, cHeight = screenHeight;

        if (currentRatio > targetRatio) {
            // 画面が横長すぎる (ピラーボックス)
            cWidth = screenHeight * targetRatio;
        } else {
            // 画面が縦長すぎる (レターボックス)
            cHeight = screenWidth / targetRatio;
        }

        // アンカー設定に合わせた配置 (Center / Top / Bottom)
        let left = (screenWidth - cWidth) / 2, top = 0;

        if (config.anchorPosition === 'Center') {
            top = (screenHeight - cHeight) / 2;
        } else if (config.anchorPosition === 'Bottom') {
            top = screenHeight - cHeight;
        }

        commentContainer.style.width = `${cWidth}px`;
        commentContainer.style.height = `${cHeight}px`;
        commentContainer.style.left = `${left}px`;
        commentContainer.style.top = `${top}px`;
    },

    addKeyEvent() {
        if (keyEvent) window.removeEventListener('keypress', keyEvent);
        keyEvent = (e) => {
            if (e.key === "c" || e.key === "C") {
                const newVisibility = (config.visibility === "visible") ? "hidden" : "visible";
                chrome.storage.local.set({ visibility: newVisibility });
            }
        };
        window.addEventListener('keypress', keyEvent);
    },

    addStyle() {
        document.querySelector('style#' + SCRIPTNAME + 'Style')?.remove();
        const style = document.createElement('style');
        style.id = SCRIPTNAME + 'Style';
        style.innerHTML = `
            .flow-text {
                width: auto !important;
                pointer-events: none;      /* クリック透過 */
                font-family: ${config.fontFamily};
                font-weight: bold;
                white-space: nowrap;       /* 折り返しなし */
                position: absolute;
                color: ${config.color};
                will-change: animation, transform; /* パフォーマンス最適化 */
                opacity: ${config.opacity};

                /* 視認性向上のための縁取り (ベストプラクティス) */
                -webkit-text-stroke: calc(${config.outlineSize}px * 2) ${config.outlineColor};
                paint-order: stroke fill;

                display: flex;
                align-items: center;
                column-gap: 4px;           /* 要素間の隙間 */
            }

            .flow-text img {
                height: 1.2em;             /* 文字サイズに合わせる */
                width: auto;
                vertical-align: middle;
            }
            .scroller-username {
                font-size: 0.7em;         /* ユーザー名を少し小さく */
                margin-right: 10px;
            }`;
        document.head.appendChild(style);
        console.debug(SCRIPTNAME, 'Styles injected.');
    },

    /**
     * プレイヤーコントロールにトグルボタンを追加
     * 広告再生などでDOMが再生成された場合にも対応できるよう、Observerと定期チェックを併用
     */
    createToggleButton() {
        // すでにボタンがあれば何もしない
        if (document.getElementById(SCRIPTNAME + '-toggle-btn')) return;

        // 挿入先: プレイヤーコントロールのグループ
        // PC版: .player-controls__right-control-group
        let rightControls = document.querySelector('.player-controls__right-control-group');

        if (!rightControls) {
            // モバイル版のボタン配置場所を探索 (自動的に隠れるレイヤーを優先)
            const mobileSettingsBtn = document.querySelector('[data-a-target="player-settings-button"]');
            if (mobileSettingsBtn) {
                rightControls = mobileSettingsBtn.closest('.Layout-sc-1xcs6mc-0') || mobileSettingsBtn.parentElement;
            } else {
                rightControls = document.querySelector('.player-controls') ||
                    document.querySelector('.video-player__default-player .Layout-sc-1xcs6mc-0.hyTHZf');
            }
        }

        if (!rightControls) return;

        // 親要素（コントロールグループ）の変更を監視して、ボタンが消されたら再追加する
        if (!controlsObserver) {
            controlsObserver = new MutationObserver(() => {
                core.createToggleButton();
            });
            controlsObserver.observe(rightControls, { childList: true });
        }

        // ボタンコンテナ作成
        const container = document.createElement('div');
        container.className = 'InjectLayout-sc-1i43xsx-0 iDMNUO';
        container.id = SCRIPTNAME + '-toggle-btn';

        // ボタン本体
        const button = document.createElement('button');
        button.className = 'ScCoreButton-sc-ocjdkq-0 glPhvE ScButtonIcon-sc-9yap0r-0 dcNXJO';
        button.ariaLabel = 'スクロールコメント切り替え';

        // アイコン
        const iconDiv = document.createElement('div');
        iconDiv.className = 'ButtonIconFigure-sc-1emm8lf-0 lnTwMD';
        const svgWrapper = document.createElement('div');
        svgWrapper.className = 'ScSvgWrapper-sc-wkgzod-0 kccyMt tw-svg';

        // SVG定義
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '24');
        svg.setAttribute('height', '24');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.classList.add('scroller-toggle-icon');

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z');
        path.id = SCRIPTNAME + '-toggle-path';

        svg.appendChild(path);
        svgWrapper.appendChild(svg);
        iconDiv.appendChild(svgWrapper);
        button.appendChild(iconDiv);
        container.appendChild(button);

        // クリックイベント
        button.onclick = (e) => {
            const newVisibility = (config.visibility === "visible") ? "hidden" : "visible";
            chrome.storage.local.set({ visibility: newVisibility });
            console.log(SCRIPTNAME, 'comment visibility toggled:', newVisibility);
        };

        // 初期状態反映
        core.updateToggleButtonState();

        // 挿入位置の調整: 設定ボタンの左隣に挿入する
        const settingsBtn = rightControls.querySelector('[data-a-target="player-settings-button"]');

        if (settingsBtn) {
            // Settingsボタンを含むコンテナ（rightControlsの直下の子要素）を探して、その前に挿入
            let targetContainer = settingsBtn;
            while (targetContainer && targetContainer.parentElement !== rightControls) {
                targetContainer = targetContainer.parentElement;
            }

            if (targetContainer) {
                rightControls.insertBefore(container, targetContainer);
            } else {
                rightControls.insertBefore(container, rightControls.firstChild);
            }
        } else {
            rightControls.appendChild(container); // 設定ボタンがない場合は末尾に追加
        }
        console.debug(SCRIPTNAME, 'Toggle button created inside rightControls.');
    },

    updateToggleButtonState() {
        const path = document.getElementById(SCRIPTNAME + '-toggle-path');
        if (path) {
            path.setAttribute('fill', config.visibility === 'visible' ? 'currentColor' : '#888');
        }
        const btn = document.getElementById(SCRIPTNAME + '-toggle-btn');
        if (btn) {
            btn.style.opacity = config.visibility === 'visible' ? '1' : '0.5';
        }
    },

    listenComments() {
        if (commentObserver) commentObserver.disconnect();
        commentObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1) {
                            const commentNode = site.getCommentNode(node);
                            if (commentNode) {
                                core.handleComment(commentNode);
                            }
                        }
                    });
                }
            });
        });
        commentObserver.observe(board, { childList: true });
    },

    handleComment(commentNode) {
        // 並行して音声読み上げをトリガー
        core.speakComment(commentNode);

        if (!core.attachComment(commentNode)) {
            if (config.enableQueue) {
                core.enqueueComment(commentNode);
            }
        }
    },

    speakComment(commentNode, preParsedFragments = null) {
        if (!config.ttsEnabled) return;

        let textFragments;
        if (preParsedFragments) {
            textFragments = preParsedFragments.filter(f => f.type === 'text');
        } else if (commentNode) {
            textFragments = chatParser.getBody(commentNode).filter(f => f.type === 'text');
        } else {
            return;
        }

        let text = textFragments.map(f => f.text).join(' ').trim();
        if (!text) return;

        // 重複コメントのスキップ (待ち件数が5件以上の時のみ実行)
        if (ttsCount >= 5) {
            if (recentTtsTexts.includes(text)) {
                return;
            }
        }
        recentTtsTexts.push(text);
        if (recentTtsTexts.length > MAX_TTS_HISTORY) {
            recentTtsTexts.shift();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        if (config.ttsVoice) {
            const voices = speechSynthesis.getVoices();
            const voice = voices.find(v => v.name === config.ttsVoice);
            if (voice) utterance.voice = voice;
        }

        let rate = parseFloat(config.ttsSpeed) || 1.0;

        if (config.ttsAutoSpeed) {
            // 現在のキュー（発話中＋待機中）に応じて速度を上げる
            if (ttsCount >= 1) {
                // 1件から徐々に加速（例: 1件で1.2倍, 3件で1.6倍, 5件で2.0倍）
                rate = rate * (1.0 + ttsCount * 0.2);
            }
        }
        utterance.rate = Math.min(3.0, Math.max(0.1, rate)); // 0.1 ~ 3.0 の範囲に制限
        utterance.volume = Math.min(1.0, Math.max(0.0, parseFloat(config.ttsVolume) || 1.0)); // 0.0 ~ 1.0

        // 完了時にカウントを減らす
        utterance.onstart = () => {
            console.debug(SCRIPTNAME, 'TTS Start:', text.substring(0, 20) + (text.length > 20 ? '...' : ''), `(Queue: ${managedTtsQueue.length})`);
        };
        utterance.onend = () => {
            console.debug(SCRIPTNAME, 'TTS End');
            core.cleanupTts();
        };
        utterance.onerror = (e) => {
            console.error(SCRIPTNAME, 'TTS Error:', e);
            core.cleanupTts();
        };

        ttsCount++;

        // 独自キューに追加して処理を開始
        managedTtsQueue.push(utterance);

        // 最大許容数を超えている場合は古いものを破棄
        while (managedTtsQueue.length > (parseInt(config.ttsMaxQueue) || 5)) {
            managedTtsQueue.shift();
            ttsCount = Math.max(0, ttsCount - 1);
        }

        core.processNextTts();
    },

    /**
     * 次のTTSキューを処理する
     */
    processNextTts() {
        if (isTtsSpeaking || managedTtsQueue.length === 0) return;

        // ブラウザのTTSエンジンがポーズ状態になっている場合があるための対策
        if (speechSynthesis.paused) {
            console.debug(SCRIPTNAME, 'TTS Engine was paused. Resuming...');
            speechSynthesis.resume();
        }

        activeUtterance = managedTtsQueue.shift();
        isTtsSpeaking = true;

        // タイムアウト監視: 15秒以上経っても終わらない場合は強制終了して次へ
        if (ttsTimeoutTimer) clearTimeout(ttsTimeoutTimer);
        ttsTimeoutTimer = setTimeout(() => {
            if (isTtsSpeaking) {
                console.warn(SCRIPTNAME, 'TTS Timeout detected. Forcing next.');
                speechSynthesis.cancel();
                core.cleanupTts();
            }
        }, 15000);

        // ハートビート処理: Chromiumのバグ（長時間再生で止まる）対策
        if (ttsHeartbeatTimer) clearInterval(ttsHeartbeatTimer);
        ttsHeartbeatTimer = setInterval(() => {
            if (speechSynthesis.speaking) {
                speechSynthesis.pause();
                speechSynthesis.resume();
            }
        }, 5000);

        speechSynthesis.speak(activeUtterance);
    },

    /**
     * TTSのリソースとタイマーをクリーンアップ
     */
    cleanupTts() {
        if (ttsHeartbeatTimer) {
            clearInterval(ttsHeartbeatTimer);
            ttsHeartbeatTimer = null;
        }
        if (ttsTimeoutTimer) {
            clearTimeout(ttsTimeoutTimer);
            ttsTimeoutTimer = null;
        }
        ttsCount = Math.max(0, ttsCount - 1);
        isTtsSpeaking = false;
        activeUtterance = null;
        core.processNextTts();
    },

    enqueueComment(commentNode) {
        const fragments = [
            ...chatParser.getBadges(commentNode),
            chatParser.getAuthor(commentNode),
            ...chatParser.getBody(commentNode)
        ].filter(f => f);

        if (fragments.length > 0) {
            commentQueue.push(fragments);
            core.startQueueProcessing();
        }
    },

    startQueueProcessing() {
        if (queueTimer) return;

        queueTimer = setInterval(() => {
            if (commentQueue.length === 0) {
                clearInterval(queueTimer);
                queueTimer = null;
                return;
            }

            if (isVideoPaused) return; // 動画停止中はキューを処理しない

            const fragments = commentQueue[0];
            if (core.attachComment(null, fragments)) {
                commentQueue.shift();
            }
        }, QUEUE_PROCESS_INTERVAL);
    },

    attachComment(commentNode, preParsedFragments = null) {
        if (!commentContainer || isVideoPaused) return false;

        let fragments;

        if (preParsedFragments) {
            fragments = preParsedFragments;
        } else if (commentNode) {
            // パーサーを使ってバッジ、名前、本文を取得・結合
            fragments = [
                ...chatParser.getBadges(commentNode),
                chatParser.getAuthor(commentNode),
                ...chatParser.getBody(commentNode)
            ].filter(f => f); // nullを除外
        } else {
            return false;
        }

        if (fragments.length === 0) return false;

        // 1. DOMフラグメントの作成 (表示内容の構築)
        const fragmentContainer = document.createDocumentFragment();
        fragments.forEach(f => {
            if (f.type === 'text') {
                const span = document.createElement('span');
                span.innerText = f.text;
                if (f.color) span.style.color = f.color;
                if (f.class) span.className = f.class;
                fragmentContainer.appendChild(span);
            } else if (f.type === 'image') {
                const img = document.createElement('img');
                img.src = f.src;
                if (f.class) img.className = f.class;
                // アスペクト比から幅を設定

                if (f.ratio) {
                    // バッジは少し小さく(0.5em)、スタンプはそのまま(1.0em)
                    const height = (f.class === 'scroller-badge') ? 0.5 : 1.0;
                    img.style.height = height + 'em';
                    img.style.width = (f.ratio * height) + 'em';
                }
                fragmentContainer.appendChild(img);
            }
        });

        // コンテナの現時点の寸法
        const cWidth = commentContainer.offsetWidth;
        const cHeight = commentContainer.offsetHeight;
        if (cWidth === 0 || cHeight === 0) return false;

        // 2. フォントサイズと1レーンの高さを計算
        let laneHeight, fontSizeStr;
        if (config.fontSizeMode === 'Auto') {
            const pxSize = cHeight / config.displayLines * 0.8;
            laneHeight = cHeight / config.displayLines;
            fontSizeStr = `${pxSize}px`;
        } else {
            fontSizeStr = config.customFontSize;
            // px, em などを解釈させるためのダミー
            const tempDiv = document.createElement('div');
            tempDiv.style.cssText = `position:absolute; visibility:hidden; font-size:${fontSizeStr};`;
            tempDiv.innerText = 'A';
            document.body.appendChild(tempDiv);
            laneHeight = tempDiv.offsetHeight;
            document.body.removeChild(tempDiv);
            if (laneHeight === 0) {
                laneHeight = 32;
                fontSizeStr = '32px';
            }
        }

        // 3. コンテンツ幅の計算 (衝突判定に必要)
        const tempDiv = document.createElement('div');
        tempDiv.className = "flow-text"; // 本番と同じスタイルを適用
        tempDiv.style.cssText = `position:absolute; visibility:hidden; font-size:${fontSizeStr};`;
        tempDiv.appendChild(fragmentContainer.cloneNode(true));
        document.body.appendChild(tempDiv);

        // 幅を取得 (余白として若干プラスする)
        const totalWidth = tempDiv.offsetWidth + parseFloat(fontSizeStr);
        document.body.removeChild(tempDiv);

        if (totalWidth === 0) return false;

        // 4. 衝突・配置計算 (タイムスタンプベース)
        const now = Date.now();
        const distance = cWidth + totalWidth; // 移動総距離 (コンテナ幅 + コメント幅)
        const durationMs = config.duration * 1000;      // 移動にかかる時間 (ms)
        const speed = distance / durationMs;            // 速度 (px/ms)

        const commentData = {
            width: totalWidth,
            // deleteTime: コンテナ左端から完全に消え去る時刻
            deleteTime: now + durationMs,
            // touchLeftEdgeTime: コメント先頭がコンテナ左端に到達する時刻
            touchLeftEdgeTime: now + (cWidth / speed),
            // safeToEnterTime: 次のコメントが重ならずに右端から出現開始できる時刻
            safeToEnterTime: now + (totalWidth / speed)
        };

        // 5. 空きレーンの探索 (displayLines で制限)
        let laneIndex = -1;

        // まず整数の通常レーン (0, 1, 2...) を探索
        for (let i = 0; i < config.displayLines; i++) {
            const lane = lanes[i];

            // レーンが空、または前のコメントが既に消え去っている場合 -> 使用可能
            if (!lane || lane.deleteTime < now) {
                laneIndex = i;
                break;
            }

            // 衝突チェック (通常レーン)
            if (lane.safeToEnterTime <= now && lane.deleteTime <= commentData.touchLeftEdgeTime) {
                laneIndex = i;
                break;
            }
        }

        // 通常レーンに空きがない場合
        if (laneIndex === -1) {
            // マルチレイヤー（強制表示）が有効な場合のみ、0.5行ずらしのレーンを探索
            if (config.enableMultiLayer) {
                // 画面からはみ出ない範囲 (0.5, 1.5 ... displayLines - 1.5) で探索
                for (let i = 0.5; i <= config.displayLines - 1.5; i++) {
                    const lane = lanes[i];

                    // 0.5行レーンが空いているかチェック（上下の重なりは考慮しない）
                    if (!lane || lane.deleteTime < now) {
                        laneIndex = i;
                        break;
                    }
                    if (lane.safeToEnterTime <= now && lane.deleteTime <= commentData.touchLeftEdgeTime) {
                        laneIndex = i;
                        break;
                    }
                }
            }
        }

        // どこにも空きがない場合は表示しない (非表示またはキューイングへ)
        if (laneIndex === -1) return false;

        // レーン情報を更新
        lanes[laneIndex] = commentData;

        // 6. 画面への描画
        const flowText = document.createElement("div");
        flowText.className = "flow-text";

        flowText.style.cssText = `
            visibility: ${config.visibility};
            top: ${laneHeight * laneIndex}px;
            height: ${laneHeight}px;
            font-size: ${fontSizeStr};
            left: 100%;
            white-space: nowrap;
        `;

        flowText.appendChild(fragmentContainer);
        commentContainer.appendChild(flowText);

        // Web Animations API によるアニメーション
        const effect = [
            { transform: 'translateX(0)' },
            { transform: `translateX(-${cWidth + totalWidth}px)` }
        ];

        const animation = flowText.animate(effect, {
            duration: config.duration * 1000,
            easing: 'linear',
            fill: 'forwards'
        });

        // 停止中なら即座に停止させる
        if (isVideoPaused) animation.pause();

        activeAnimations.add(animation);

        // 終了後に削除
        animation.onfinish = () => {
            activeAnimations.delete(animation);
            flowText.remove();
        };

        return true;
    }
};

core.waitStart();
