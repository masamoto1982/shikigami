// --- Configuration Parameters ---
const CONFIG = {
    debug: true,
    sensitivity: {
        hitRadius: 22,
        minSwipeDistance: 5,
        debounceTime: 50,
    },
    timing: {
        multiStrokeTimeout: 700,
        longPressDuration: 500,
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
    }
};

// --- デバイス検出と調整 ---
const isMobileDevice = () => {
    return (
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.innerWidth <= 768)
    );
};

const adjustForMobile = () => {
    if (isMobileDevice()) {
        // モバイル用の設定調整
        CONFIG.sensitivity.hitRadius = Math.max(CONFIG.sensitivity.hitRadius, 28); // より大きなヒット範囲
        CONFIG.sensitivity.minSwipeDistance = Math.max(CONFIG.sensitivity.minSwipeDistance, 8); // より大きなスワイプ距離
        CONFIG.timing.longPressDuration = Math.min(CONFIG.timing.longPressDuration, 400); // より短い長押し時間
        
        // モバイル用のスクロール防止
        document.body.addEventListener('touchmove', e => {
            if (e.target.closest('#d2d-input')) {
                e.preventDefault();
            }
        }, { passive: false });
    }
};

// --- shikigami Interpreter (簡略版) ---
const shikigamiInterpreter = {
    // 実行処理の入り口（仮実装）
    execute: function(code) {
        try {
            // ここでは実際のコード解析・実行はせず、メッセージを表示するだけ
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
            
            // 実行予定メッセージ
            return "新しい評価機能は開発中です。コードは受け付けました。";
        } catch (error) {
            console.error(`実行エラー:`, error);
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
const lineCtx = elements.lineCanvas.getContext('2d');

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
    longPressTimer: null,
    isLongPress: false,
    currentTouchId: null,
    pointerStartTime: 0,
    pointerStartX: 0,
    pointerStartY: 0
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

// --- Utility Functions ---
const insertAtCursor = (text) => {
    const textarea = elements.input;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = textarea.value.substring(0, start);
    const textAfter = textarea.value.substring(end);
    textarea.value = textBefore + text + textAfter;
    const newCursorPos = start + text.length;
    textarea.selectionStart = textarea.selectionEnd = newCursorPos;
    if (window.innerWidth <= 768) showTextSection();
    textarea.focus();
};

const showTextSection = () => {
    if (window.innerWidth <= 768) {
        elements.outputSection.classList.add('hide');
        elements.textSection.classList.remove('hide');
    }
};

const showOutputSection = () => {
    if (window.innerWidth <= 768) {
        elements.textSection.classList.add('hide');
        elements.outputSection.classList.remove('hide');
    }
};

// --- Canvas Drawing Functions ---
const clearCanvas = () => {
    lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
};

const updateCanvas = () => {
    const canvas = elements.lineCanvas;
    const ctx = lineCtx;
    const grid = elements.dotGrid;
    if (!grid || !canvas) return;
    const gridRect = grid.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const numericDotsToConnect = [];
    drawState.detectedDots.forEach(dot => {
        if (dot.classList.contains('numeric')) numericDotsToConnect.push(dot);
    });

    if (numericDotsToConnect.length < 1) return;

    ctx.beginPath();
    ctx.strokeStyle = CONFIG.visual.lineColor;
    ctx.lineWidth = CONFIG.visual.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isFirst = true;
    numericDotsToConnect.forEach(dot => {
        const rect = dot.getBoundingClientRect();
        const x = (rect.left - gridRect.left) + rect.width / 2;
        const y = (rect.top - gridRect.top) + rect.height / 2;
        if (isFirst) ctx.moveTo(x, y), isFirst = false;
        else ctx.lineTo(x, y);
    });

    if (!isFirst) ctx.stroke();
};

// --- Gesture Logic Functions ---
resetDrawState = (keepActive = false) => {
    drawState.isActive = keepActive;
    drawState.detectedDots.forEach(dot => dot.classList.remove('detected'));
    drawState.detectedDots.clear();
    drawState.totalValue = 0;
    drawState.isLongPress = false;
    drawState.currentStrokeDetected = false;
    if (!keepActive) drawState.lastStrokeTime = 0;
    clearTimeout(drawState.longPressTimer);
    clearTimeout(drawState.strokeTimer);
    drawState.longPressTimer = drawState.strokeTimer = null;
};

const recognizeLetter = (totalValue) => {
    const recognized = letterPatterns[totalValue] || null;
    if (recognized && CONFIG.debug) debugLog(`認識: 値=${totalValue}, 文字=${recognized}`);
    else if (CONFIG.debug) debugLog(`認識失敗: 値=${totalValue}`);
    return recognized;
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
                        const fb = document.createElement('div');
                        fb.className = 'recognition-feedback';
                        fb.textContent = rec;
                        elements.d2dArea.appendChild(fb);
                        setTimeout(() => fb.remove(), 800);
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
    if (!drawState.isActive) return;
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
        
        // モバイルではヒット判定を少し大きく
        const hitRadius = isMobileDevice() ? CONFIG.sensitivity.hitRadius * 1.2 : CONFIG.sensitivity.hitRadius;
        
        if (dist <= hitRadius) {
            addDetectedDot(dot);
        }
    });

    updateCanvas();
};

const startDrawing = (dotEl, x, y) => {
    if (!dotEl || !dotEl.classList.contains('dot') || !dotEl.closest('#dot-grid')) return;
    const now = Date.now();
    if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
        resetDrawState(true);
    }
    drawState.isActive = true;
    drawState.startX = x;
    drawState.startY = y;
    drawState.lastDetectionTime = now;
    addDetectedDot(dotEl);
    updateCanvas();
};

