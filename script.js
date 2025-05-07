// --- 分数計算をサポートするクラス ---
const Fraction = (() => {
  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    if (!Number.isInteger(a) || !Number.isInteger(b)) {
      const aDecimals = (a.toString().split('.')[1] || '').length;
      const bDecimals = (b.toString().split('.')[1] || '').length;
      const factor = Math.pow(10, Math.max(aDecimals, bDecimals));
      a = Math.round(a * factor);
      b = Math.round(b * factor);
    }
    while (b !== 0) {
      const temp = b;
      b = a % b;
      a = temp;
    }
    return a;
  };

  const constructor = (numerator, denominator = 1, isFractionOperation = false) => {
    if (denominator === 0) throw new Error("Division by zero");
    const fraction = {};
    fraction.numerator = Number(numerator);
    fraction.denominator = Number(denominator);
    if (fraction.denominator < 0) {
      fraction.numerator *= -1;
      fraction.denominator *= -1;
    }
    if (!isFractionOperation) {
      const divisor = gcd(fraction.numerator, fraction.denominator);
      fraction.numerator /= divisor;
      fraction.denominator /= divisor;
    }
    fraction.add = (other, isFractionOp = true) => {
      const a = fraction;
      const b = other;
      const numerator = a.numerator * b.denominator + b.numerator * a.denominator;
      const denominator = a.denominator * b.denominator;
      return Fraction(numerator, denominator, isFractionOp);
    };
    fraction.subtract = (other, isFractionOp = true) => {
      const a = fraction;
      const b = other;
      const numerator = a.numerator * b.denominator - b.numerator * a.denominator;
      const denominator = a.denominator * b.denominator;
      return Fraction(numerator, denominator, isFractionOp);
    };
    fraction.multiply = (other, isFractionOp = true) => {
      const numerator = fraction.numerator * other.numerator;
      const denominator = fraction.denominator * other.denominator;
      return Fraction(numerator, denominator, isFractionOp);
    };
    fraction.divide = (other, isFractionOp = true) => {
      if (other.numerator === 0) throw new Error("Division by zero");
      const numerator = fraction.numerator * other.denominator;
      const denominator = fraction.denominator * other.numerator;
      return Fraction(numerator, denominator, isFractionOp);
    };
    fraction.equals = (other) => fraction.numerator * other.denominator === other.numerator * fraction.denominator;
    fraction.greaterThan = (other) => fraction.numerator * other.denominator > other.numerator * fraction.denominator;
    fraction.greaterThanOrEqual = (other) => fraction.numerator * other.denominator >= other.numerator * fraction.denominator;
    fraction.toString = () => (fraction.denominator === 1 ? String(fraction.numerator) : `${fraction.numerator}/${fraction.denominator}`);
    fraction.valueOf = () => fraction.numerator / fraction.denominator;
    return fraction;
  };

  constructor.fromString = (str, isFractionOp = false) => {
    if (str.includes('/')) {
      const [numerator, denominator] = str.split('/').map((s) => parseFloat(s.trim()));
      return constructor(numerator, denominator, true);
    }
    return constructor(parseFloat(str), 1, isFractionOp);
  };
  return constructor;
})();

