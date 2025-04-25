// --- Configuration Parameters ---
const CONFIG = {
    debug: true,
    sensitivity: {
        hitRadius: 22,
        minSwipeDistance: 5, // モバイルでは小さな値にする必要がある
        debounceTime: 50,
    },
    timing: {
        multiStrokeTimeout: 700,
        doubleTapDelay: 300,
        strokeCooldown: 100,
    },
    layout: {
        dotSize: 45,
        dotGap: 10,
        gridRows: 5,
        gridCols: 5,
    },
    visual: {
        lineWidth: 3,
        lineColor: '#ef4444',
        detectedColor: '#fca5a5',
        // 認識フィードバックのサイズ
        feedbackSize: 120,
        feedbackTextSize: 60
    },
    behavior: {
        autoFocus: false, // 自動フォーカスを無効化
    }
};

// --- 簡略化されたインタープリター ---
const shikigamiInterpreter = {
    execute: function(code) {
        try {
            console.log("実行コード:", code);
            
            // FizzBuzz のショートカット (デモ用)
            if (code.includes("FIZZBUZZ")) {
                let maxNum = 20;
                const match = code.match(/FIZZBUZZ\s*\(\s*(\d+)\s*\)/);
                if (match && match[1]) {
                    maxNum = parseInt(match[1], 10);
                    if (maxNum > 1000) maxNum = 1000;
                }
                const result = [];
                for (let i = 1; i <= maxNum; i++) {
                    if (i % 15 === 0) result.push("FizzBuzz");
                    else if (i % 3 === 0) result.push("Fizz");
                    else if (i % 5 === 0) result.push("Buzz");
                    else result.push(i.toString());
                }
                return result.join(", ");
            }
            
            // 簡易実行 (デモ用)
            if (code.includes("PRINT")) {
                const match = code.match(/PRINT\s*\(\s*["'](.*)["']\s*\)/);
                if (match && match[1]) return match[1];
            }
            
            return "実行完了 (実際の言語処理は実装中)";
        } catch (error) {
            return `エラー: ${error.message}`;
        }
    }
};

// --- DOM Elements (Constants) ---
const elements = {
    dotGrid: document.getElementById('dot-grid'),
    specialRow: document.getElementById('special-row'),
    lineCanvas: document.getElementById('line-canvas'),
    input: document.getElementById('txt-input'),
    d2dArea: document.getElementById('d2d-input'),
    output: document.getElementById('output'),
    executeButton: document.getElementById('execute-button'),
    outputSection: document.getElementById('output-section'),
    textSection: document.getElementById('text-section')
};
const lineCtx = elements.lineCanvas ? elements.lineCanvas.getContext('2d') : null;

// --- Gesture State (Mutable) ---
const drawState = {
    isActive: false,
    detectedDots: new Set(),
    totalValue: 0,
    startX: 0,
    startY: 0,
    lastStrokeTime: 0,
    lastDetectionTime: 0,
    currentStrokeDetected: false,
    strokeTimer: null,
    currentTouchId: null,
    pointerStartTime: 0,
    pointerStartX: 0,
    pointerStartY: 0,
    hasMoved: false, // 移動検出フラグ
    isDrawingMode: false // なぞり書きモードフラグ
};

// ダブルタップ検出のための状態管理
const tapState = {
    lastTapTime: 0,
    lastTapElement: null,
    doubleTapDelay: CONFIG.timing.doubleTapDelay
};

const specialButtonState = {
    lastClickTime: 0,
    clickCount: 0,
    clickTarget: null,
    clickTimer: null,
    doubleClickDelay: 300,
};

const keyState = {
    deletePressed: false,
    spacePressed: false,
    lastPressTime: 0,
    maxTimeDiff: 300
};

// モバイル端末検出
const isMobileDevice = () => {
    return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768) ||
        ('ontouchstart' in window) ||
        (navigator.maxTouchPoints > 0)
    );
};

// --- Utility Functions ---
const insertAtCursor = (text) => {
    const textarea = elements.input;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, start);
    const textAfter = textarea.value.substring(end);
    textarea.value = textBefore + text + textAfter;
    const newCursorPos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    if (window.innerWidth <= 768) showTextSection();
    
    // 自動フォーカスを設定から制御
    if (CONFIG.behavior.autoFocus) {
        textarea.focus();
    }
};