// --- Event Handlers ---
const handleDeleteAction = (deleteToken = false) => {
    const ta = elements.input;
    const pos = ta.selectionStart;
    if (pos > 0) {
        let before = ta.value.substring(0, pos);
        const after = ta.value.substring(pos);
        if (deleteToken) {
            const idx = before.lastIndexOf(' ');
            before = idx >= 0 ? before.substring(0, idx + 1) : '';
        } else {
            before = before.substring(0, before.length - 1);
        }
        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = before.length;
    }
    showTextSection();
    elements.input.focus();
};

const handleSpecialButtonClick = (e, type, actions) => {
    e.preventDefault();
    const now = Date.now();
    if (specialButtonState.clickTarget === type &&
        now - specialButtonState.lastClickTime < specialButtonState.doubleClickDelay) {
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickCount = 0;
        specialButtonState.clickTarget = null;
        actions.double();
        if (CONFIG.debug) debugLog(`ダブルクリック: ${type}`);
    } else {
        specialButtonState.clickCount = 1;
        specialButtonState.lastClickTime = now;
        specialButtonState.clickTarget = type;
        specialButtonState.clickTimer = setTimeout(() => {
            if (specialButtonState.clickCount === 1) {
                actions.single();
                if (CONFIG.debug) debugLog(`シングルクリック: ${type}`);
            }
            specialButtonState.clickCount = 0;
            specialButtonState.clickTarget = null;
        }, specialButtonState.doubleClickDelay);
    }
};

const handleSpecialButtonLongPress = (e, btn, action) => {
    e.preventDefault();
    const t = setTimeout(() => {
        action();
        btn.classList.add('long-pressed');
        if (CONFIG.debug) debugLog(`長押し: ${btn.dataset.action || btn.dataset.digit}`);
        setTimeout(() => btn.classList.remove('long-pressed'), 200);
    }, CONFIG.timing.longPressDuration);

    const clear = () => {
        clearTimeout(t);
        btn.removeEventListener('pointerup', clear);
        btn.removeEventListener('pointercancel', clear);
        btn.removeEventListener('pointerleave', clear);
    };
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointercancel', clear);
    btn.addEventListener('pointerleave', clear);
};

