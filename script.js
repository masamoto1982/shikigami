// --- Configuration Parameters ---
const CONFIG = {
    // Removed debug flag
    sensitivity: {
        hitRadius: 22,
        minSwipeDistance: 5, // モバイルでは小さな値にする必要がある
        debounceTime: 50
        // Removed tapMaxDistance, tapMaxDuration
    },
    timing: {
        multiStrokeTimeout: 700,
        doubleTapDelay: 300
        // Removed strokeCooldown
    },
    layout: {
        dotSize: 45,
        dotGap: 10,
        gridRows: 5,
        gridCols: 5
    },
    visual: {
        // Removed lineWidth, lineColor
        detectedColor: '#fca5a5',
        // 認識フィードバックのサイズ
        feedbackSize: 120,
        feedbackTextSize: 60
    },
    behavior: {
        autoFocus: false, // 自動フォーカスを無効化
    },
    // ★★★ 新規追加: 認識設定 ★★★
    recognition: {
        tolerance: 1 // 許容するビット差 (1 = ドット1つ分の違いを許容)
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

// Removed tapState object

const specialButtonState = {
    lastClickTime: 0,
    clickCount: 0,
    clickTarget: null,
    clickTimer: null,
    doubleClickDelay: CONFIG.timing.doubleTapDelay // Use config value
};

const keyState = {
    deletePressed: false,
    spacePressed: false,
    lastPressTime: 0,
    maxTimeDiff: 300
};

// モバイル端末検出
const isMobileDevice = () => {
    // Simplified check
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);
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
    if (isMobileDevice()) showTextSection(); // Use isMobileDevice()
    if (CONFIG.behavior.autoFocus) {
        textarea.focus();
    }
};

const showTextSection = () => {
    // ★★★ モバイル判定と要素存在チェックを追加 ★★★
    if (isMobileDevice() && elements.textSection && elements.outputSection) {
        elements.outputSection.classList.add('hide'); // 必ずoutputを隠す
        elements.textSection.classList.remove('hide');
        // console.log("Show Text Section (Mobile)"); // デバッグ用ログ
    }
};

const showOutputSection = () => {
    // ★★★ モバイル判定と要素存在チェックを追加 ★★★
    if (isMobileDevice() && elements.textSection && elements.outputSection) {
        elements.textSection.classList.add('hide'); // 必ずtextを隠す
        elements.outputSection.classList.remove('hide');
        // console.log("Show Output Section (Mobile)"); // デバッグ用ログ
    }
};

// --- Canvas Drawing Functions ---
const clearCanvas = () => {
    const lineCtx = elements.lineCanvas ? elements.lineCanvas.getContext('2d') : null;
    if (lineCtx && elements.lineCanvas) {
        lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
    }
};

// Removed updateCanvas function

// --- Gesture Logic Functions ---
const resetDrawState = (keepActive = false) => {
    drawState.isActive = keepActive;
    // Only remove 'detected' class if dots exist
    if (drawState.detectedDots.size > 0) {
        drawState.detectedDots.forEach(dot => dot.classList.remove('detected'));
        drawState.detectedDots.clear();
    }
    drawState.totalValue = 0;
    drawState.currentStrokeDetected = false;
    drawState.hasMoved = false;
    drawState.isDrawingMode = false;
    if (!keepActive) drawState.lastStrokeTime = 0;
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
};

// ★★★ 認識ロジック修正: 寛容性を導入 ★★★
const recognizeLetter = (totalValue) => {
    // 1. 完全一致チェック
    if (letterPatterns.hasOwnProperty(totalValue)) {
        console.log(`認識成功 (完全一致): 値=${totalValue}, 文字=${letterPatterns[totalValue]}`);
        return letterPatterns[totalValue];
    }

    // 2. 寛容性チェック (tolerance > 0 の場合)
    if (CONFIG.recognition.tolerance > 0 && totalValue > 0) {
        let bestMatch = null;
        let minDiffCount = Infinity; // 使わないが、将来的にtolerance > 1 の場合に備える

        for (const patternValueStr in letterPatterns) {
            const patternValue = parseInt(patternValueStr, 10);
            const diff = totalValue ^ patternValue; // XORで差分ビットを計算

            // 差分が2のべき乗かチェック (ビットが1つだけ立っているか)
            const isPowerOfTwo = (diff > 0) && ((diff & (diff - 1)) === 0);

            if (isPowerOfTwo) {
                // tolerance = 1 の場合、最初に見つかったものを採用
                if (CONFIG.recognition.tolerance === 1) {
                    console.log(`認識成功 (寛容性): 入力=${totalValue}, パターン=${patternValue}, 文字=${letterPatterns[patternValue]}, 差分=${diff}`);
                    bestMatch = letterPatterns[patternValue];
                    break; // 最初の一致で終了
                }
                // tolerance > 1 の場合のロジックはここに追加（例：差分ビット数が最小のものを探すなど）
            }
        }
        if (bestMatch) {
            return bestMatch;
        }
    }

    // 一致なし
    console.log(`認識失敗: 値=${totalValue}`);
    return null;
};


const showRecognitionFeedback = (character) => {
    if (!elements.d2dArea || !character) return;
    const fb = document.createElement('div');
    fb.className = 'recognition-feedback';
    fb.textContent = character;
    elements.d2dArea.appendChild(fb);
    setTimeout(() => fb.remove(), 800);
};

const endDrawing = () => {
    if (!drawState.isActive) return;
    const now = Date.now();
    // Don't update lastStrokeTime immediately, wait for timeout or recognition
    // drawState.lastStrokeTime = now;

    if (drawState.currentStrokeDetected) {
        // Clear existing timer before setting a new one
        clearTimeout(drawState.strokeTimer);

        drawState.strokeTimer = setTimeout(() => {
            if (drawState.detectedDots.size > 0 && drawState.totalValue > 0) {
                const rec = recognizeLetter(drawState.totalValue);
                if (rec) {
                    insertAtCursor(rec);
                    showRecognitionFeedback(rec);
                }
                // Reset after recognition attempt, regardless of success
                resetDrawState();
                clearCanvas();
                drawState.lastStrokeTime = 0; // Reset last stroke time after final processing
            } else {
                 // If no dots were detected, just reset state without recognition
                 resetDrawState();
                 clearCanvas();
                 drawState.lastStrokeTime = 0;
            }
            drawState.strokeTimer = null; // Clear timer reference
        }, CONFIG.timing.multiStrokeTimeout);
    } else if (!drawState.strokeTimer) {
        // If drawing ended without detecting dots (e.g., quick tap on empty space)
        // and no timer is running, reset immediately.
         resetDrawState();
         clearCanvas();
         drawState.lastStrokeTime = 0;
    }
     // Update last stroke time potentially used by startDrawing check
     drawState.lastStrokeTime = now;
};


const addDetectedDot = (dot) => {
    if (!dot || drawState.detectedDots.has(dot)) return;
    dot.classList.add('detected');
    drawState.detectedDots.add(dot);
    drawState.currentStrokeDetected = true;
    const v = parseInt(dot.dataset.value, 10);
    if (!isNaN(v)) {
        drawState.totalValue += v;
        // console.log(`ドット検出: index=${dot.dataset.index}, value=${v}, total=${drawState.totalValue}`); // Log removed/commented
    }
    // Clear the multi-stroke timeout timer whenever a new dot is added to the current stroke
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
};

const detectDot = (x, y) => {
    if (!drawState.isActive || !elements.dotGrid) return;
    const now = Date.now();
    if (now - drawState.lastDetectionTime < CONFIG.sensitivity.debounceTime) return;
    drawState.lastDetectionTime = now;

    // gridRect seems unused
    // const gridRect = elements.dotGrid.getBoundingClientRect();

    const hitRadius = CONFIG.sensitivity.hitRadius;
    // Query all dots including special row (numeric 0)
    elements.d2dArea.querySelectorAll('.dot').forEach(dot => {
        if (drawState.detectedDots.has(dot)) return;
        const r = dot.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(x - cx, y - cy);

        if (dist <= hitRadius) {
            addDetectedDot(dot);
            // If a dot is detected, reset the endDrawing timer
            // to allow continuation of the stroke
            clearTimeout(drawState.strokeTimer);
            drawState.strokeTimer = null;
             // Update last stroke time to keep the stroke active
             drawState.lastStrokeTime = Date.now();
        }
    });
};

const startDrawing = (dotEl, x, y) => {
    // Check if the element is actually a grid dot or the special zero dot
    const isGridDot = dotEl.closest('#dot-grid');
    const isZeroDot = dotEl.closest('#special-row') && dotEl.dataset.digit === '0';
    if (!dotEl || !dotEl.classList.contains('dot') || (!isGridDot && !isZeroDot)) return;

    const now = Date.now();
    // Reset if starting a new stroke after timeout
    if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
        resetDrawState(true); // Keep active for the new stroke
    }
    drawState.isActive = true;
    drawState.isDrawingMode = true; // Enable drawing mode
    drawState.startX = x;
    drawState.startY = y;
    drawState.lastDetectionTime = now;
    drawState.lastStrokeTime = now; // Mark the start time of this stroke part

    addDetectedDot(dotEl); // Detect the starting dot

    // Clear any pending endDrawing timer from a previous quick stroke
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
    // console.log("なぞり書き開始"); // Log removed/commented
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
            const lastNewline = before.lastIndexOf('\n');
            const lastSpace = before.lastIndexOf(' ');
            let cutoff = Math.max(lastNewline, lastSpace);
            if (cutoff === -1) { // No space or newline found
                 cutoff = 0;
            } else if (lastNewline !== -1 && lastNewline === pos -1) {
                 // If cursor is right after a newline, delete the newline
                 cutoff = lastNewline;
            } else if (lastSpace !== -1 && lastSpace === pos - 1 && !/\s/.test(before.charAt(pos-2))) {
                 // If cursor is right after a space, delete up to before the space
                 cutoff = lastSpace;
            } else if (lastNewline > lastSpace) {
                 cutoff = lastNewline + 1; // Keep the newline char itself
            } else if (lastSpace > lastNewline) {
                 cutoff = lastSpace + 1; // Keep the space char itself
            } else {
                 cutoff = 0; // Delete everything if only spaces/newlines before
            }
            // Handle edge case: only spaces/newlines before cursor
            if (before.trim() === '') cutoff = 0;

            before = before.slice(0, cutoff);

        } else {
            before = before.slice(0, -1); // Simple backspace
        }
        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = before.length; // Set cursor position
    }
    if (isMobileDevice()) showTextSection();
    if (CONFIG.behavior.autoFocus) ta.focus();
};