const showTextSection = () => {
    if (window.innerWidth <= 768 && elements.outputSection && elements.textSection) {
        elements.outputSection.classList.add('hide');
        elements.textSection.classList.remove('hide');
    }
};

const showOutputSection = () => {
    if (window.innerWidth <= 768 && elements.outputSection && elements.textSection) {
        elements.textSection.classList.add('hide');
        elements.outputSection.classList.remove('hide');
    }
};

// --- Canvas Drawing Functions ---
const clearCanvas = () => {
    if (lineCtx && elements.lineCanvas) {
        lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
    }
};

// updateCanvasは赤い線を描画しないよう変更
const updateCanvas = () => {
    // 線の描画を無効化 - ドットのハイライトのみで十分
    return;
};

// --- Gesture Logic Functions ---
resetDrawState = (keepActive = false) => {
    drawState.isActive = keepActive;
    drawState.detectedDots.forEach(dot => dot.classList.remove('detected'));
    drawState.detectedDots.clear();
    drawState.totalValue = 0;
    drawState.currentStrokeDetected = false;
    drawState.hasMoved = false;
    drawState.isDrawingMode = false;
    if (!keepActive) drawState.lastStrokeTime = 0;
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
};

const recognizeLetter = (totalValue) => {
    const recognized = letterPatterns[totalValue] || null;
    if (recognized && CONFIG.debug) debugLog(`認識: 値=${totalValue}, 文字=${recognized}`);
    else if (CONFIG.debug) debugLog(`認識失敗: 値=${totalValue}`);
    return recognized;
};

const showRecognitionFeedback = (character) => {
    if (!elements.d2dArea || !character) return;
    
    const fb = document.createElement('div');
    fb.className = 'recognition-feedback';
    fb.textContent = character;
    elements.d2dArea.appendChild(fb);
    
    // CSS側でアニメーションと表示サイズを制御するので、ここではスタイル設定不要
    setTimeout(() => fb.remove(), 800);
};

const endDrawing = () => {
    if (!drawState.isActive) return;
    const now = Date.now();
    drawState.lastStrokeTime = now;

    if (drawState.currentStrokeDetected) {
        drawState.currentStrokeDetected = false;
        drawState.strokeTimer = setTimeout(() => {
            if (Date.now() - drawState.lastStrokeTime >= CONFIG.timing.multiStrokeTimeout - 50) {
                if (drawState.detectedDots.size > 0 && drawState.totalValue > 0) {
                    const rec = recognizeLetter(drawState.totalValue);
                    if (rec) {
                        insertAtCursor(rec);
                        showRecognitionFeedback(rec);
                    }
                }
                resetDrawState();
                clearCanvas();
            }
        }, CONFIG.timing.multiStrokeTimeout);
    }
};

const addDetectedDot = (dot) => {
    if (!dot || drawState.detectedDots.has(dot)) return;
    dot.classList.add('detected');
    drawState.detectedDots.add(dot);
    drawState.currentStrokeDetected = true;
    const v = parseInt(dot.dataset.value, 10);
    if (!isNaN(v)) drawState.totalValue += v;
    if (CONFIG.debug) debugLog(`ドット検出: index=${dot.dataset.index}, value=${v}, total=${drawState.totalValue}`);
};

const detectDot = (x, y) => {
    if (!drawState.isActive || !elements.dotGrid) return;
    const now = Date.now();
    if (now - drawState.lastDetectionTime < CONFIG.sensitivity.debounceTime) return;
    drawState.lastDetectionTime = now;

    // グリッドの位置を取得
    const gridRect = elements.dotGrid.getBoundingClientRect();

    document.querySelectorAll('#dot-grid .dot').forEach(dot => {
        if (drawState.detectedDots.has(dot)) return;
        const r = dot.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        
        // ヒット判定
        const hitRadius = CONFIG.sensitivity.hitRadius;
        
        if (dist <= hitRadius) {
            addDetectedDot(dot);
        }
    });
};