const executeCode = () => {
    const code = elements.input.value;
    if (!code.trim()) return;
    try {
        const result = shikigamiInterpreter.execute(code);
        elements.output.value = result !== undefined ? result : "実行完了";
        elements.output.classList.add('executed');
        setTimeout(() => elements.output.classList.remove('executed'), 300);
        showOutputSection();
        if (!result.startsWith("エラー:")) elements.input.value = "";
        if (CONFIG.debug) debugLog(`コード実行: ${code.substring(0, 20)}${code.length > 20 ? '...' : ''}`);
    } catch (err) {
        elements.output.value = `エラー: ${err.message}`;
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

const handlePointerDown = (e, el) => {
    e.preventDefault();
    if (el.hasPointerCapture(e.pointerId)) return;
    try { 
        el.setPointerCapture(e.pointerId); 
        el.dataset.pointerId = e.pointerId; 
    } catch (err) { 
        console.error("Error setting pointer capture:", err); 
    }

    showTextSection();
    drawState.isLongPress = false;
    drawState.currentTouchId = e.pointerId;
    drawState.pointerStartTime = Date.now();
    drawState.pointerStartX = e.clientX;
    drawState.pointerStartY = e.clientY;

    const digit = el.dataset.digit;
    const word = el.dataset.word;
    if (digit || word) {
        clearTimeout(drawState.longPressTimer);
        drawState.longPressTimer = setTimeout(() => {
            const dist = Math.hypot(e.clientX - drawState.pointerStartX, e.clientY - drawState.pointerStartY);
            if (dist < CONFIG.sensitivity.minSwipeDistance && (!drawState.isActive || drawState.detectedDots.size <= 1)) {
                insertAtCursor(digit || word);
                drawState.isLongPress = true;
                resetDrawState();
                clearCanvas();
                if (CONFIG.debug) debugLog(`長押し入力: ${digit || word}`);
            }
        }, CONFIG.timing.longPressDuration);
    }

    if (el.closest('#dot-grid')) startDrawing(el, e.clientX, e.clientY);
};

const handlePointerMove = (e) => {
    if (!drawState.isActive || e.pointerId !== drawState.currentTouchId) return;
    e.preventDefault();
    const dx = e.clientX - drawState.pointerStartX;
    const dy = e.clientY - drawState.pointerStartY;
    if (Math.hypot(dx, dy) >= CONFIG.sensitivity.minSwipeDistance) {
        clearTimeout(drawState.longPressTimer);
        drawState.longPressTimer = null;
        detectDot(e.clientX, e.clientY);
    }
};

const handlePointerUp = (e) => {
    if (e.pointerId !== drawState.currentTouchId) return;
    e.preventDefault();
    const el = document.querySelector(`[data-pointer-id="${e.pointerId}"]`);
    if (el?.hasPointerCapture(e.pointerId)) {
        try { 
            el.releasePointerCapture(e.pointerId); 
            delete el.dataset.pointerId; 
        } catch (err) { 
            console.error("Error releasing pointer capture on up:", err); 
        }
    }
    clearTimeout(drawState.longPressTimer);
    if (drawState.isActive && !drawState.isLongPress) endDrawing();
    else if (drawState.isLongPress) {
        resetDrawState();
        clearCanvas();
    }
    drawState.currentTouchId = null;
};

// --- Event Listener Setup ---
const setupDotEventListeners = () => {
    document.querySelectorAll('#dot-grid .dot').forEach(dot => {
        dot.addEventListener('pointerdown', e => handlePointerDown(e, dot), { passive: false });
    });
};

const setupSpecialButtonListeners = () => {
    const deleteBtn = elements.specialRow.querySelector('[data-action="delete"]');
    const zeroBtn   = elements.specialRow.querySelector('[data-digit="0"]');
    const spaceBtn  = elements.specialRow.querySelector('[data-action="space"]');

    if (deleteBtn) {
        deleteBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            handleSpecialButtonLongPress(e, deleteBtn, () => {});
        });
        deleteBtn.addEventListener('click', e => handleSpecialButtonClick(e, 'delete', {
            single: () => handleDeleteAction(false),
            double: () => handleDeleteAction(true),
            long:   () => {}
        }));
    }

    if (zeroBtn) {
        zeroBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            handleSpecialButtonLongPress(e, zeroBtn, () => {});
        });
        zeroBtn.addEventListener('click', e => handleSpecialButtonClick(e, 'zero', {
            single: () => insertAtCursor('0'),
            double: () => {},
            long:   () => {}
        }));
    }

    if (spaceBtn) {
        spaceBtn.addEventListener('pointerdown', e => {
            e.preventDefault();
            handleSpecialButtonLongPress(e, spaceBtn, () => {});
        });
        spaceBtn.addEventListener('click', e => handleSpecialButtonClick(e, 'space', {
            single: () => insertAtCursor(' '),
            double: () => insertAtCursor('\n'),
            long:   () => {}
        }));
    }
};