const handleSpecialButtonClick = (e, type, actions) => {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    if (specialButtonState.clickTarget === type &&
        now - specialButtonState.lastClickTime < specialButtonState.doubleClickDelay) {
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickCount = 0;
        specialButtonState.clickTarget = null;
        specialButtonState.clickTimer = null;
        if (actions.double) actions.double();
    } else {
        specialButtonState.clickCount = 1;
        specialButtonState.lastClickTime = now;
        specialButtonState.clickTarget = type;
        // Clear previous timer if any
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickTimer = setTimeout(() => {
            if (specialButtonState.clickCount === 1 && specialButtonState.clickTarget === type) {
                if (actions.single) actions.single();
            }
            // Reset state after timeout regardless
            specialButtonState.clickCount = 0;
            specialButtonState.clickTarget = null;
            specialButtonState.clickTimer = null;
        }, specialButtonState.doubleClickDelay);
    }
};

const executeCode = () => {
    const code = elements.input ? elements.input.value : '';
    if (!code.trim()) return;
    try {
        const result = shikigamiInterpreter.execute(code);
        if (elements.output) {
            elements.output.value = result !== undefined ? String(result) : "実行完了";
            elements.output.classList.add('executed');
            setTimeout(() => elements.output.classList.remove('executed'), 300);
        }
        // ★★★ 実行後に output を表示 ★★★
        showOutputSection(); // 実行結果を表示する関数を呼ぶ
        if (!String(result).startsWith("エラー:") && elements.input) {
             // elements.input.value = ""; // Optionally clear input
        }
    } catch (err) {
        if (elements.output) {
            elements.output.value = `エラー: ${err.message}`;
        }
        // ★★★ エラー時も output を表示 ★★★
        showOutputSection(); // エラー表示のために output を表示
    }
};