// Interpreter - 名前変更
const interpreter = (() => {
  const state = {
    variables: {},
    functions: {},
  };

  // Tokenizer: now strips any `: type` segments so existing code with type annotations still runs
  const tokenize = (code) => {
    // Remove in‑line comments
    code = code.replace(/#.*$/gm, '');
    // *** NEW *** Strip type annotations like ": number", ": string", etc.
    code = code.replace(/\s*:\s*[a-zA-Z_]+\b/g, '');
    // Temporarily encode fractional literals (e.g. 3/4 → 3_FRAC_4)
    code = code.replace(/(\d+)\/(\d+)/g, '$1_FRAC_$2');

    const tokens = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      if (inString) {
        if (char === stringChar && code[i - 1] !== '\\') {
          inString = false;
          current += char;
          tokens.push(current);
          current = '';
        } else {
          current += char;
        }
      } else if (char === '"' || char === "'") {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        inString = true;
        stringChar = char;
        current = char;
      } else if (/\s/.test(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else if (['(', ')', ',', ';', ':'].includes(char)) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
        if (char !== ':') tokens.push(char); // skip ':' entirely
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    // Decode fractional placeholders back to normal form
    return tokens.map((t) => (t.includes('_FRAC_') ? t.replace('_FRAC_', '/') : t)).filter((t) => t.trim() !== '');
  };

  // --- Parser & Evaluator (unchanged – relies on tokens already cleansed of types) ---
  const parse = (tokens) => {
    const parseExpression = (index) => {
      if (index >= tokens.length) throw new Error('Unexpected end of input');
      const token = tokens[index];
      if (/^-?\d+(\.\d+)?$/.test(token) || /^-?\d+\/\d+$/.test(token)) {
        let value;
        const isFraction = token.includes('/');
        if (isFraction) {
          const [n, d] = token.split('/').map(Number);
          value = Fraction(n, d, true);
        } else {
          value = Fraction(parseFloat(token), 1, false);
        }
        return { type: 'number', value, isFraction, nextIndex: index + 1 };
      }
      if (/^["'].*["']$/.test(token)) {
        return { type: 'string', value: token.slice(1, -1), nextIndex: index + 1 };
      }
      if (/^[A-Z][A-Z0-9_]*$/.test(token)) {
        // Function call with parentheses
        if (tokens[index + 1] === '(') {
          let paramIndex = index + 2;
          const args = [];
          while (paramIndex < tokens.length && tokens[paramIndex] !== ')') {
            const arg = parseExpression(paramIndex);
            args.push(arg);
            paramIndex = arg.nextIndex;
            if (tokens[paramIndex] === ',') paramIndex++;
          }
          if (tokens[paramIndex] !== ')') throw new Error('Expected ) after function arguments');
          return { type: 'function_call', name: token, arguments: args, nextIndex: paramIndex + 1 };
        }
        // Function call without parentheses (Polish notation)
        if (state.functions[token] && index + 1 < tokens.length) {
          const { params } = state.functions[token];
          if (params.length) {
            const args = [];
            let argIndex = index + 1;
            for (let i = 0; i < params.length; i++) {
              const argExpr = parseExpression(argIndex);
              args.push(argExpr);
              argIndex = argExpr.nextIndex;
            }
            return { type: 'function_call', name: token, arguments: args, nextIndex: argIndex };
          }
        }
        return { type: 'variable', name: token, nextIndex: index + 1 };
      }
      // Operators (prefix notation)
      if (['+', '-', '*', '/', '>', '>=', '==', '='].includes(token)) {
        if (token === '=') {
          if (index + 2 >= tokens.length) throw new Error('Invalid assignment expression');
          const varName = tokens[index + 1];

          // Function definition
          if (tokens[index + 2] === '(' && /^[A-Z][A-Z0-9_]*$/.test(varName)) {
            let paramIndex = index + 3;
            const params = [];
            while (paramIndex < tokens.length && tokens[paramIndex] !== ')') {
              if (!/^[A-Z][A-Z0-9_]*$/.test(tokens[paramIndex])) throw new Error(`Invalid parameter name: ${tokens[paramIndex]}`);
              params.push(tokens[paramIndex]);
              paramIndex++;
              if (tokens[paramIndex] === ',') paramIndex++;
            }
            if (tokens[paramIndex] !== ')') throw new Error('Expected ) after function parameters');
            const bodyExpr = parseExpression(paramIndex + 1);
            state.functions[varName] = { params, body: bodyExpr };
            return { type: 'function_definition', name: varName, params, body: bodyExpr, nextIndex: bodyExpr.nextIndex };
          }
          // Simple variable assignment
          const valueExpr = parseExpression(index + 2);
          return { type: 'assignment', variable: varName, value: valueExpr, nextIndex: valueExpr.nextIndex };
        }
        // Binary operation
        const left = parseExpression(index + 1);
        const right = parseExpression(left.nextIndex);
        return { type: 'operation', operator: token, left, right, nextIndex: right.nextIndex };
      }
      throw new Error(`Unexpected token: ${token}`);
    };

    const expressions = [];
    let i = 0;
    while (i < tokens.length) {
      const expr = parseExpression(i);
      expressions.push(expr);
      i = expr.nextIndex;
      if (tokens[i] === ';') i++;
    }
    return expressions;
  };

  const evaluate = (ast, env = { variables: state.variables, functions: state.functions }) => {
    const evaluateNode = (node, scope = env) => {
      const evalNumber = () => node.value;
      const evalVariable = () => {
        if (scope.variables.hasOwnProperty(node.name)) return scope.variables[node.name];
        throw new Error(`Undefined variable: ${node.name}`);
      };
      const evalOperation = () => {
        const left = evaluateNode(node.left, scope);
        const right = evaluateNode(node.right, scope);
        if (typeof left === 'string' || typeof right === 'string') {
          if (node.operator === '+') return String(left) + String(right);
          throw new Error(`Cannot apply operator ${node.operator} to strings`);
        }
        const ops = {
          '+': (a, b) => a.add(b, false),
          '-': (a, b) => a.subtract(b, false),
          '*': (a, b) => a.multiply(b, false),
          '/': (a, b) => a.divide(b, true),
          '>': (a, b) => a.greaterThan(b),
          '>=': (a, b) => a.greaterThanOrEqual(b),
          '==': (a, b) => a.equals(b),
        };
        if (ops[node.operator]) return ops[node.operator](left, right);
        throw new Error(`Unknown operator: ${node.operator}`);
      };
      const evalAssignment = () => {
        const val = evaluateNode(node.value, scope);
        scope.variables[node.variable] = val;
        return val;
      };
      const evalFunctionDefinition = () => {
        scope.functions[node.name] = { params: node.params, body: node.body };
        return `Function ${node.name} defined`;
      };
      const evalFunctionCall = () => {
        if (!scope.functions.hasOwnProperty(node.name)) throw new Error(`Undefined function: ${node.name}`);
        const func = scope.functions[node.name];
        if (func.params.length !== node.arguments.length) throw new Error(`Expected ${func.params.length} arguments, got ${node.arguments.length}`);
        const fnScope = { variables: { ...scope.variables }, functions: scope.functions };
        node.arguments.forEach((arg, idx) => {
          fnScope.variables[func.params[idx]] = evaluateNode(arg, scope);
        });
        return evaluateNode(func.body, fnScope);
      };
      const table = {
        number: evalNumber,
        string: () => node.value,
        variable: evalVariable,
        operation: evalOperation,
        assignment: evalAssignment,
        function_definition: evalFunctionDefinition,
        function_call: evalFunctionCall,
      };
      if (table[node.type]) return table[node.type]();
      throw new Error(`Unknown node type: ${node.type}`);
    };
    let result;
    ast.forEach((ex) => {
      result = evaluateNode(ex, env);
    });
    return result;
  };

  // Public execute API
  const execute = (code) => {
    try {
      // クリーンアップ - 色指定の非表示空白コマンドを削除
      // ここで不可視の色付け命令を取り除きます
      code = code.replace(/\u200B\[(black|red|green|blue)\]/g, '');
      
      const tokens = tokenize(code);
      const ast = parse(tokens);
      const result = evaluate(ast);
      return result.toString ? result.toString() : result;
    } catch (err) {
      return `Error: ${err.message}`;
    }
  };

  return { ...state, tokenize, parse, evaluate, execute };
})();

// --- Configuration Parameters ---
const CONFIG = {
    sensitivity: {
        hitRadius: 15,
        minSwipeDistance: 5,
        debounceTime: 50
    },
    timing: {
        multiStrokeTimeout: 500,
        doubleTapDelay: 300
    },
    layout: {
        dotSize: 40,
        dotGap: 20,
        gridRows: 5,
        gridCols: 5
    },
    visual: {
        detectedColor: '#fca5a5',
        feedbackSize: 120,
        feedbackTextSize: 60
    },
    behavior: {
        autoFocus: true,
    },
    recognition: {
        tolerance: 1
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
    clearButton: document.getElementById('clear-button'),
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
    hasMoved: false,
    isDrawingMode: false,
    tapCheckTimer: null
};

const specialButtonState = {
    lastClickTime: 0,
    clickCount: 0,
    clickTarget: null,
    clickTimer: null,
    doubleClickDelay: CONFIG.timing.doubleTapDelay
};

const keyState = {
    deletePressed: false,
    spacePressed: false,
    lastPressTime: 0,
    maxTimeDiff: 300
};

// --- Utility Functions ---
const isMobileDevice = () => {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);
};

const focusOnInput = () => {
    if (elements.input) {
        elements.input.focus();
    }
};

// 色指定コマンドの生成 - ColorForth風
const getColorCommand = (color) => {
    // 不可視のゼロ幅スペース文字 + 色指定タグ
    return `\u200B[${color}]`;
};

// 共通のカラーテキスト挿入関数
const insertColoredText = (text, color) => {
    const editor = elements.input;
    if (!editor) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // ColorForth風の色指定 + 空白スペース
    if (text === ' ') {
        // スペース要求の場合は色変更なし、通常の空白を挿入
        const span = document.createElement('span');
        span.textContent = ' ';
        range.deleteContents();
        range.insertNode(span);
    } else if (text === '\n') {
        // 改行要求の場合も色変更なし
        const span = document.createElement('span');
        span.textContent = '\n';
        range.deleteContents();
        range.insertNode(span);
    } else {
        // Create a colored span
        const span = document.createElement('span');
        span.style.color = color;
        span.textContent = text;
        
        // Insert the span
        range.deleteContents();
        range.insertNode(span);
    }
    
    // Move caret after the inserted span
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
};

// 色変更コマンドの挿入（ColorForth風）
const insertColorChange = (color) => {
    const editor = elements.input;
    if (!editor) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    // 不可視の色指定コマンド + 空白
    const colorCommand = getColorCommand(color);
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = ' '; // 空白で表示
    span.dataset.colorCommand = colorCommand; // データ属性に保存
    
    // Insert the span
    range.deleteContents();
    range.insertNode(span);
    
    // Move caret after the inserted span
    range.setStartAfter(span);
    range.setEndAfter(span);
    selection.removeAllRanges();
    selection.addRange(range);
};

// Modified to work with contenteditable div instead of textarea
const insertAtCursor = (text) => {
    const editor = elements.input;
    if (!editor) return;
    
    // Get the current active color
    const currentActiveColor = document.querySelector('.color-btn.active')?.dataset.color || 'black';
    
    insertColoredText(text, currentActiveColor);
    
    if (isMobileDevice()) showTextSection();
    focusOnInput();
};

// Updated for contenteditable div
const clearInput = () => {
    if (elements.input) {
        elements.input.innerHTML = '';
        focusOnInput();
    }
};

const showTextSection = () => {
    if (isMobileDevice() && elements.textSection && elements.outputSection) {
        elements.outputSection.classList.add('hide');
        elements.textSection.classList.remove('hide');
        focusOnInput();
    }
};

const showOutputSection = () => {
    if (isMobileDevice() && elements.textSection && elements.outputSection) {
        elements.textSection.classList.add('hide');
        elements.outputSection.classList.remove('hide');
    }
};

// --- Canvas Drawing Functions ---
const clearCanvas = () => {
    const lineCtx = elements.lineCanvas ? elements.lineCanvas.getContext('2d') : null;
    if (lineCtx && elements.lineCanvas) {
        lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
    }
};

// --- Gesture Logic Functions ---
const resetDrawState = (keepActive = false) => {
    drawState.isActive = keepActive;
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

const recognizeLetter = (totalValue) => {
    // 1. 完全一致チェック
    if (letterPatterns.hasOwnProperty(totalValue)) {
        console.log(`認識成功 (完全一致): 値=${totalValue}, 文字=${letterPatterns[totalValue]}`);
        return letterPatterns[totalValue];
    }

    // 2. 寛容性チェック (tolerance > 0 の場合)
    if (CONFIG.recognition.tolerance > 0 && totalValue > 0) {
        let bestMatch = null;

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
                    break;
                }
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

    if (drawState.currentStrokeDetected) {
        clearTimeout(drawState.strokeTimer);

        drawState.strokeTimer = setTimeout(() => {
            if (drawState.detectedDots.size > 0 && drawState.totalValue > 0) {
                const rec = recognizeLetter(drawState.totalValue);
                if (rec) {
                    insertAtCursor(rec);
                    showRecognitionFeedback(rec);
                }
                resetDrawState();
                clearCanvas();
                drawState.lastStrokeTime = 0;
            } else {
                 resetDrawState();
                 clearCanvas();
                 drawState.lastStrokeTime = 0;
            }
            drawState.strokeTimer = null;
        }, CONFIG.timing.multiStrokeTimeout);
    } else if (!drawState.strokeTimer) {
         resetDrawState();
         clearCanvas();
         drawState.lastStrokeTime = 0;
    }
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
    }
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
};

const detectDot = (x, y) => {
    if (!drawState.isActive || !elements.dotGrid) return;
    const now = Date.now();
    if (now - drawState.lastDetectionTime < CONFIG.sensitivity.debounceTime) return;
    drawState.lastDetectionTime = now;

    const hitRadius = CONFIG.sensitivity.hitRadius;
    elements.d2dArea.querySelectorAll('.dot').forEach(dot => {
        if (drawState.detectedDots.has(dot)) return;
        const r = dot.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dist = Math.hypot(x - cx, y - cy);

        if (dist <= hitRadius) {
            addDetectedDot(dot);
            clearTimeout(drawState.strokeTimer);
            drawState.strokeTimer = null;
            drawState.lastStrokeTime = Date.now();
        }
    });
};

const startDrawing = (dotEl, x, y) => {
    const isGridDot = dotEl.closest('#dot-grid');
    const isZeroDot = dotEl.closest('#special-row') && dotEl.dataset.digit === '0';
    if (!dotEl || !dotEl.classList.contains('dot') || (!isGridDot && !isZeroDot)) return;

    const now = Date.now();
    if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
        resetDrawState(true);
    }
    drawState.isActive = true;
    drawState.isDrawingMode = true;
    drawState.startX = x;
    drawState.startY = y;
    drawState.lastDetectionTime = now;
    drawState.lastStrokeTime = now;

    addDetectedDot(dotEl);
    
    clearTimeout(drawState.strokeTimer);
    drawState.strokeTimer = null;
};

// --- Event Handlers ---
// 削除処理の修正 - トークンと空白の削除を適切に行う
// 削除処理の修正 - トークンと空白の削除を適切に行う
// 削除処理の修正 - 単一文字削除とトークン削除を両立させる
const handleDeleteAction = (deleteToken = false) => {
    const editor = elements.input;
    if (!editor) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    
    if (range.collapsed) {
        // Cursor is collapsed (no selection)
        if (deleteToken) {
            // トークン削除モード
            const tempRange = document.createRange();
            tempRange.selectNodeContents(editor);
            
            // カーソル位置までのテキストを取得
            tempRange.setEnd(range.startContainer, range.startOffset);
            const contentBefore = tempRange.toString();
            
            if (!contentBefore.length) return;
            
            // 現在のカーソル位置
            let endPos = contentBefore.length;
            // トークンの開始位置
            let startPos = endPos;
            let foundWord = false;
            
            // トークンを見つける（空白文字が出るまで後ろから検索）
            while (startPos > 0) {
                const char = contentBefore.charAt(startPos - 1);
                if (char === ' ' || char === '\n') {
                    // 空白を見つけた
                    if (foundWord) {
                        // すでに単語を見つけていれば、これが単語の先頭
                        break;
                    }
                } else {
                    // 文字を見つけた
                    foundWord = true;
                }
                startPos--;
            }
            
            // 前の空白も削除するため、さらに前を検索
            let spaceStart = startPos;
            while (spaceStart > 0) {
                const char = contentBefore.charAt(spaceStart - 1);
                if (char === ' ' || char === '\n') {
                    // 空白文字なので削除範囲に含める
                    spaceStart--;
                } else {
                    // 空白以外なので終了
                    break;
                }
            }
            
            // 削除範囲を設定して実行
            try {
                const deleteRange = range.cloneRange();
                
                // カーソル位置を削除範囲の先頭に移動
                deleteRange.setStart(range.startContainer, range.startOffset - (endPos - spaceStart));
                
                // 範囲を削除
                deleteRange.deleteContents();
                
                // 選択範囲を更新
                selection.removeAllRanges();
                selection.addRange(deleteRange);
            } catch (e) {
                // DOMの範囲外などのエラーが発生した場合に、より正確な方法を試みる
                // 単純に内容を書き換える
                let newText = contentBefore.substring(0, spaceStart) + contentBefore.substring(endPos);
                editor.textContent = newText + (editor.textContent.substring(contentBefore.length) || '');
                
                // カーソル位置を削除した位置に設定
                const newRange = document.createRange();
                const textNode = editor.firstChild || editor;
                newRange.setStart(textNode, spaceStart);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } else {
            // 一文字だけ削除
            if (range.startOffset > 0) {
                // テキストノード内にいる場合は単純に前に移動
                if (range.startContainer.nodeType === Node.TEXT_NODE) {
                    const deleteRange = range.cloneRange();
                    deleteRange.setStart(range.startContainer, range.startOffset - 1);
                    deleteRange.deleteContents();
                    
                    // カーソル位置を更新
                    selection.removeAllRanges();
                    selection.addRange(deleteRange);
                } else {
                    // 他の要素間の場合は前の要素を探す
                    const prevNode = range.startContainer.childNodes[range.startOffset - 1];
                    if (prevNode) {
                        if (prevNode.nodeType === Node.TEXT_NODE) {
                            const deleteRange = range.cloneRange();
                            deleteRange.setStart(prevNode, prevNode.length - 1);
                            deleteRange.setEnd(prevNode, prevNode.length);
                            deleteRange.deleteContents();
                            
                            // カーソル位置を更新
                            selection.removeAllRanges();
                            selection.addRange(deleteRange);
                        } else {
                            // 複雑なケース、最後のテキストノードを探す
                            const lastTextNode = findLastTextNode(prevNode);
                            if (lastTextNode) {
                                const deleteRange = range.cloneRange();
                                deleteRange.setStart(lastTextNode, lastTextNode.length - 1);
                                deleteRange.setEnd(lastTextNode, lastTextNode.length);
                                deleteRange.deleteContents();
                                
                                // カーソル位置を更新
                                selection.removeAllRanges();
                                selection.addRange(deleteRange);
                            }
                        }
                    }
                }
            }
        }
    } else {
        // 選択範囲がある場合はそのまま削除
        range.deleteContents();
    }
    
    if (isMobileDevice()) showTextSection();
    focusOnInput();
};

// Helper function to find the last text node in an element
const findLastTextNode = (element) => {
    if (element.nodeType === Node.TEXT_NODE) return element;
    
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
        const lastNode = findLastTextNode(element.childNodes[i]);
        if (lastNode) return lastNode;
    }
    
    return null;
};

const executeCode = () => {
    // Get plain text from the rich text editor
    const editor = elements.input;
    const code = editor ? editor.textContent || editor.innerText : '';
    
    if (!code.trim()) return;
    let isSuccess = false;
    try {
        // コードを実行
        const result = interpreter.execute(code);
        const resultString = result !== undefined ? String(result) : "実行完了";
        
        if (typeof resultString === 'string' && resultString.startsWith("エラー:")) {
            // 言語レベルのエラーが返ってきた場合
            isSuccess = false;
            if (elements.output) {
                elements.output.value = resultString;
            }
        } else {
            // 言語レベルで成功した場合
            isSuccess = true;
            if (elements.output) {
                elements.output.value = resultString;
                elements.output.classList.add('executed');
                setTimeout(() => elements.output.classList.remove('executed'), 300);
            }
        }
        // outputセクションを表示 (エラーでも成功でも表示)
        showOutputSection();
        // 成功した場合のみ、入力エリアをクリア
        if (isSuccess && editor) {
            editor.innerHTML = '';
        }
        focusOnInput();
    } catch (err) {
        // JavaScriptレベルのエラー
        isSuccess = false;
        if (elements.output) {
            elements.output.value = `致命的なエラー: ${err.message}`;
        }
        showOutputSection();
        focusOnInput();
    }
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
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickTimer = setTimeout(() => {
            if (specialButtonState.clickCount === 1 && specialButtonState.clickTarget === type) {
                if (actions.single) actions.single();
            }
            specialButtonState.clickCount = 0;
            specialButtonState.clickTarget = null;
            specialButtonState.clickTimer = null;
        }, specialButtonState.doubleClickDelay);
    }
};

const setupKeyboardHandlers = () => {
    document.addEventListener('keydown', (e) => {
        if (e.target === elements.input || e.target === elements.output) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            handleDeleteAction(e.ctrlKey || e.metaKey);
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            insertAtCursor(' ');
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if(e.shiftKey) {
                executeCode();
            } else {
                insertAtCursor('\n');
            }
        }
    });
};

const handlePointerDown = (e, el) => {
    if (!e || !el) return;
    if (e.target !== elements.input && e.target !== elements.output) {
        if (e.preventDefault) e.preventDefault();
    }

    drawState.currentTouchId = e.pointerId;
    drawState.pointerStartX = e.clientX;
    drawState.pointerStartY = e.clientY;
    drawState.hasMoved = false;

    try {
        if (el.setPointerCapture && !el.hasPointerCapture(e.pointerId)) {
            el.setPointerCapture(e.pointerId);
        }
    } catch (err) {
        console.log("Pointer capture not supported or failed:", err);
    }

    if (isMobileDevice()) showTextSection();

    const isDot = el.classList.contains('dot');
    const isSpecialButton = el.classList.contains('special-button') && !isDot;
   
    clearTimeout(drawState.tapCheckTimer);
    drawState.tapCheckTimer = setTimeout(() => {
        if (!drawState.hasMoved) {
            const digit = el.dataset.digit;
            const word = el.dataset.word;

            if (digit || word) {
                insertAtCursor(digit || word);
                el.classList.add('tapped-feedback');
                setTimeout(() => el.classList.remove('tapped-feedback'), 200);
                resetDrawState();
                clearCanvas();
            } else if (isDot) {
                resetDrawState();
                clearCanvas();
            }
        }
        drawState.tapCheckTimer = null;
    }, 200);

    if (isDot) {
        const now = Date.now();
        if (!drawState.isActive || now - drawState.lastStrokeTime > CONFIG.timing.multiStrokeTimeout) {
            resetDrawState(true);
        }
        drawState.isActive = true;
        drawState.startX = e.clientX;
        drawState.startY = e.clientY;
        drawState.lastDetectionTime = now;
        drawState.lastStrokeTime = now;
         
        addDetectedDot(el);
         
        clearTimeout(drawState.strokeTimer);
        drawState.strokeTimer = null;
    } else {
        resetDrawState();
        clearCanvas();
    }
};

const handlePointerMove = (e) => {
    if (!drawState.isActive || e.pointerId !== drawState.currentTouchId) return;

    const dx = e.clientX - drawState.pointerStartX;
    const dy = e.clientY - drawState.pointerStartY;
    const distance = Math.hypot(dx, dy);

    if (distance >= CONFIG.sensitivity.minSwipeDistance) {
        if (!drawState.hasMoved) {
            drawState.hasMoved = true;
            clearTimeout(drawState.tapCheckTimer);
            drawState.tapCheckTimer = null;
            const startElement = document.elementFromPoint(drawState.pointerStartX, drawState.pointerStartY);
            if (startElement && startElement.classList.contains('dot')) {
                drawState.isDrawingMode = true;
            }
        }
        
        if (drawState.isDrawingMode) {
            detectDot(e.clientX, e.clientY);
        }
    }
};

const handlePointerUp = (e) => {
    if (e.pointerId !== drawState.currentTouchId) return;
    
    try {
        const el = e.target;
        if (el && el.releasePointerCapture && el.hasPointerCapture(e.pointerId)) {
            el.releasePointerCapture(e.pointerId);
        }
    } catch (err) {
        console.log("Error releasing pointer capture:", err);
    }
    
    if (drawState.tapCheckTimer) {
        clearTimeout(drawState.tapCheckTimer);
        drawState.tapCheckTimer = null;
        
        const el = e.target;
        if (el && el.classList.contains('dot') && !el.dataset.digit && !el.dataset.word) {
            resetDrawState();
            clearCanvas();
        }
    }
   
    if (drawState.isActive && (drawState.isDrawingMode || drawState.currentStrokeDetected)) {
        endDrawing();
    } else {
        resetDrawState();
        clearCanvas();
    }
    
    drawState.currentTouchId = null;
    focusOnInput();
};

// マルチタッチサポートのためのイベントリスナー
const setupMultiTouchSupport = () => {
    if (isMobileDevice() && elements.d2dArea) {
        elements.d2dArea.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        elements.d2dArea.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
};

// --- Event Listener Setup ---
const setupDotEventListeners = () => {
    if (!elements.d2dArea) return;
    elements.d2dArea.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('dot')) {
            handlePointerDown(e, e.target);
        }
    }, { passive: false });
};