const setupExecuteButtonListener = () => {
    elements.executeButton.addEventListener('click', executeCode);
};

const resizeCanvas = () => {
    const rect = elements.d2dArea.getBoundingClientRect();
    const style = window.getComputedStyle(elements.d2dArea);
    const pl = parseFloat(style.paddingLeft);
    const pt = parseFloat(style.paddingTop);
    elements.lineCanvas.width  = elements.d2dArea.clientWidth  - pl * 2;
    elements.lineCanvas.height = elements.d2dArea.clientHeight - pt * 2;
    elements.lineCanvas.style.left = `${pl}px`;
    elements.lineCanvas.style.top  = `${pt}px`;
    updateCanvas();
};

const setupGestureListeners = () => {
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup',   handlePointerUp,   { passive: false });
    document.addEventListener('pointercancel', handlePointerUp,  { passive: false });
};

// --- Debug Interface & Helpers ---
const debugLog = (msg) => {
    if (!CONFIG.debug) return;
    const out = document.getElementById('debug-output');
    if (!out) return;
    const e = document.createElement('div');
    e.textContent = `${new Date().toLocaleTimeString()}: ${msg}`;
    out.prepend(e);
    while (out.children.length > 10) out.removeChild(out.lastChild);
};

const addSliderControl = (parent, id, label, min, max, val, onChange) => {
    const c = document.createElement('div'); c.className = 'control-container';
    const l = document.createElement('label'); l.htmlFor = `control-${id}`; l.textContent = `${label}: `;
    const s = document.createElement('input'); s.type = 'range'; s.id = `control-${id}`; s.min = min; s.max = max; s.value = val;
    const v = document.createElement('span'); v.className = 'value-display'; v.textContent = val;
    s.addEventListener('input', () => { v.textContent = s.value; onChange(s.value); });
    c.appendChild(l); c.appendChild(s); c.appendChild(v);
    parent.appendChild(c);
};

const updateConfigStyles = () => {
    const existing = document.getElementById('dynamic-config-styles');
    if (existing) existing.remove();
    const s = document.createElement('style'); s.id = 'dynamic-config-styles';
    s.textContent = `
        .dot {
            width: ${CONFIG.layout.dotSize}px;
            height: ${CONFIG.layout.dotSize}px;
        }
        .dot.detected {
            background-color: ${CONFIG.visual.detectedColor};
        }
        #line-canvas { pointer-events: none; }
    `;
    document.head.appendChild(s);
};