const setupKeyboardHandlers = () => {
    document.addEventListener('keydown', (e) => {
        if (e.target === elements.input || e.target === elements.output) return; // Ignore if typing in text areas

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault(); // Prevent browser back navigation
            handleDeleteAction(e.ctrlKey || e.metaKey); // Ctrl/Cmd + Backspace for token delete
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            insertAtCursor(' ');
        }
         if (e.key === 'Enter') {
             e.preventDefault();
             if(e.shiftKey) { // Shift+Enter for execution? Or just newline?
                 executeCode();
             } else {
                 insertAtCursor('\n');
             }
         }
    });
    // keyup is not strictly needed anymore with this simplified logic
};

// handleDoubleTap function seems redundant with handlePointerDown logic, removing.

// Pointer Event Handlers (incorporating tap/swipe logic)
const handlePointerDown = (e, el) => {
    if (!e || !el) return;
    // Allow default behavior for text input elements if focus is needed
    if (e.target !== elements.input && e.target !== elements.output) {
        if (e.preventDefault) e.preventDefault();
    }


    drawState.currentTouchId = e.pointerId;
    drawState.pointerStartX = e.clientX;
    drawState.pointerStartY = e.clientY;
    drawState.hasMoved = false;
    // isDrawingMode will be set true only if movement occurs or on dot elements

    // Capture pointer on the element itself to track movement reliably
    try {
        if (el.setPointerCapture && !el.hasPointerCapture(e.pointerId)) {
            el.setPointerCapture(e.pointerId);
            // Store captured element reference if needed, or rely on event target?
            // For simplicity, we assume events bubble correctly or use document listeners.
        }
    } catch (err) {
        console.log("Pointer capture not supported or failed:", err);
    }

     if (isMobileDevice()) showTextSection(); // Show input area on interaction

    const isDot = el.classList.contains('dot'); // Includes grid dots and zero dot
    const isSpecialButton = el.classList.contains('special-button') && !isDot; // DELETE, SPACE

    // --- Tap vs. Swipe Logic ---
    // 1. Set a timer to detect a potential tap action.
    clearTimeout(drawState.tapCheckTimer); // Clear previous timer
    drawState.tapCheckTimer = setTimeout(() => {
        // If timer fires and pointer hasn't moved significantly
        if (!drawState.hasMoved) {
            const digit = el.dataset.digit; // Works for grid numbers and zero
            const word = el.dataset.word;

            if (digit || word) { // Is it a dot with direct input action?
                insertAtCursor(digit || word);
                el.classList.add('tapped-feedback'); // Use a generic tap class
                setTimeout(() => el.classList.remove('tapped-feedback'), 200);
                resetDrawState(); // Reset drawing state after tap input
                clearCanvas();
            } else if (isDot) {
                 // If it's a placeholder dot, maybe do nothing on tap?
                 // Or potentially start drawing if held? Current logic handles this via movement.
                 // For now, tap on placeholder does nothing unless drag starts.
                 resetDrawState(); // Ensure tap doesn't leave lingering state
                 clearCanvas();
            }
             // Special buttons (DELETE/SPACE) handled by pointerup/click logic, not tap timer.
        }
        drawState.tapCheckTimer = null; // Timer finished
    }, 200); // Tap timeout duration

    // 2. If it's a dot (grid or zero), potentially start drawing state immediately
    //    but only activate drawing mode (`isDrawingMode`) on actual movement.
    if (isDot) {
         const now = Date.now();
         // Reset if starting a new stroke after timeout
         if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
             resetDrawState(true); // Keep active for the new stroke
         }
         drawState.isActive = true;
         // drawState.isDrawingMode = false; // Set to true only on move
         drawState.startX = e.clientX;
         drawState.startY = e.clientY;
         drawState.lastDetectionTime = now;
         drawState.lastStrokeTime = now;

         // Add starting dot immediately ONLY if we decide tap doesn't cancel it
         // Let's add it, but movement check will determine if it becomes a stroke
         addDetectedDot(el);

         // Clear any pending endDrawing timer from a previous quick stroke
         clearTimeout(drawState.strokeTimer);
         drawState.strokeTimer = null;
    } else {
        // If not a dot, ensure drawing state is not active
        resetDrawState();
        clearCanvas();
    }
};


