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

  const tokenize = (code) => {
    code = code.replace(/#.*$/gm, '');
    code = code.replace(/\s*:\s*[a-zA-Z_]+\b/g, '');
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
        if (char !== ':') tokens.push(char);
      } else {
        current += char;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    return tokens.map((t) => (t.includes('_FRAC_') ? t.replace('_FRAC_', '/') : t)).filter((t) => t.trim() !== '');
  };

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
      if (['+', '-', '*', '/', '>', '>=', '==', '='].includes(token)) {
        if (token === '=') {
          if (index + 2 >= tokens.length) throw new Error('Invalid assignment expression');
          const varName = tokens[index + 1];

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
          const valueExpr = parseExpression(index + 2);
          return { type: 'assignment', variable: varName, value: valueExpr, nextIndex: valueExpr.nextIndex };
        }
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

  const execute = (code) => {
    try {
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

const isMobileDevice = () => {
    return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /Mobi|Android/i.test(navigator.userAgent);
};

const focusOnInput = () => {
    if (elements.input) {
        elements.input.focus();
    }
};

const getColorCommand = (color) => {
    return `\u200B[${color}]`;
};

// カーソル位置を取得するヘルパー関数
const getCursorPosition = (element) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
};

// カーソル位置を設定するヘルパー関数
const setCursorPosition = (element, position) => {
    let charIndex = 0;
    let foundPosition = false;
    
    const traverseNodes = (node) => {
        if (foundPosition) return;
        
        if (node.nodeType === Node.TEXT_NODE) {
            const nodeLength = node.length;
            if (charIndex + nodeLength >= position) {
                const range = document.createRange();
                const selection = window.getSelection();
                
                range.setStart(node, position - charIndex);
                range.collapse(true);
                
                selection.removeAllRanges();
                selection.addRange(range);
                
                foundPosition = true;
            }
            charIndex += nodeLength;
        } else {
            for (let i = 0; i < node.childNodes.length && !foundPosition; i++) {
                traverseNodes(node.childNodes[i]);
            }
        }
    };
    
    traverseNodes(element);
    
    // 位置が見つからなかった場合はエディタの最後にカーソルを設定
    if (!foundPosition) {
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (element.lastChild) {
            if (element.lastChild.nodeType === Node.TEXT_NODE) {
                range.setStart(element.lastChild, element.lastChild.length);
            } else {
                range.setStartAfter(element.lastChild);
            }
        } else {
            range.setStart(element, 0);
        }
        
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
};

const insertColoredText = (text, color) => {
    const editor = elements.input;
    if (!editor) return;
    
    // エディタにフォーカスを当てる
    editor.focus();
    
    if (text === '\n') {
        // 改行の挿入 - <br>タグを使用
        document.execCommand('insertHTML', false, '<br>');
    } else {
        // 通常のテキスト挿入 - 色を適用して挿入
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('foreColor', false, color);
        document.execCommand('insertText', false, text);
    }
};

const insertColorChange = (color) => {
    const editor = elements.input;
    if (!editor) return;
    
    // 色を変更し、空白を挿入
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('foreColor', false, color);
    document.execCommand('insertText', false, ' ');
};

const insertAtCursor = (text) => {
    const editor = elements.input;
    if (!editor) return;
    
    const currentActiveColor = document.querySelector('.color-btn.active')?.dataset.color || 'black';
    
    insertColoredText(text, currentActiveColor);
    
    if (isMobileDevice()) showTextSection();
    focusOnInput();
};

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

const clearCanvas = () => {
    const lineCtx = elements.lineCanvas ? elements.lineCanvas.getContext('2d') : null;
    if (lineCtx && elements.lineCanvas) {
        lineCtx.clearRect(0, 0, elements.lineCanvas.width, elements.lineCanvas.height);
    }
};

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
    if (letterPatterns.hasOwnProperty(totalValue)) {
        console.log(`認識成功 (完全一致): 値=${totalValue}, 文字=${letterPatterns[totalValue]}`);
        return letterPatterns[totalValue];
    }

    if (CONFIG.recognition.tolerance > 0 && totalValue > 0) {
        let bestMatch = null;

        for (const patternValueStr in letterPatterns) {
            const patternValue = parseInt(patternValueStr, 10);
            const diff = totalValue ^ patternValue;

            const isPowerOfTwo = (diff > 0) && ((diff & (diff - 1)) === 0);

            if (isPowerOfTwo) {
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

// 削除処理 - 単純化版
const handleDeleteAction = (deleteToken = false) => {
    const editor = elements.input;
    if (!editor) return;
    
    if (deleteToken) {
        // トークン削除モード
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // 現在のカーソル位置を取得
        const cursorPosition = getCursorPosition(editor);
        if (cursorPosition === 0) return;
        
        // テキスト全体を取得
        const fullText = editor.textContent || '';
        
        // トークンの範囲を見つける
        let tokenStart = cursorPosition;
        let foundWord = false;
        
        while (tokenStart > 0) {
            const char = fullText.charAt(tokenStart - 1);
            if (char === ' ' || char === '\n') {
                if (foundWord) break;
            } else {
                foundWord = true;
            }
            tokenStart--;
        }
        
        // 直前の空白も削除
        let spaceStart = tokenStart;
        while (spaceStart > 0) {
            const char = fullText.charAt(spaceStart - 1);
            if (char === ' ' || char === '\n') {
                spaceStart--;
            } else {
                break;
            }
        }
        
        // 削除範囲の選択
        const range = selection.getRangeAt(0);
        const startNode = editor.firstChild;
        
        if (startNode) {
            // カーソル位置から削除範囲の分だけ戻る
            const selection = window.getSelection();
            selection.removeAllRanges();
            
            // テキストノードを探索して範囲を設定
            let currentPos = 0;
            const setRange = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    const nodeLength = node.length;
                    if (currentPos <= spaceStart && spaceStart < currentPos + nodeLength) {
                        // 削除開始位置
                        range.setStart(node, spaceStart - currentPos);
                    }
                    if (currentPos <= cursorPosition && cursorPosition <= currentPos + nodeLength) {
                        // 削除終了位置
                        range.setEnd(node, cursorPosition - currentPos);
                        return true;
                    }
                    currentPos += nodeLength;
                } else {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        if (setRange(node.childNodes[i])) return true;
                    }
                }
                return false;
            };
            
            setRange(editor);
            selection.addRange(range);
            document.execCommand('delete', false);
        }
    } else {
        // 一文字削除 - シンプルにdomの削除機能を使用
        document.execCommand('delete', false);
    }
    
    focusOnInput();
    if (isMobileDevice()) showTextSection();
};

const findLastTextNode = (element) => {
    if (element.nodeType === Node.TEXT_NODE) return element;
    
    for (let i = element.childNodes.length - 1; i >= 0; i--) {
        const lastNode = findLastTextNode(element.childNodes[i]);
        if (lastNode) return lastNode;
    }
    
    return null;
};

const executeCode = () => {
    const editor = elements.input;
    const code = editor ? editor.textContent || editor.innerText : '';
    
    if (!code.trim()) return;
    let isSuccess = false;
    try {
        const result = interpreter.execute(code);
        const resultString = result !== undefined ? String(result) : "実行完了";
        
        if (typeof resultString === 'string' && resultString.startsWith("エラー:")) {
            isSuccess = false;
            if (elements.output) {
                elements.output.value = resultString;
            }
        } else {
            isSuccess = true;
            if (elements.output) {
                elements.output.value = resultString;
                elements.output.classList.add('executed');
                setTimeout(() => elements.output.classList.remove('executed'), 300);
            }
        }
        showOutputSection();
        if (isSuccess && editor) {
            editor.innerHTML = '';
        }
        focusOnInput();
    } catch (err) {
        isSuccess = false;
        if (elements.output) {
            elements.output.value = `致命的なエラー: ${err.message}`;
        }
        showOutputSection();
        focusOnInput();
    }
};

// 特殊ボタンのイベントリスナー設定 - シンプル化
const handleSpecialButtonClick = (e, type, actions) => {
    if (e && e.preventDefault) e.preventDefault();
    const now = Date.now();
    
    // ダブルクリック検出
    if (specialButtonState.clickTarget === type &&
        now - specialButtonState.lastClickTime < specialButtonState.doubleClickDelay) {
        clearTimeout(specialButtonState.clickTimer);
        specialButtonState.clickCount = 0;
        specialButtonState.clickTarget = null;
        specialButtonState.clickTimer = null;
        if (actions.double) actions.double();
    } else {
        // シングルクリック処理
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

const setupMultiTouchSupport = () => {
    if (isMobileDevice() && elements.d2dArea) {
        elements.d2dArea.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
        elements.d2dArea.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }
};

const setupDotEventListeners = () => {
    if (!elements.d2dArea) return;
    elements.d2dArea.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('dot')) {
            handlePointerDown(e, e.target);
        }
    }, { passive: false });
};

// 改行ボタンのイベントリスナーだけを修正
const setupSpecialButtonListeners = () => {
    const deleteBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="delete"]') : null;
    const spaceBtn = elements.specialRow ? elements.specialRow.querySelector('[data-action="space"]') : null;

    if (deleteBtn) {
        // 削除ボタンの処理はそのまま
        deleteBtn.addEventListener('pointerup', e => handleSpecialButtonClick(e, 'delete', {
            single: () => handleDeleteAction(false),
            double: () => handleDeleteAction(true)
        }));
        deleteBtn.addEventListener('pointerdown', e => e.preventDefault());
    }

    if (spaceBtn) {
    // 改行ボタンの処理を変更
    spaceBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const editor = elements.input;
        if (editor) {
            // 直接改行を挿入
            document.execCommand('insertHTML', false, '<br>');
            editor.focus();
        }
    });
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

function initKeypad() {
    if (!elements.dotGrid || !elements.specialRow) {
        console.error("Required grid elements not found!");
        return;
    }

    elements.dotGrid.innerHTML = '';
    elements.specialRow.innerHTML = '';

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

// initKeypad内の改行ボタン作成部分
const spaceBtn = document.createElement('div');
spaceBtn.className = 'special-button space';
spaceBtn.textContent = '改行';
spaceBtn.dataset.action = 'space';
spaceBtn.title = '改行を挿入';
// 直接イベントハンドラを追加
spaceBtn.onclick = (e) => {
    e.preventDefault();
    document.execCommand('insertHTML', false, '<br>');
    focusOnInput();
};

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
            if (elements.textSection && elements.outputSection) {
                elements.outputSection.classList.add('hide');
                elements.textSection.classList.remove('hide');
            }
        } else {
            if (elements.outputSection) elements.outputSection.classList.remove('hide');
            if (elements.textSection) elements.textSection.classList.remove('hide');
        }
        focusOnInput();
    };
    window.addEventListener('resize', checkLayout);
    window.addEventListener('orientationchange', checkLayout);
    checkLayout();
};