const setupSpecialButtonListeners = () => {
    const deleteBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="delete"]') : null;
    const spaceBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="space"]') : null;

    if (deleteBtn) {
        deleteBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'delete', {
            single: () => handleDeleteAction(false),
            double: () => handleDeleteAction(true)
        }));
        deleteBtn.addEventListener('pointerdown', e => e.preventDefault());
    }

    if (spaceBtn) {
        // ColorForth風の仕様に変更：単一クリックで改行、ダブルクリックは使わない
        spaceBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'space', {
            single: () => insertAtCursor('\n'),
            double: () => insertAtCursor('\n')  // ダブルクリックも同じ動作
        }));
        spaceBtn.addEventListener('pointerdown', e => e.preventDefault());
    }
};

const setupExecuteButtonListener = () => {
    if (elements.executeButton) {
        elements.executeButton.addEventListener('click', executeCode);
    }
};

const setupClearButtonListener = () => {
    if (elements.clearButton) {
        elements.clearButton.addEventListener('click', clearInput);
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
    
    canvas.width = d2dArea.clientWidth - pl - pr;
    canvas.height = d2dArea.clientHeight - pt - pb;
    canvas.style.left = `${pl}px`;
    canvas.style.top = `${pt}px`;

    clearCanvas();
};

const setupGestureListeners = () => {
    document.addEventListener('pointermove', handlePointerMove, { passive: false });
    document.addEventListener('pointerup', handlePointerUp, { passive: false });
    document.addEventListener('pointercancel', handlePointerUp, { passive: false });
};

// 動的なスタイル設定（CONFIGに依存する部分のみ）
const updateConfigStyles = () => {
    const existing = document.getElementById('dynamic-config-styles');
    if (existing) existing.remove();
    const s = document.createElement('style');
    s.id = 'dynamic-config-styles';
    s.textContent = `
        #dot-grid {
             gap: ${CONFIG.layout.dotGap}px;
        }
        .dot-row {
            gap: ${CONFIG.layout.dotGap}px;
        }
        .dot {
            width: ${CONFIG.layout.dotSize}px;
            height: ${CONFIG.layout.dotSize}px;
            font-size: ${CONFIG.layout.dotSize * 0.4}px;
        }
        .dot.detected {
            background-color: ${CONFIG.visual.detectedColor};
            border-color: ${CONFIG.visual.detectedColor};
        }
        .special-button {
             padding: 0 ${CONFIG.layout.dotSize * 0.3}px;
             height: ${CONFIG.layout.dotSize}px;
             font-size: ${CONFIG.layout.dotSize * 0.3}px;
        }
        #special-row {
            gap: ${CONFIG.layout.dotGap}px;
            margin-top: ${CONFIG.layout.dotGap}px;
        }
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
    32: '(', 64: ')', 128: '+', 256: '{', 512: '}',
    2048: '*', 8192: '/',
    131072: '-',
    2097152: '>', 8388608: '='
};

// --- Keypad Initialization ---
function initKeypad() {
    if (!elements.dotGrid || !elements.specialRow) {
        console.error("Required grid elements not found!");
        return;
    }

    elements.dotGrid.innerHTML = '';
    elements.specialRow.innerHTML = '';

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

            const digit = numericPositions[idx];
            const word = dotWordMapping[value];

            if (digit) {
                dot.classList.add('numeric');
                dot.textContent = digit;
                dot.dataset.digit = digit;
            } else if (word) {
                dot.classList.add('word-dot');
                dot.textContent = word;
                dot.dataset.word = word;
            } else {
                dot.classList.add('placeholder-dot');
            }
            row.appendChild(dot);
        }
        elements.dotGrid.appendChild(row);
    }

    // Special Row Buttons
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'special-button delete';
    deleteBtn.textContent = '削除';
    deleteBtn.dataset.action = 'delete';
    deleteBtn.title = '削除 (ダブルタップで単語削除)';
    elements.specialRow.appendChild(deleteBtn);

    const zeroBtn = document.createElement('div');
    zeroBtn.className = 'dot numeric';
    zeroBtn.textContent = '0';
    zeroBtn.dataset.digit = '0';
    zeroBtn.dataset.index = 'special_0';
    zeroBtn.dataset.value = '0';
    elements.specialRow.appendChild(zeroBtn);

    const spaceBtn = document.createElement('div');
    spaceBtn.className = 'special-button space';
    // ボタンのテキストを「改行」に変更
    spaceBtn.textContent = '改行';
    spaceBtn.dataset.action = 'space';
    // ヒントテキストも変更
    spaceBtn.title = '改行を挿入';
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
    const checkLayout = () => {
        resizeCanvas();
        if (isMobileDevice()) {
            // モバイル時はデフォルトでText Sectionを表示
            if (elements.textSection && elements.outputSection) {
                elements.outputSection.classList.add('hide');
                elements.textSection.classList.remove('hide');
            }
        } else {
            // デスクトップでは両方表示
            if (elements.outputSection) elements.outputSection.classList.remove('hide');
            if (elements.textSection) elements.textSection.classList.remove('hide');
        }
        focusOnInput();
    };
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', checkLayout);
    checkLayout();
};

// --- Rich text editor functionality ---
const initRichTextEditor = () => {
    const editor = document.getElementById('txt-input');
    
    if (!editor) return;
    
    // Current active color
    let currentColor = 'black';
    
    // Color buttons
    const colorButtons = document.querySelectorAll('.color-btn');
    
    // Set initial caret color
    editor.style.caretColor = currentColor;
    
    // Apply color function - ColorForth風に修正
    const applyColor = (color) => {
        currentColor = color;
        
        // Update active button
        colorButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
        
        // Set caret color
        editor.style.caretColor = color;
        
        // ColorForth風 - 色変更は空白を意味する
        insertColorChange(color);
        
        // Focus back on editor
        editor.focus();
    };
    
    // Handle color button clicks
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyColor(btn.dataset.color);
        });
    });
    
    // Handle keydown events for text insertion
    editor.addEventListener('keydown', (e) => {
        // Skip for special keys (arrows, etc)
        if (e.key.length !== 1 && !['Enter', 'Tab'].includes(e.key)) return;
        
        // Skip for key combos (Ctrl+V, etc)
        if (e.ctrlKey || e.metaKey) return;
        
        // Prevent default for normal character input and handle manually
        e.preventDefault();
        
        if (e.key === 'Tab') {
            // Insert a tab (4 spaces)
            insertColoredText('    ', currentColor);
            return;
        }
        
        // Insert the character with current color
        const char = e.key === 'Enter' ? '\n' : e.key;
        insertColoredText(char, currentColor);
    });
    
    // Handle paste events to preserve color
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        
        // Get text content from clipboard
        const text = e.clipboardData.getData('text/plain');
        
        // Insert with current color
        insertColoredText(text, currentColor);
    });
    
    // Initial focus
    focusOnInput();
    
    // Set black as the initial active color
    document.getElementById('color-black').classList.add('active');
};

// --- Initialization on load ---
window.addEventListener('DOMContentLoaded', () => {
    initKeypad();
    initResponsiveLayout();
    setupExecuteButtonListener();
    setupClearButtonListener();
    setupKeyboardHandlers();
    initRichTextEditor(); // リッチテキストエディタを初期化
    focusOnInput();
});