const handlePointerMove = (e) => {
    // Only process if a pointer is down and it's the primary one we track
    if (!drawState.isActive || e.pointerId !== drawState.currentTouchId) return;

    const dx = e.clientX - drawState.pointerStartX;
    const dy = e.clientY - drawState.pointerStartY;
    const distance = Math.hypot(dx, dy);

    if (distance >= CONFIG.sensitivity.minSwipeDistance) {
        // First significant move detected
        if (!drawState.hasMoved) {
            drawState.hasMoved = true;
            clearTimeout(drawState.tapCheckTimer); // Cancel tap timer
            drawState.tapCheckTimer = null;
            // NOW set drawing mode true if pointer started on a dot
            const startElement = document.elementFromPoint(drawState.pointerStartX, drawState.pointerStartY);
             if (startElement && startElement.classList.contains('dot')) {
                 drawState.isDrawingMode = true;
            }
        }

        // If in drawing mode, detect dots
        if (drawState.isDrawingMode) {
            detectDot(e.clientX, e.clientY);
        }
    }
};

const handlePointerUp = (e) => {
    if (e.pointerId !== drawState.currentTouchId) return; // Only handle the tracked pointer

    // Release pointer capture if held
    try {
        const el = e.target; // Use event target for release
        if (el && el.releasePointerCapture && el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
    } catch (err) {
        console.log("Error releasing pointer capture:", err);
    }

    // If a tap timer was running, clear it (means pointer up happened before timeout)
    if (drawState.tapCheckTimer) {
        clearTimeout(drawState.tapCheckTimer);
        drawState.tapCheckTimer = null;
        // If it was a quick tap on a non-action dot, reset.
        // Action dots (numbers/words) handle reset in their tap logic.
         const el = e.target;
         if (el && el.classList.contains('dot') && !el.dataset.digit && !el.dataset.word) {
              resetDrawState();
              clearCanvas();
         }
    }

    // End drawing sequence if we were in drawing mode or stroke was detected
    if (drawState.isActive && (drawState.isDrawingMode || drawState.currentStrokeDetected)) {
        endDrawing(); // Let endDrawing handle timeout and recognition
    } else {
        // If pointer up occurs without significant movement or dot detection, ensure clean state
        resetDrawState();
        clearCanvas();
    }

    // Reset interaction state
    drawState.currentTouchId = null;
    // isActive, isDrawingMode, hasMoved are reset by resetDrawState or endDrawing timeout
};


// マルチタッチサポートのためのイベントリスナー
const setupMultiTouchSupport = () => {
    if (isMobileDevice() && elements.d2dArea) {
        // Prevent default touch actions like scrolling/zooming on the input area
        elements.d2dArea.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        elements.d2dArea.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
};

// --- Event Listener Setup ---
const setupDotEventListeners = () => {
    // Add listener to the container and delegate based on target
    if (!elements.d2dArea) return;
    elements.d2dArea.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('dot')) {
            handlePointerDown(e, e.target);
        }
    }, { passive: false }); // Use container to capture events for all dots
};