const startDrawing = (dotEl, x, y) => {
    if (!dotEl || !dotEl.classList.contains('dot') || !dotEl.closest('#dot-grid')) return;
    const now = Date.now();
    if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
        resetDrawState(true);
    }
    drawState.isActive = true;
    drawState.isDrawingMode = true; // なぞり書きモードをオン
    drawState.startX = x;
    drawState.startY = y;
    drawState.lastDetectionTime = now;
    addDetectedDot(dotEl);
    
    if (CONFIG.debug) debugLog("なぞり書き開始");
};

// --- Event Handlers ---
const handleDeleteAction = (deleteToken = false) => {
    const ta = elements.input;
    if (!ta) return;

    const pos = ta.selectionStart;
    if (pos > 0) {
        let before = ta.value.substring(0, pos);
        const after = ta.value.substring(pos);

        if (deleteToken) {
            // 改行 or 空白を含めて削除（直前の改行が優先）
            const lastNewline = before.lastIndexOf('\n');
            const lastSpace = before.lastIndexOf(' ');

            let cutoff = 0;
            if (lastNewline !== -1 && lastNewline > lastSpace) {
                cutoff = lastNewline;
            } else if (lastSpace !== -1) {
                cutoff = lastSpace;
            }

            before = before.slice(0, cutoff);
        } else {
            // 単純に1文字削除
            before = before.slice(0, -1);
        }

        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = before.length;
    }

    showTextSection();
    if (CONFIG.behavior.autoFocus && ta) ta.focus();
};



const handleSpecialButtonClick = (e, type, actions) => {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    if (specialButtonState.clickTarget === type &&
        now - specialButtonState.lastClickTime < specialButtonState.doubleClickDelay) {
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickCount = 0;
        specialButtonState.clickTarget = null;
        if (actions.double) actions.double();
        if (CONFIG.debug) debugLog(`ダブルクリック: ${type}`);
    } else {
        specialButtonState.clickCount = 1;
        specialButtonState.lastClickTime = now;
        specialButtonState.clickTarget = type;
        specialButtonState.clickTimer = setTimeout(() => {
            if (specialButtonState.clickCount === 1) {
                if (actions.single) actions.single();
                if (CONFIG.debug) debugLog(`シングルクリック: ${type}`);
            }
            specialButtonState.clickCount = 0;
            specialButtonState.clickTarget = null;
        }, specialButtonState.doubleClickDelay);
    }
};

const executeCode = () => {
    const code = elements.input ? elements.input.value : '';
    if (!code.trim()) return;
    try {
        const result = shikigamiInterpreter.execute(code);
        if (elements.output) {
            elements.output.value = result !== undefined ? result : "実行完了";
            elements.output.classList.add('executed');
            setTimeout(() => elements.output.classList.remove('executed'), 300);
        }
        showOutputSection();
        if (!result.startsWith("エラー:") && elements.input) elements.input.value = "";
        if (CONFIG.debug) debugLog(`コード実行: ${code.substring(0, 20)}${code.length > 20 ? '...' : ''}`);
    } catch (err) {
        if (elements.output) {
            elements.output.value = `エラー: ${err.message}`;
        }
        showOutputSection();
        if (CONFIG.debug) debugLog(`実行エラー: ${err.message}`);
    }
};

const setupKeyboardHandlers = () => {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            keyState.deletePressed = true;
        }
        if ((e.key === ' ' || e.key === 'Spacebar') && document.activeElement !== elements.input) {
            e.preventDefault();
            keyState.spacePressed = true;
        }
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') keyState.deletePressed = false;
        if (e.key === ' ' || e.key === 'Spacebar') keyState.spacePressed = false;
    });
};