const setupDebugInterface = () => {
    if (!CONFIG.debug || window.innerWidth <= 768) return;
    const section = document.createElement('section');
    section.id = 'debug-panel';
    const h2 = document.createElement('h2'); h2.textContent = 'debug controls';
    section.appendChild(h2);

    addSliderControl(section, 'hitRadius', 'Hit Radius', 5, 50, CONFIG.sensitivity.hitRadius, v => CONFIG.sensitivity.hitRadius = Number(v));
    addSliderControl(section, 'minSwipe', 'Min Swipe', 1, 20, CONFIG.sensitivity.minSwipeDistance, v => CONFIG.sensitivity.minSwipeDistance = Number(v));
    addSliderControl(section, 'multiStroke', 'Multi-Stroke Timeout', 100, 2000, CONFIG.timing.multiStrokeTimeout, v => { CONFIG.timing.multiStrokeTimeout = Number(v); });
    addSliderControl(section, 'longPress', 'Long Press Duration', 100, 1000, CONFIG.timing.longPressDuration, v => CONFIG.timing.longPressDuration = Number(v));
    addSliderControl(section, 'debounce', 'Debounce Time', 10, 200, CONFIG.sensitivity.debounceTime, v => CONFIG.sensitivity.debounceTime = Number(v));
    addSliderControl(section, 'dotSize', 'Dot Size', 30, 80, CONFIG.layout.dotSize, v => { CONFIG.layout.dotSize = Number(v); updateConfigStyles(); initKeypad(); });
    addSliderControl(section, 'dotGap', 'Dot Gap', 5, 30, CONFIG.layout.dotGap, v => { CONFIG.layout.dotGap = Number(v); updateConfigStyles(); initKeypad(); });

    const sampleCodes = {
        'FizzBuzz': `# FizzBuzz サンプル
FIZZBUZZ => (MAX) => {
    RESULT => []
    RANGE(1, MAX).forEach((X) => {
        OUTPUT => 
            X % 15 == 0 ? "FizzBuzz"
            : X % 3 == 0 ? "Fizz"
            : X % 5 == 0 ? "Buzz"
            : X.toString()
        RESULT.push(OUTPUT)
    })
    RESULT
}
PRINT(FIZZBUZZ(20).join(", "))`,
        '計算例': `# 分数計算
A => 3/4
B => 1/2
SUM => A + B
PRINT("合計: " + SUM)`
    };
    const btnContainer = document.createElement('div');
    btnContainer.style.display = 'flex';
    btnContainer.style.gap = '10px';
    btnContainer.style.marginBottom = '10px';
    for (const [name, code] of Object.entries(sampleCodes)) {
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.style.padding = '5px 10px';
        btn.style.border = '1px solid #ccc';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', () => { elements.input.value = code; });
        btnContainer.appendChild(btn);
    }
    section.appendChild(btnContainer);

    const debugOut = document.createElement('div');
    debugOut.id = 'debug-output';
    debugOut.className = 'debug-output';
    section.appendChild(debugOut);

    document.querySelector('article').appendChild(section);
};

const initResponsiveLayout = () => {
    window.addEventListener('resize', () => {
        if (window.innerWidth <= 768) {
            const dp = document.getElementById('debug-panel');
            if (dp) dp.style.display = 'none';
        } else {
            const dp = document.getElementById('debug-panel');
            if (dp && CONFIG.debug) dp.style.display = 'block';
            elements.outputSection.classList.remove('hide');
            elements.textSection.classList.remove('hide');
        }
        resizeCanvas();
    });
    if (window.innerWidth <= 768) {
        elements.outputSection.classList.add('hide');
        elements.textSection.classList.remove('hide');
    }
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

    elements.d2dArea.tabIndex = -1;

    elements.input.addEventListener('focus', e => {
        if (!e.isTrusted) elements.d2dArea.focus();
    });
    
    elements.d2dArea.addEventListener('touchstart', (e) => {
        if (document.activeElement === elements.input) elements.d2dArea.focus();
        showTextSection();
        // モバイルでのスクロール防止
        if (e.target.closest('#d2d-input')) {
            e.preventDefault();
        }
    }, { passive: false });

    updateConfigStyles();
    resizeCanvas();

    setupDotEventListeners();
    setupSpecialButtonListeners();
    setupGestureListeners();
}

// --- Initialization on load ---
window.onload = () => {
    // モバイル環境用の調整を適用
    adjustForMobile();
    
    initKeypad();
    initResponsiveLayout();
    setupDebugInterface();
    setupExecuteButtonListener();
    setupKeyboardHandlers();
    
    // タッチ操作の最適化
    if (isMobileDevice()) {
        document.addEventListener('touchstart', e => {
            if (e.target.closest('#d2d-input')) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // キャンバスのリサイズ
    resizeCanvas();
};