const setupSpecialButtonListeners = () => {
    const deleteBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="delete"]') : null;
    const spaceBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="space"]') : null;

    // Use pointerup for button-like actions to avoid conflict with potential drag
    if (deleteBtn) {
        deleteBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'delete', {
            single: () => handleDeleteAction(false),
            double: () => handleDeleteAction(true)
        }));
        // Prevent pointerdown from starting drag/selection on button
        deleteBtn.addEventListener('pointerdown', e => e.preventDefault());
    }

    if (spaceBtn) {
        spaceBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'space', {
            single: () => insertAtCursor(' '),
            double: () => insertAtCursor('\n')
        }));
        spaceBtn.addEventListener('pointerdown', e => e.preventDefault());
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
    const pr = parseFloat(style.paddingRight) || 0;
    const pt = parseFloat(style.paddingTop) || 0;
    const pb = parseFloat(style.paddingBottom) || 0;

    // Adjust canvas size to fit within padding
    canvas.width = d2dArea.clientWidth - pl - pr;
    canvas.height = d2dArea.clientHeight - pt - pb;
    // Position canvas relative to padding
    canvas.style.left = `${pl}px`;
    canvas.style.top = `${pt}px`;

    clearCanvas(); // Clear after resize
};

const setupGestureListeners = () => {
    // Listen on document for move/up/cancel/leave to handle cases where
    // the pointer leaves the original element or the d2dArea.
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { passive: false });
    document.addEventListener('pointercancel', handlePointerUp, { passive: false }); // Treat cancel like up
    // Optional: Add leave listener to d2dArea if needed
    // if(elements.d2dArea) {
    //     elements.d2dArea.addEventListener('pointerleave', handlePointerUp, { passive: false });
    // }
};