// ダブルタップ入力処理
const handleDoubleTap = (el) => {
    const digit = el.dataset.digit;
    const word = el.dataset.word;
    
    if (digit || word) {
        insertAtCursor(digit || word);
        el.classList.add('double-tapped');
        setTimeout(() => el.classList.remove('double-tapped'), 200);
        
        if (CONFIG.debug) debugLog(`ダブルタップ入力: ${digit || word}`);
    }
};

// ポインタイベント処理の改善
const handlePointerDown = (e, el) => {
    if (!e || !el) return;
    if (e.preventDefault) e.preventDefault();

    drawState.currentTouchId = e.pointerId;
    drawState.pointerStartX = e.clientX;
    drawState.pointerStartY = e.clientY;
    drawState.hasMoved = false;

    try {
        if (el && !el.hasPointerCapture(e.pointerId)) {
            el.setPointerCapture(e.pointerId);
            el.dataset.pointerId = e.pointerId;
        }
    } catch (err) {
        console.log("Pointer capture not supported or failed:", err);
    }

    showTextSection();

    const isDot = el.classList.contains('dot') && el.closest('#dot-grid');
    const isSpecialButton = el.classList.contains('special-button');
    const now = Date.now();

    // --- 修正ポイント：シングルタップで文字入力 ---
    if (isDot && !isSpecialButton) {
        const digit = el.dataset.digit;
        const word = el.dataset.word;

        if (digit || word) {
            insertAtCursor(digit || word);
            el.classList.add('double-tapped'); // ビジュアル効果はそのまま活用
            setTimeout(() => el.classList.remove('double-tapped'), 200);
            debugLog(`[D2D] ドットから文字入力: ${digit || word}`);
            return; // なぞり書き開始はスキップ
        }

        // なぞり書き開始条件（dot だけど digit/word 無し＝アルファベット用）
        startDrawing(el, e.clientX, e.clientY);
        debugLog(`[D2D] トレース開始: index=${el.dataset.index}`);
    } else {
        // その他（special-button など）
        debugLog(`[D2D] pointerdown on 非ドット`);
    }
};




const handlePointerMove = (e) => {
    // イベントが無効または別のポインタIDの場合は無視
    if (!e || e.pointerId !== drawState.currentTouchId) return;
    
    // モバイル端末では、より小さな動きでも移動と認識
    const minDistance = isMobileDevice() ? 3 : CONFIG.sensitivity.minSwipeDistance;
    
    const dx = e.clientX - drawState.pointerStartX;
    const dy = e.clientY - drawState.pointerStartY;
    const distance = Math.hypot(dx, dy);
    
    // 移動検出時
    if (distance >= minDistance) {
        drawState.hasMoved = true;
        
        // 移動を検出したらダブルタップの可能性をクリア
        tapState.lastTapTime = 0;
        tapState.lastTapElement = null;
        
        // 描画中なら検出を継続
        if (drawState.isActive && drawState.isDrawingMode) {
            detectDot(e.clientX, e.clientY);
            
            // デバッグログ - モバイル環境でのなぞり書き追跡
            if (isMobileDevice() && CONFIG.debug) {
                debugLog(`移動検出: dx=${dx.toFixed(1)}, dy=${dy.toFixed(1)}, dist=${distance.toFixed(1)}`);
            }
        }
    }
};

const handlePointerUp = (e) => {
    // イベントが無効または別のポインタIDの場合は無視
    if (!e || e.pointerId !== drawState.currentTouchId) return;
    if (e.preventDefault) e.preventDefault();
    
    // ポインタキャプチャ解放
    try {
        const el = document.querySelector(`[data-pointer-id="${e.pointerId}"]`);
        if (el && el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId); 
            delete el.dataset.pointerId; 
        }
    } catch (err) { 
        console.log("Error releasing pointer capture:", err); 
    }
    
    // 描画終了処理 - なぞり書きモードの場合のみ
    if (drawState.isActive && drawState.isDrawingMode) {
        if (CONFIG.debug) debugLog("なぞり書き終了");
        endDrawing();
    }
    
    drawState.currentTouchId = null;
};

