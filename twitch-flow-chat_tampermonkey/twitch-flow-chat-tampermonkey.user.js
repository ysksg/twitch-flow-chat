// ==UserScript==
// @name        Twitch Flow Chat
// @namespace   まままうす
// @description Twitch のコメントをニコニコ風にスクロールさせます。
// @match       https://*.twitch.tv/*
// @version     1.6.1
// @require     https://openuserjs.org/src/libs/sizzle/GM_config.js
// @grant       GM_registerMenuCommand
// @grant       GM_getValue
// @grant       GM_setValue
// @author      まままうす
// ==/UserScript==

(function () {
    const SCRIPTNAME = 'ScreenCommentScroller';

    /**
     * ローカライズ用メッセージ定義
     */
    const translations = {
        ja: {
            LANGUAGE: '言語 (Language)',
            COLOR: '文字色',
            OCOLOR: '縁取り色',
            OUTLINE_SIZE: '縁取りサイズ (px)',
            OPACITY: '不透明度',
            DISPLAY_LINES: '表示最大行数',
            FONT_SIZE_MODE: 'フォントサイズ算出モード',
            CUSTOM_FONT_SIZE: '固定フォントサイズ',
            FONT_FAMILY: 'フォントファミリー',
            ANCHOR_POSITION: '表示アンカー位置',
            DURATION: 'スクロール秒数',
            SHOW_BADGES: 'バッジを表示',
            SHOW_USERNAME: 'ユーザー名を表示',
            USE_USER_COLOR: 'ユーザー名に色を付ける',
            ENABLE_QUEUE: '溢れたコメントをストック',
            ENABLE_MULTI_LAYER: 'レーン満杯時に隙間に強制表示',
            TTS_ENABLED: '音声読み上げ (TTS) を有効にする',
            TTS_VOICE: '読み上げ音声',
            TTS_VOLUME: '読み上げ音量',
            TTS_SPEED: '読み上げ基本速度',
            TTS_MAX_QUEUE: '読み上げ待ちの最大数',
            TTS_AUTO_SPEED: '量に応じて速度を上げる',
            SAVE: '保存',
            CLOSE: '閉じる',
            RESET: 'デフォルトに戻す'
        },
        en: {
            LANGUAGE: 'Language',
            COLOR: 'Text Color',
            OCOLOR: 'Outline Color',
            OUTLINE_SIZE: 'Outline Size (px)',
            OPACITY: 'Opacity',
            DISPLAY_LINES: 'Max Display Lines',
            FONT_SIZE_MODE: 'Font Size Mode',
            CUSTOM_FONT_SIZE: 'Custom Font Size',
            FONT_FAMILY: 'Font Family',
            ANCHOR_POSITION: 'Anchor Position',
            DURATION: 'Scroll Duration (sec)',
            SHOW_BADGES: 'Show Badges',
            SHOW_USERNAME: 'Show Username',
            USE_USER_COLOR: 'Color Username',
            ENABLE_QUEUE: 'Queue Overflow Comments',
            ENABLE_MULTI_LAYER: 'Force Display on Full Lanes',
            TTS_ENABLED: 'Enable TTS',
            TTS_VOICE: 'TTS Voice',
            TTS_VOLUME: 'TTS Volume',
            TTS_SPEED: 'TTS Speed',
            TTS_MAX_QUEUE: 'Max TTS Queue',
            TTS_AUTO_SPEED: 'Auto Speed Increase',
            SAVE: 'Save',
            CLOSE: 'Close',
            RESET: 'Reset'
        }
    };

    /**
     * 設定管理オブジェクト
     * ユーザー設定のデフォルト値と、GM_configからの読み込み同期を担当
     */
    const config = {
        language: '',              // 言語設定
        visibility: "visible",     // 表示状態 (visible/hidden)
        color: '#ffffff',          // 文字色
        outlineColor: '#000000',   // 縁取り色
        opacity: 0.6,              // 不透明度
        displayLines: 15,          // 実際に表示を許可する行数 (Autoモードの算出基準)
        fontSizeMode: 'Auto',      // サイズ計算モード (Auto/Custom)
        customFontSize: '32px',    // カスタムサイズ (Customモード用)
        fontFamily: 'sans-serif',  // フォントファミリー
        anchorPosition: 'Center',  // 表示アンカー (Center/Top/Bottom)
        duration: 5,               // 画面を横切る時間 (秒)
        showBadges: true,          // バッジ表示フラグ
        showUsername: true,        // ユーザー名表示フラグ
        useUserColor: true,        // ユーザー名の色適用フラグ
        enableQueue: false,        // 溢れたコメントをストックするかどうか
        outlineSize: 2,            // 縁取りサイズ (px)
        enableMultiLayer: true,    // マルチレイヤー表示フラグ
        ttsEnabled: false,         // 音声読み上げフラグ
        ttsVoice: null,            // 読み上げ音声
        ttsVolume: 1.0,            // 読み上げ音量
        ttsSpeed: 1.0,             // 読み上げ基本速度
        ttsMaxQueue: 5,            // 読み上げ待ちの最大許容数
        ttsAutoSpeed: true,        // 数に応じた速度自動調整

        /**
         * 設定の同期
         * GM_configから保存された設定を読み込み、このオブジェクトのプロパティを更新する
         */
        /**
         * 設定の同期
         * GM_configから保存された設定を読み込み、このオブジェクトのプロパティを更新する
         * @param {Object} [instance] GM_configのインスタンス（省略時はグローバルのGM_configを使用）
         */
        update(instance) {
            const cfg = instance || GM_config;
            // GM_configが初期化されていない場合は何もしない
            if (!cfg || !cfg.fields) {
                console.debug(SCRIPTNAME, 'Config.update skipped: GM_config not initialized.');
                return;
            }

            try {
                this.language = cfg.get('LANGUAGE') || (navigator.language.startsWith('ja') ? 'ja' : 'en');
                this.color = cfg.get('COLOR') || this.color;
                this.outlineColor = cfg.get('OCOLOR') || this.outlineColor;
                this.outlineSize = cfg.get('OUTLINE_SIZE') || this.outlineSize;
                this.opacity = cfg.get('OPACITY') || this.opacity;
                this.displayLines = cfg.get('DISPLAY_LINES') || this.displayLines;
                this.fontSizeMode = cfg.get('FONT_SIZE_MODE') || this.fontSizeMode;
                this.customFontSize = cfg.get('CUSTOM_FONT_SIZE') || this.customFontSize;
                this.fontFamily = cfg.get('FONT_FAMILY') || this.fontFamily;
                this.anchorPosition = cfg.get('ANCHOR_POSITION') || this.anchorPosition;
                this.duration = cfg.get('DURATION') || this.duration;
                this.showBadges = cfg.get('SHOW_BADGES');
                this.showUsername = cfg.get('SHOW_USERNAME');
                this.useUserColor = cfg.get('USE_USER_COLOR');
                this.enableQueue = cfg.get('ENABLE_QUEUE');

                this.enableMultiLayer = cfg.get('ENABLE_MULTI_LAYER');
                this.ttsEnabled = cfg.get('TTS_ENABLED');
                this.ttsVoice = cfg.get('TTS_VOICE');
                this.ttsVolume = cfg.get('TTS_VOLUME');
                this.ttsSpeed = cfg.get('TTS_SPEED');
                this.ttsMaxQueue = cfg.get('TTS_MAX_QUEUE') || 5;
                this.ttsAutoSpeed = cfg.get('TTS_AUTO_SPEED');

                console.debug(SCRIPTNAME, 'Config updated:', JSON.parse(JSON.stringify(this)));
            } catch (e) {
                console.error(SCRIPTNAME, 'Config update failed:', e);
            }
        },

        initialized: false,

        /**
         * GM_configの初期化
         */
        init() {
            if (this.initialized) return;

            const currentLang = GM_getValue('LANGUAGE', (navigator.language.startsWith('ja') ? 'ja' : 'en'));
            const t = translations[currentLang] || translations['en'];

            const self = this;
            GM_config.init({
                id: SCRIPTNAME + 'Config',
                title: SCRIPTNAME + ' Settings',
                fields: {
                    LANGUAGE: {
                        label: t.LANGUAGE,
                        type: 'select',
                        options: ['ja', 'en'],
                        default: currentLang
                    },
                    COLOR: {
                        label: t.COLOR,
                        type: 'text',
                        default: this.color
                    },
                    OCOLOR: {
                        label: t.OCOLOR,
                        type: 'text',
                        default: this.outlineColor
                    },
                    OUTLINE_SIZE: {
                        label: t.OUTLINE_SIZE,
                        type: 'unsigned float',
                        default: this.outlineSize
                    },
                    OPACITY: {
                        label: t.OPACITY,
                        type: 'float',
                        default: this.opacity
                    },
                    DISPLAY_LINES: {
                        label: t.DISPLAY_LINES,
                        type: 'unsigned int',
                        default: this.displayLines
                    },
                    FONT_SIZE_MODE: {
                        label: t.FONT_SIZE_MODE,
                        type: 'select',
                        options: ['Auto', 'Custom'],
                        default: this.fontSizeMode
                    },
                    CUSTOM_FONT_SIZE: {
                        label: t.CUSTOM_FONT_SIZE,
                        type: 'text',
                        default: this.customFontSize
                    },
                    FONT_FAMILY: {
                        label: t.FONT_FAMILY,
                        type: 'text',
                        default: this.fontFamily
                    },
                    ANCHOR_POSITION: {
                        label: t.ANCHOR_POSITION,
                        type: 'select',
                        options: ['Center', 'Top', 'Bottom'],
                        default: this.anchorPosition
                    },
                    DURATION: {
                        label: t.DURATION,
                        type: 'unsigned float',
                        default: this.duration
                    },
                    SHOW_BADGES: {
                        label: t.SHOW_BADGES,
                        type: 'checkbox',
                        default: this.showBadges
                    },
                    SHOW_USERNAME: {
                        label: t.SHOW_USERNAME,
                        type: 'checkbox',
                        default: this.showUsername
                    },
                    USE_USER_COLOR: {
                        label: t.USE_USER_COLOR,
                        type: 'checkbox',
                        default: this.useUserColor
                    },
                    ENABLE_QUEUE: {
                        label: t.ENABLE_QUEUE,
                        type: 'checkbox',
                        default: this.enableQueue
                    },
                    ENABLE_MULTI_LAYER: {
                        label: t.ENABLE_MULTI_LAYER,
                        type: 'checkbox',
                        default: this.enableMultiLayer
                    },
                    TTS_ENABLED: {
                        label: t.TTS_ENABLED,
                        type: 'checkbox',
                        default: this.ttsEnabled
                    },
                    TTS_VOICE: {
                        label: t.TTS_VOICE,
                        type: 'select',
                        options: ['(Default)'], // openイベントで動的に追加
                        default: this.ttsVoice
                    },
                    TTS_VOLUME: {
                        label: t.TTS_VOLUME,
                        type: 'float',
                        default: this.ttsVolume
                    },
                    TTS_SPEED: {
                        label: t.TTS_SPEED,
                        type: 'float',
                        default: this.ttsSpeed
                    },
                    TTS_MAX_QUEUE: {
                        label: t.TTS_MAX_QUEUE,
                        type: 'unsigned int',
                        default: this.ttsMaxQueue
                    },
                    TTS_AUTO_SPEED: {
                        label: t.TTS_AUTO_SPEED,
                        type: 'checkbox',
                        default: this.ttsAutoSpeed
                    },
                    TTS_SAMPLE_BTN: {
                        label: 'Sample Voice',
                        type: 'button',
                        click: () => {
                            const voiceName = GM_config.get('TTS_VOICE');
                            const speed = parseFloat(GM_config.get('TTS_SPEED')) || 1.0;
                            const volume = parseFloat(GM_config.get('TTS_VOLUME')) || 1.0;
                            const text = (voiceName.includes('ja') || voiceName.includes('JP'))
                                ? "これはサンプル音声です"
                                : "This is a sample voice";

                            const utterance = new SpeechSynthesisUtterance(text);
                            const voices = speechSynthesis.getVoices();
                            const voice = voices.find(v => v.name === voiceName);
                            if (voice) utterance.voice = voice;
                            utterance.rate = speed;
                            utterance.volume = volume;

                            speechSynthesis.cancel();
                            speechSynthesis.speak(utterance);
                        }
                    }
                },
                events: {
                    init: function() {
                        self.update(this);
                    },
                    save: function() {
                        self.update(this);
                        const newLang = this.get('LANGUAGE');
                        if (newLang !== currentLang) {
                            location.reload();
                        }
                    },
                    open: function() {
                        const configInstance = this;
                        // 音声リストを動的に更新
                        const updateVoiceOptions = () => {
                            const voices = speechSynthesis.getVoices();
                            if (voices.length === 0) return;

                            const voiceField = configInstance.fields['TTS_VOICE'];
                            const select = voiceField.node;
                            if (!select) return;

                            const savedValue = configInstance.get('TTS_VOICE');
                            select.innerHTML = '';

                            const options = [{ name: '', label: '(システムデフォルト)' }];

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

                            sortedVoices.forEach(v => {
                                options.push({ name: v.name, label: `${v.name} (${v.lang})` });
                            });

                            options.forEach(opt => {
                                const el = document.createElement('option');
                                el.value = opt.name;
                                el.textContent = opt.label;
                                if (opt.name === savedValue) el.selected = true;
                                select.appendChild(el);
                            });
                        };

                        if (speechSynthesis.onvoiceschanged !== undefined) {
                            speechSynthesis.onvoiceschanged = updateVoiceOptions;
                        }
                        updateVoiceOptions();
                    }
                }
            });
            this.initialized = true;
        }

    };
    
    // config.init() は後ほど core.initialize 以前に呼び出す

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
     * 生のDOM要素から、スクロール表示に必要なデータ（バッジ、名前、本文）を抽出して構造化データに変換する
     */
    const chatParser = {
        /**
         * バッジ情報の取得
         * @param {HTMLElement} node - コメントノード
         * @returns {Array} バッジ画像データの配列
         */
        getBadges(node) {
            if (!config.showBadges) return [];
            return Array.from(node.querySelectorAll('img.chat-badge')).map(img => ({
                type: 'image',
                src: img.src,
                class: 'scroller-badge',
                // バッジは正方形に近いことが多いが念のためアスペクト比を取得
                ratio: (img.naturalWidth && img.naturalHeight) ? (img.naturalWidth / img.naturalHeight) : 1
            }));
        },

        /**
         * 投稿者情報の取得
         * @param {HTMLElement} node - コメントノード
         * @returns {Object|null} 名前と色情報を含むオブジェクト
         */
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

        /**
         * メッセージ本文の取得
         * テキストとスタンプ(画像)が混在するため、それらを正しい順序で抽出する
         * @param {HTMLElement} node - コメントノード
         * @returns {Array} テキストと画像データの配列
         */
        getBody(node) {
            // LiveチャットとVODチャットでクラス名が異なるため両対応
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

    // グローバル変数定義
    let screen, board;
    let commentContainer; // 16:9を維持するコメント描画用コンテナ
    let resizeObserver;   // 画面リサイズ検知用
    let commentQueue = []; // 溢れたコメントを一時保存するキュー
    let queueTimer = null; // キュー処理用タイマー
    const QUEUE_PROCESS_INTERVAL = 100; // キュー処理間隔 (ms)

    let lanes = {}; // レーン管理: 0.5刻みも対応するためオブジェクトとして扱う
    let ttsCount = 0; // 読み上げ中のコメント数
    let recentTtsTexts = []; // 重複読み上げ防止用履歴
    const MAX_TTS_HISTORY = 20; // 履歴の最大件数

    let managedTtsQueue = [];   // アプリ側で管理する読み上げ待ちキュー
    let isTtsSpeaking = false;    // 現在読み上げ中かどうか
    let activeUtterance = null;   // GC対策: 現在再生中のUtteranceを保持
    let ttsHeartbeatTimer = null; // 読み上げ停止防止用ハートビート
    let ttsTimeoutTimer = null;   // スタック防止用タイムアウト

    let activeAnimations = new Set(); // 実行中のアニメーション管理
    let isVideoPaused = false; // 動画の一時停止状態フラグ

    let url = document.location.href;
    let configEdit = false; // 設定変更検知用フラグ
    let commentObserver; // MutationObserverのインスタンス
    let controlsObserver; // プレイヤーコントロール監視用Observer
    let keyEvent; // キーボードイベントハンドラ

    const core = {
        /**
         * 初期化待ちとページ遷移の監視
         * TwitchはSPA(Single Page Application)のため、URL変更を検知して再初期化が必要
         */
        waitStart() {
            console.log(SCRIPTNAME, 'waitStart');
            window.setInterval(() => {
                const screen_ = site.getScreen();
                const board_ = site.getBoard();
                const url_ = document.location.href;

                // 画面要素が存在し、かつページ遷移や設定変更があった場合に初期化を実行
                if (screen_ && board_ && (screen_ !== screen || board_ !== board || url_ !== url || configEdit)) {
                    console.log(SCRIPTNAME, 'PageChange or Init detected. screen:', !!screen_, 'board:', !!board_, 'url:', url_);
                    screen = screen_;
                    board = board_;
                    url = url_;
                    configEdit = false;
                    core.initialize();
                }

                // ボタンが消えていないか定期チェック (広告明け対策の保険)
                core.createToggleButton();
            }, 3000); // 3秒ごとにチェック
        },

        /**
         * スクリプトの初期化処理
         */
        initialize() {
            console.log(SCRIPTNAME, 'initialize');
            config.init(); // 設定の初期化
            lanes = {}; // レーン情報をリセット
            ttsCount = 0;
            recentTtsTexts = [];
            managedTtsQueue = [];
            isTtsSpeaking = false;
            activeAnimations.clear();
            isVideoPaused = false;
            commentQueue = []; // キューをリセット
            if (queueTimer) {
                clearInterval(queueTimer);
                queueTimer = null;
            }

            core.addKeyEvent();
            core.addStyle();
            core.createContainer(); // コンテナ生成
            core.createToggleButton(); // ボタン追加
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


        /**
         * ショートカットキーの登録
         * 'C'キーでコメント表示のON/OFFを切り替える
         */
        addKeyEvent() {
            if (keyEvent) window.removeEventListener('keypress', keyEvent);
            keyEvent = (e) => {
                if (e.key === "c" || e.key === "C") {
                    config.visibility = (config.visibility === "visible") ? "hidden" : "visible";
                    if (commentContainer) commentContainer.style.visibility = config.visibility;
                    console.log(SCRIPTNAME, 'comment visibility:', config.visibility);

                    // ボタンの見た目も更新
                    core.updateToggleButtonState();
                }
            };
            window.addEventListener('keypress', keyEvent);
        },

        /**
         * CSSスタイルの注入
         * アニメーション定義や共通クラスをheadに追加
         */
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
                    line-height: normal;       /* 行高をリセット */
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

            let longPressTimer;
            let isLongPress = false;
            const LONG_PRESS_DURATION = 600; // 長押しの閾値 (ms)

            const startLongPress = () => {
                isLongPress = false;
                longPressTimer = setTimeout(() => {
                    isLongPress = true;
                    GM_config.open();
                    console.log(SCRIPTNAME, 'Long press detected: Opening settings');
                }, LONG_PRESS_DURATION);
            };

            const cancelLongPress = () => {
                clearTimeout(longPressTimer);
            };

            // クリックイベント
            button.onclick = (e) => {
                if (isLongPress) {
                    isLongPress = false;
                    return; // 長押し後はトグル処理をスキップ
                }
                config.visibility = (config.visibility === "visible") ? "hidden" : "visible";
                if (commentContainer) commentContainer.style.visibility = config.visibility;
                core.updateToggleButtonState();
                console.log(SCRIPTNAME, 'comment visibility toggled:', config.visibility);
            };

            // マウスイベントでの長押し検知
            button.onmousedown = startLongPress;
            button.onmouseup = cancelLongPress;
            button.onmouseleave = cancelLongPress;

            // タッチイベントでの長押し検知 (モバイル対応)
            button.ontouchstart = (e) => {
                startLongPress();
                // preventDefault は Twitch 本体の挙動に影響する可能性があるため慎重に
            };
            button.ontouchend = cancelLongPress;
            button.ontouchcancel = cancelLongPress;

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

        /**
         * トグルボタンの見た目を現在の設定に合わせて更新
         */
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

        /**
         * コメント欄の監視
         * MutationObserverを使用して新しいコメントの追加を検知する
         */
        listenComments() {
            if (commentObserver) commentObserver.disconnect();
            commentObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1) { // 要素ノードのみ対象
                                const commentNode = site.getCommentNode(node);
                                if (commentNode) {
                                    // console.debug(SCRIPTNAME, 'Comment detected');
                                    core.handleComment(commentNode);
                                }
                            }
                        });
                    }
                });
            });
            commentObserver.observe(board, { childList: true });
        },

        /**
         * コメント処理の入り口
         * @param {HTMLElement} commentNode
         */
        handleComment(commentNode) {
            // 並行して音声読み上げをトリガー
            core.speakComment(commentNode);

            // まずは直接表示を試みる
            if (!core.attachComment(commentNode)) {
                // 表示できなかった場合、設定に応じてキューイング
                if (config.enableQueue) {
                    console.debug(SCRIPTNAME, 'Display failed. Enqueuing comment.');
                    core.enqueueComment(commentNode);
                } else {
                    console.debug(SCRIPTNAME, 'Display failed. Overflow mode is discard.');
                }
            } else {
                // console.debug(SCRIPTNAME, 'Display success (direct).');
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
                if (ttsCount >= 1) {
                    // 1件から徐々に加速（例: 1件で1.2倍, 3件で1.6倍, 5件で2.0倍）
                    rate = rate * (1.0 + ttsCount * 0.2);
                }
            }
            utterance.rate = Math.min(3.0, Math.max(0.1, rate));

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
                    // onError や onend が呼ばれない場合があるため、手動でクリーンアップ
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

        /**
         * コメントをキューに追加し、処理ループを開始する
         * @param {HTMLElement} commentNode
         */
        enqueueComment(commentNode) {
            // DOM要素そのままだとGCされない＆操作できない可能性があるので、
            // 必要なデータだけ抽出してキューに入れるのが理想だが、
            // 現状の chatParser は DOM を引数に取るため、一旦DOMのまま保持する。
            // ただし、画面から消えると querySelector 等が動かなくなる可能性があるため、
            // cloneNode しておくか、parserを通した結果を保持する設計変更が必要かもしれない。
            // ここでは簡易的に、parserを通した結果オブジェクトを保存するように変更する。

            const fragments = [
                ...chatParser.getBadges(commentNode),
                chatParser.getAuthor(commentNode),
                ...chatParser.getBody(commentNode)
            ].filter(f => f);

            if (fragments.length > 0) {
                commentQueue.push(fragments);
                console.debug(SCRIPTNAME, 'Enqueued. Current queue size:', commentQueue.length);
                core.startQueueProcessing();
            }
        },

        /**
         * キュー処理ループの開始
         */
        startQueueProcessing() {
            if (queueTimer) return; // 既に動いていれば何もしない

            console.debug(SCRIPTNAME, 'Starting queue processing loop.');
            queueTimer = setInterval(() => {
                if (commentQueue.length === 0) {
                    console.debug(SCRIPTNAME, 'Queue empty. Stopping loop.');
                    clearInterval(queueTimer);
                    queueTimer = null;
                    return;
                }

                if (isVideoPaused) return; // 動画停止中はキューを処理しない

                // 先頭のコメントを取り出して表示を試みる
                // attachComment は DOM ではなく fragments も受け取れるようにオーバーロードする必要がある
                // または、attachCommentInternal を作って共通化する

                // ここでは attachComment を改修して、DOM または fragments を受け取れるようにする
                const fragments = commentQueue[0];
                if (core.attachComment(null, fragments)) {
                    // 成功したらキューから削除
                    commentQueue.shift();
                    console.debug(SCRIPTNAME, 'Queue processed. Remaining:', commentQueue.length);
                } else {
                    // 失敗したら（空きがないなら）今回はスキップして次回リトライ
                    // ただし、ずっと詰まると古いコメントが流れなくなるため、
                    // 古すぎるコメントを捨てるロジックも将来的には必要かも？
                    // console.debug(SCRIPTNAME, 'Queue process retry failed. No lanes available.');
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

            // 5. 空きレーンの探索 (DISPLAY_LINES で制限)
            let laneIndex = -1;

            // まず整数の通常レーン (0, 1, 2...) を探索
            for (let i = 0; i < config.displayLines; i++) {
                const lane = lanes[i];

                if (!lane || lane.deleteTime < now) {
                    laneIndex = i;
                    break;
                }

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

            // 空きレーンがない場合は表示しない
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
        },

        /**
         * 設定画面の起動メニュー登録
         */
        settings() {
            GM_registerMenuCommand("設定", () => GM_config.open());
        }
    };

    config.init(); // 起動時に一度だけ初期化
    core.settings();
    core.waitStart();
})();