const initRichTextEditor = () => {
    const editor = document.getElementById('txt-input');
    
    if (!editor) return;
    
    let currentColor = 'black';
    
    const colorButtons = document.querySelectorAll('.color-btn');
    
    editor.style.caretColor = currentColor;
    
    const applyColor = (color) => {
        currentColor = color;
        
        colorButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.color === color);
        });
        
        editor.style.caretColor = color;
        
        insertColorChange(color);
        
        editor.focus();
    };
    
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            applyColor(btn.dataset.color);
        });
    });
    
    editor.addEventListener('keydown', (e) => {
        if (e.key.length !== 1 && !['Enter', 'Tab'].includes(e.key)) return;
        
        if (e.ctrlKey || e.metaKey) return;
        
        e.preventDefault();
        
        if (e.key === 'Tab') {
            insertColoredText('    ', currentColor);
            return;
        }
        
        const char = e.key === 'Enter' ? '\n' : e.key;
        insertColoredText(char, currentColor);
    });
    
    editor.addEventListener('paste', (e) => {
        e.preventDefault();
        
        const text = e.clipboardData.getData('text/plain');
        
        insertColoredText(text, currentColor);
    });
    
    focusOnInput();
    
    document.getElementById('color-black').classList.add('active');
};

window.addEventListener('DOMContentLoaded', () => {
    initKeypad();
    initResponsiveLayout();
    setupExecuteButtonListener();
    setupClearButtonListener();
    setupKeyboardHandlers();
    initRichTextEditor();
    focusOnInput();
});