// マルチタッチサポートのためのイベントリスナー
const setupMultiTouchSupport = () => {
    // タッチイベントの場合、デフォルトの動作をキャンセル
    if (isMobileDevice()) {
        elements.d2dArea.addEventListener('touchstart', (e) => {
            e.preventDefault();
        }, { passive: false });
        
        elements.d2dArea.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
};

// --- Event Listener Setup ---
const setupDotEventListeners = () => {
    document.querySelectorAll('#dot-grid .dot').forEach(dot => {
        dot.addEventListener('pointerdown', e => handlePointerDown(e, dot), { passive: false });
    });
};

// 特殊ボタン用のイベントリスナー
const setupSpecialButtonListeners = () => {
    const deleteBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="delete"]') : null;
    const zeroBtn = elements.specialRow ? elements.specialRow.querySelector('[data-digit="0"]') : null;
    const spaceBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="space"]') : null;

    if (deleteBtn) {
    deleteBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'delete', {
        single: () => handleDeleteAction(false),
        double: () => handleDeleteAction(true)
    }));
}

    if (zeroBtn) {
        // 0 ボタンはdot-gridの数字と同じ扱い
        zeroBtn.addEventListener('pointerdown', e => handlePointerDown(e, zeroBtn), { passive: false });
    }

    if (spaceBtn) {
    spaceBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'space', {
        single: () => insertAtCursor(' '),
        double: () => insertAtCursor('\n')
    }));
}
};

const setupExecuteButtonListener = () => {
    if (elements.executeButton) {
        elements.executeButton.addEventListener('click', executeCode);
    }
};

const resizeCanvas = () => {
    const d2dArea = elements.d2dArea;
    const canvas = elements.lineCanvas;
    if (!d2dArea || !canvas) return;
    
    const rect = d2dArea.getBoundingClientRect();
    const style = window.getComputedStyle(d2dArea);
    const pl = parseFloat(style.paddingLeft) || 0;
    const pt = parseFloat(style.paddingTop) || 0;
    
    canvas.width = d2dArea.clientWidth - (pl * 2);
    canvas.height = d2dArea.clientHeight - (pt * 2);
    canvas.style.left = `${pl}px`;
    canvas.style.top = `${pt}px`;
    
    clearCanvas();
};

const setupGestureListeners = () => {
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { passive: false });
    document.addEventListener('pointercancel', handlePointerUp, { passive: false });
};

// --- Debug Helper ---
const debugLog = (msg) => {
    if (!CONFIG.debug) return;
    const out = document.getElementById('debug-output');
    if (!out) return;
    const e = document.createElement('div');
    e.textContent = `${new Date().toLocaleTimeString()}: ${msg}`;
    out.prepend(e);
    while (out.children.length > 10) out.removeChild(out.lastChild);
};

const updateConfigStyles = () => {
    const existing = document.getElementById('dynamic-config-styles');
    if (existing) existing.remove();
    const s = document.createElement('style'); 
    s.id = 'dynamic-config-styles';
    s.textContent = `
        .dot {
            width: ${CONFIG.layout.dotSize}px;
            height: ${CONFIG.layout.dotSize}px;
        }
        .dot.detected {
            background-color: ${CONFIG.visual.detectedColor};
        }
        .dot.double-tapped {
            background-color: #fde68a;
            transform: scale(0.95);
            transition: background-color 0.2s, transform 0.2s;
        }
        #line-canvas { pointer-events: none; }
        .recognition-feedback {
            width: ${CONFIG.visual.feedbackSize}px;
            height: ${CONFIG.visual.feedbackSize}px;
            font-size: ${CONFIG.visual.feedbackTextSize}px;
        }
    `;
    document.head.appendChild(s);
};