// --- Debug Helper ---
// debugLog function removed

const updateConfigStyles = () => {
    const existing = document.getElementById('dynamic-config-styles');
    if (existing) existing.remove();
    const s = document.createElement('style');
    s.id = 'dynamic-config-styles';
    s.textContent = `
        #dot-grid { /* Style the grid container */
             display: flex;
             flex-direction: column;
             gap: ${CONFIG.layout.dotGap}px;
             padding: 5px; /* Add some padding */
             touch-action: none; /* Disable browser default actions */
             user-select: none; /* Prevent text selection */
             -webkit-user-select: none;
             -ms-user-select: none;
        }
        .dot-row { /* Style each row */
            display: flex;
            justify-content: center; /* Center dots in row */
            gap: ${CONFIG.layout.dotGap}px;
        }
        .dot {
            width: ${CONFIG.layout.dotSize}px;
            height: ${CONFIG.layout.dotSize}px;
            border-radius: 50%; /* Make dots round */
            background-color: #e5e7eb; /* Default light gray */
            color: #374151; /* Darker text */
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: ${CONFIG.layout.dotSize * 0.4}px; /* Adjust font size based on dot size */
            cursor: pointer;
            transition: background-color 0.1s ease-in-out;
            touch-action: none; /* Ensure touch actions handled by JS */
            box-sizing: border-box; /* Include padding/border in size */
            border: 1px solid #d1d5db; /* Subtle border */
        }
        .dot.placeholder-dot {
            background-color: #f3f4f6; /* Lighter background for placeholders */
            color: #9ca3af;
            /* font-size: ${CONFIG.layout.dotSize * 0.6}px; */
             /* content: '·'; */
        }
        .dot.detected {
            background-color: ${CONFIG.visual.detectedColor}; /* Use config color */
             border-color: ${CONFIG.visual.detectedColor};
             transform: scale(0.95); /* Slight shrink effect */
        }
        .dot.tapped-feedback { /* Style for tap feedback */
            background-color: #fde68a; /* Example yellow */
            transform: scale(0.95);
            transition: background-color 0.1s, transform 0.1s;
        }
        .special-button { /* Styling for Delete/Space */
             padding: 0 ${CONFIG.layout.dotSize * 0.3}px; /* Horizontal padding */
             height: ${CONFIG.layout.dotSize}px; /* Match dot height */
             display: flex;
             align-items: center;
             justify-content: center;
             border-radius: 8px; /* Rounded rectangle */
             background-color: #d1d5db;
             color: #1f2937;
             font-size: ${CONFIG.layout.dotSize * 0.3}px;
             cursor: pointer;
             user-select: none;
             -webkit-user-select: none;
             -ms-user-select: none;
             touch-action: manipulation; /* Allow tap, disable zoom etc */
             flex-grow: 1; /* Allow buttons to grow */
             text-align: center;
             border: 1px solid #9ca3af;
        }
         .special-button:active {
             background-color: #9ca3af; /* Darken on press */
         }
        #special-row { /* Layout for special buttons */
            display: flex;
            justify-content: space-around; /* Space out buttons */
            gap: ${CONFIG.layout.dotGap}px;
             margin-top: ${CONFIG.layout.dotGap}px; /* Add space above */
        }
        #line-canvas {
             position: absolute;
             top: 0; left: 0; /* Position relative to d2dArea */
             pointer-events: none; /* Canvas doesn't block pointer events */
             z-index: 10; /* Draw above dots? Maybe below? */
         }
        .recognition-feedback {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) scale(0.5); /* Start small */
            width: ${CONFIG.visual.feedbackSize}px;
            height: ${CONFIG.visual.feedbackSize}px;
            font-size: ${CONFIG.visual.feedbackTextSize}px;
            color: #fff;
            background-color: rgba(0, 0, 0, 0.6);
            border-radius: 50%;
            display: flex;
            justify-content: center;
            align-items: center;
            pointer-events: none;
            z-index: 20;
            opacity: 0;
            transition: opacity 0.3s ease-out, transform 0.3s ease-out;
            animation: feedback-pulse 0.8s ease-out forwards;
        }
         @keyframes feedback-pulse {
             0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
             50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
             100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
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
const letterPatterns = { // Ensure keys are numbers
    17836036: 'A', 28611899: 'B', 32539711: 'C', 1224985: 'D',
    32567296: 'E', 1113151: 'F', 33092671: 'G', 18415153: 'H',
    32641183: 'I', 7475359: 'J', 17990833: 'K', 32539681: 'L',
    18405233: 'M', 18667121: 'N', 33080895: 'O', 1113663: 'P',
    33347135: 'Q', 18153023: 'R', 33061951: 'S', 4329631:  'T',
    33080881: 'U', 4204561: 'V', 18732593: 'W', 18157905: 'X',
    4329809:  'Y', 32575775: 'Z'
};
const numericPositions = { // Key: index, Value: Displayed Digit
    0: '1', 2: '2', 4: '3',
    10: '4', 12: '5', 14: '6',
    20: '7', 22: '8', 24: '9'
};
const dotWordMapping = { // ★★★ Key: value, Value: Displayed Word ★★★
    32: '(', 64: ')', 128: '+', 256: '{', 512: '}',
    2048: '*', 8192: '/',
    131072: '-',
    2097152: '>', 8388608: '='
    // Removed '未定' entries for clarity, add back if needed
};


// --- Keypad Initialization ---
function initKeypad() {
    if (!elements.dotGrid || !elements.specialRow) {
        console.error("Required grid elements not found!");
        return;
    }

    elements.dotGrid.innerHTML = ''; // Clear previous grid
    elements.specialRow.innerHTML = ''; // Clear previous special row

    // Grid Rows and Dots
    for (let r = 0; r < CONFIG.layout.gridRows; r++) {
        const row = document.createElement('div');
        row.className = 'dot-row';
        for (let c = 0; c < CONFIG.layout.gridCols; c++) {
            const idx = r * CONFIG.layout.gridCols + c;
            if (idx >= dotValues.length) continue;

            const value = dotValues[idx];
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.dataset.index = idx;
            dot.dataset.value = value;

            const digit = numericPositions[idx]; // Lookup by index
            const word = dotWordMapping[value]; // ★★★ Lookup by value ★★★

            if (digit) {
                dot.classList.add('numeric');
                dot.textContent = digit;
                dot.dataset.digit = digit;
            } else if (word) { // Check if word is defined in the mapping
                dot.classList.add('word-dot');
                dot.textContent = word;
                dot.dataset.word = word;
            } else {
                dot.classList.add('placeholder-dot');
                // dot.textContent = '·'; // Optional placeholder visual
            }
            row.appendChild(dot);
        }
        elements.dotGrid.appendChild(row);
    }

    // Special Row Buttons
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'special-button delete';
    deleteBtn.textContent = '削除'; // More user-friendly text
    deleteBtn.dataset.action = 'delete';
    deleteBtn.title = '削除 (ダブルタップで単語削除)';
    elements.specialRow.appendChild(deleteBtn);

    const zeroBtn = document.createElement('div');
    zeroBtn.className = 'dot numeric'; // Style as a dot
    zeroBtn.textContent = '0';
    zeroBtn.dataset.digit = '0';
    zeroBtn.dataset.index = 'special_0'; // Unique index
    zeroBtn.dataset.value = '0'; // Assign value 0 if needed for patterns
    elements.specialRow.appendChild(zeroBtn);

    const spaceBtn = document.createElement('div');
    spaceBtn.className = 'special-button space';
    spaceBtn.textContent = '空白';
    spaceBtn.dataset.action = 'space';
    spaceBtn.title = '空白 (ダブルタップで改行)';
    elements.specialRow.appendChild(spaceBtn);

    if (elements.d2dArea) elements.d2dArea.tabIndex = -1; // Prevent tabbing

    updateConfigStyles(); // Apply dynamic styles
    resizeCanvas(); // Initial canvas size

    // Setup listeners after elements are in DOM
    setupDotEventListeners();
    setupSpecialButtonListeners();
    setupGestureListeners();
    setupMultiTouchSupport();
}

const initResponsiveLayout = () => {
    const checkLayout = () => {
        resizeCanvas();
        if (isMobileDevice()) {
            // ★★★ モバイル時はデフォルトでText Sectionを表示 ★★★
            if (elements.textSection && elements.outputSection) {
                 // 原則としてText Sectionを表示状態にする
                 // Outputが明示的に表示されるのは executeCode が呼ばれた時のみ
                 showTextSection();
                 // ただし、Outputに実行結果が残っていてInputが空の場合のみOutputを優先する、という判断も可能
                 // if (elements.output && elements.output.value !== '' && elements.input && elements.input.value === '') {
                 //    showOutputSection();
                 // } else {
                 //    showTextSection();
                 // }
            }
        } else {
            // デスクトップでは両方表示
            if (elements.outputSection) elements.outputSection.classList.remove('hide');
            if (elements.textSection) elements.textSection.classList.remove('hide');
        }
    };
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', checkLayout);
    checkLayout(); // Initial check
};


// --- Initialization on load ---
window.addEventListener('DOMContentLoaded', () => {
    // Ensure all elements are available before initializing
    initKeypad();
    initResponsiveLayout();
    setupExecuteButtonListener();
    setupKeyboardHandlers();
});