// --- ドット配置の設定 ---
const dotValues = [
    1, 2, 4, 8, 16, 32, 64, 128, 256, 512,
    1024, 2048, 4096, 8192, 16384, 32768,
    65536, 131072, 262144, 524288, 1048576,
    2097152, 4194304, 8388608, 16777216
];
const letterPatterns = {
    17836036: 'A', 28611899: 'B', 32539711: 'C', 1224985: 'D',
    32567296: 'E', 1113151: 'F', 33092671: 'G', 18415153: 'H',
    32641183: 'I', 7475359: 'J', 17990833: 'K', 32539681: 'L',
    18405233: 'M', 18667121: 'N', 33080895: 'O', 1113663: 'P',
    33347135: 'Q', 18153023: 'R', 33061951: 'S', 4329631:  'T',
    33080881: 'U', 4204561: 'V', 18732593: 'W', 18157905: 'X',
    4329809:  'Y', 32575775: 'Z'
};
const numericPositions = {
    0: '1', 2: '2', 4: '3',
    10: '4', 12: '5', 14: '6',
    20: '7', 22: '8', 24: '9'
};
const dotWordMapping = {
    2: '未定', 8: '未定',
    32: '(', 64: ')', 128: '+', 256: '{', 512: '}',
    2048: '*', 8192: '/',
    32768: '未定', 65536: '未定', 131072: '-', 262144: '未定', 524288: '未定',
    2097152: '>', 8388608: '='
};

// --- Keypad Initialization ---
function initKeypad() {
    if (!elements.dotGrid || !elements.specialRow) return;
    
    elements.dotGrid.innerHTML = '';
    elements.specialRow.innerHTML = '';
    elements.dotGrid.style.gap = `${CONFIG.layout.dotGap}px`;

    for (let r = 0; r < CONFIG.layout.gridRows; r++) {
        const row = document.createElement('div');
        row.className = 'dot-row';
        row.style.gap = `${CONFIG.layout.dotGap}px`;
        for (let c = 0; c < CONFIG.layout.gridCols; c++) {
            const idx = r * CONFIG.layout.gridCols + c;
            const value = dotValues[idx];
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = idx;
            dot.dataset.value = value;
            dot.style.width = `${CONFIG.layout.dotSize}px`;
            dot.style.height = `${CONFIG.layout.dotSize}px`;

            const digit = numericPositions[idx];
            const word  = dotWordMapping[value];
            if (digit) {
                dot.classList.add('numeric');
                dot.textContent = digit;
                dot.dataset.digit = digit;
            } else if (word) {
                dot.classList.add('word-dot');
                dot.textContent = word;
                dot.dataset.word = word;
            } else {
                dot.textContent = '未定';
            }
            row.appendChild(dot);
        }
        elements.dotGrid.appendChild(row);
    }

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'special-button delete';
    deleteBtn.textContent = 'DELETE';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.title = '削除';
    elements.specialRow.appendChild(deleteBtn);

    const zeroBtn = document.createElement('div');
    zeroBtn.className = 'dot numeric';
    zeroBtn.textContent = '0';
    zeroBtn.dataset.digit = '0';
    elements.specialRow.appendChild(zeroBtn);

    const spaceBtn = document.createElement('div');
    spaceBtn.className = 'special-button space';
    spaceBtn.textContent = 'SPACE';
    spaceBtn.dataset.action = 'space';
    spaceBtn.title = '空白';
    elements.specialRow.appendChild(spaceBtn);

    if (elements.d2dArea) elements.d2dArea.tabIndex = -1;

    updateConfigStyles();
    resizeCanvas();

    setupDotEventListeners();
    setupSpecialButtonListeners();
    setupGestureListeners();
    setupMultiTouchSupport();
}

const initResponsiveLayout = () => {
    window.addEventListener('resize', () => {
        resizeCanvas();
    });
    if (window.innerWidth <= 768) {
        if (elements.outputSection) elements.outputSection.classList.add('hide');
        if (elements.textSection) elements.textSection.classList.remove('hide');
    }
};

// --- Initialization on load ---
window.onload = () => {
    initKeypad();
    initResponsiveLayout();
    setupExecuteButtonListener();
    setupKeyboardHandlers();
    
    // キャンバスのリサイズ
    resizeCanvas();
};