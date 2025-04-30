// --- 分数計算をサポートするクラス ---
const Fraction = (() => {
  // 最大公約数を計算するヘルパー関数
  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    
    // 小数の場合は整数に変換
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

  // Fractionクラスコンストラクタ
  const constructor = (numerator, denominator = 1, isFractionOperation = false) => {
    if (denominator === 0) {
      throw new Error("Division by zero");
    }
    
    const fraction = {};
    fraction.numerator = Number(numerator);
    fraction.denominator = Number(denominator);
    
    // 分母が負の場合は分子・分母ともに符号を反転
    if (fraction.denominator < 0) {
      fraction.numerator = -fraction.numerator;
      fraction.denominator = -fraction.denominator;
    }
    
    // 明示的な分数演算の場合はフラグをセット
    fraction.isFractionOperation = isFractionOperation;
    
    // メソッドを追加
    fraction.simplify = () => {
      if (fraction.numerator === 0) {
        fraction.denominator = 1;
        return fraction;
      }
      
      const divisor = gcd(fraction.numerator, fraction.denominator);
      if (divisor !== 0 && divisor !== 1) {
        fraction.numerator /= divisor;
        fraction.denominator /= divisor;
      }
      return fraction;
    };
    
    fraction.add = (other, isFractionOp = false) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      const newNumerator = fraction.numerator * otherFraction.denominator + 
                           otherFraction.numerator * fraction.denominator;
      const newDenominator = fraction.denominator * otherFraction.denominator;
      
      // いずれかが明示的な分数演算であれば、結果も分数演算とみなす
      const resultIsFraction = fraction.isFractionOperation || 
                               otherFraction.isFractionOperation || 
                               isFractionOp;
      
      return constructor(newNumerator, newDenominator, resultIsFraction);
    };
    
    fraction.subtract = (other, isFractionOp = false) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      const newNumerator = fraction.numerator * otherFraction.denominator - 
                           otherFraction.numerator * fraction.denominator;
      const newDenominator = fraction.denominator * otherFraction.denominator;
      
      const resultIsFraction = fraction.isFractionOperation || 
                               otherFraction.isFractionOperation || 
                               isFractionOp;
      
      return constructor(newNumerator, newDenominator, resultIsFraction);
    };
    
    fraction.multiply = (other, isFractionOp = false) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      const newNumerator = fraction.numerator * otherFraction.numerator;
      const newDenominator = fraction.denominator * otherFraction.denominator;
      
      const resultIsFraction = fraction.isFractionOperation || 
                               otherFraction.isFractionOperation || 
                               isFractionOp;
      
      return constructor(newNumerator, newDenominator, resultIsFraction);
    };
    
    fraction.divide = (other, isFractionOp = true) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      if (otherFraction.numerator === 0) {
        throw new Error("Division by zero");
      }
      
      const newNumerator = fraction.numerator * otherFraction.denominator;
      const newDenominator = fraction.denominator * otherFraction.numerator;
      
      const resultIsFraction = fraction.isFractionOperation || 
                               otherFraction.isFractionOperation || 
                               isFractionOp;
      
      return constructor(newNumerator, newDenominator, resultIsFraction);
    };
    
    fraction.greaterThan = (other) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      return fraction.numerator * otherFraction.denominator > 
             otherFraction.numerator * fraction.denominator;
    };
    
    fraction.greaterThanOrEqual = (other) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      return fraction.numerator * otherFraction.denominator >= 
             otherFraction.numerator * fraction.denominator;
    };
    
    fraction.equals = (other) => {
      const otherFraction = other.numerator !== undefined ? other : constructor(other);
      
      return fraction.numerator * otherFraction.denominator === 
             otherFraction.numerator * fraction.denominator;
    };
    
    fraction.toString = () => {
      if (fraction.denominator === 1 || !fraction.isFractionOperation) {
        return String(fraction.numerator / fraction.denominator);
      } else {
        return `${fraction.numerator}/${fraction.denominator}`;
      }
    };
    
    fraction.toNumber = () => fraction.numerator / fraction.denominator;
    
    // 約分して返す
    return fraction.simplify();
  };
  
  // 文字列から分数を生成
  constructor.fromString = (str, isFractionOp = false) => {
    if (str.includes('/')) {
      const [numerator, denominator] = str.split('/').map(s => parseFloat(s.trim()));
      return constructor(numerator, denominator, true);
    } else {
      return constructor(parseFloat(str), 1, isFractionOp);
    }
  };
  
  return constructor;
})();

// ShikigamiInterpreter
const shikigamiInterpreter = (() => {
  // 内部状態
  const state = {
    variables: {},
    functions: {}
  };
  
  // トークン化 - コードを意味のある単位に分割
  const tokenize = (code) => {
    // コメントを削除
    code = code.replace(/#.*$/gm, '');
    
    // 分数表記の特別処理（トークン化の前に分数をマーク）
    code = code.replace(/(\d+)\/(\d+)/g, "$1_FRAC_$2");
    
    // トークンに分割（文字列は保持）
    const processTokens = () => {
      const tokens = [];
      let current = '';
      let inString = false;
      let stringChar = '';
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        if (inString) {
          if (char === stringChar && code[i-1] !== '\\') {
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
        } else if ('(){}[]+=*><,;:'.includes(char)) { // '/'を演算子リストから除外
          if (current.trim()) {
            tokens.push(current.trim());
            current = '';
          }
          tokens.push(char);
        } else {
          current += char;
        }
      }
      
      if (current.trim()) {
        tokens.push(current.trim());
      }
      
      return tokens;
    };
    
    // 分数表記を復元
    const restoreFractions = (tokens) => tokens.map(token => {
      if (token.includes('_FRAC_')) {
        const [numerator, denominator] = token.split('_FRAC_');
        return numerator + '/' + denominator;
      }
      return token;
    });
    
    return restoreFractions(processTokens()).filter(t => t.trim() !== '');
  };
  
  // 構文解析 - トークンを構文木に変換
  const parse = (tokens) => {
    // 単一の式を解析
    const parseExpression = (index) => {
      if (index >= tokens.length) {
        throw new Error('Unexpected end of input');
      }
      
      const token = tokens[index];
      
      // 数値リテラル（分数を含む）
      if (/^-?\d+(\.\d+)?$/.test(token) || /^-?\d+\/\d+$/.test(token)) {
        let value;
        let isFraction = false;
        
        if (token.includes('/')) {
          isFraction = true;
          const [numerator, denominator] = token.split('/').map(n => parseFloat(n));
          value = Fraction(numerator, denominator, true);
        } else {
          value = Fraction(parseFloat(token), 1, false);
        }
        
        return { 
          type: 'number', 
          value: value,
          isFraction: isFraction,
          nextIndex: index + 1 
        };
      }
      
      // 文字列リテラル
      if (/^["'].*["']$/.test(token)) {
        return { 
          type: 'string', 
          value: token.substring(1, token.length - 1), 
          nextIndex: index + 1 
        };
      }
      
      // 変数参照または関数呼び出し
      if (/^[A-Z][A-Z0-9_]*$/.test(token)) {
        // 関数呼び出しを確認
        if (index + 1 < tokens.length && tokens[index + 1] === '(') {
          const parseArguments = () => {
            let paramIndex = index + 2;
            const args = [];
            
            while (paramIndex < tokens.length && tokens[paramIndex] !== ')') {
              const arg = parseExpression(paramIndex);
              args.push(arg);
              paramIndex = arg.nextIndex;
              
              // カンマがあれば次の引数へ
              if (paramIndex < tokens.length && tokens[paramIndex] === ',') {
                paramIndex++;
              }
            }
            
            if (paramIndex >= tokens.length || tokens[paramIndex] !== ')') {
              throw new Error('Expected ) after function arguments');
            }
            
            return { args, nextIndex: paramIndex + 1 };
          };
          
          const { args, nextIndex } = parseArguments();
          
          return {
            type: 'function_call',
            name: token,
            arguments: args,
            nextIndex
          };
        }
        
        // 通常の変数参照
        return { 
          type: 'variable', 
          name: token, 
          nextIndex: index + 1 
        };
      }
      
      // 演算子（前置記法）
      if (['+', '-', '*', '/', '>', '>=', '==', '='].includes(token)) {
        if (token === '=') {
          // 変数名が必要
          if (index + 2 >= tokens.length) {
            throw new Error('Invalid assignment expression');
          }
          
          const varName = tokens[index + 1];
          
          // 関数定義を確認
          if (index + 3 < tokens.length && tokens[index + 2] === '(' && /^[A-Z][A-Z0-9_]*$/.test(varName)) {
            const parseParameters = () => {
              let paramIndex = index + 3;
              const params = [];
              
              while (paramIndex < tokens.length && tokens[paramIndex] !== ')') {
                if (!/^[A-Z][A-Z0-9_]*$/.test(tokens[paramIndex])) {
                  throw new Error(`Invalid parameter name: ${tokens[paramIndex]}`);
                }
                
                params.push(tokens[paramIndex]);
                paramIndex++;
                
                // カンマがあれば次のパラメータへ
                if (paramIndex < tokens.length && tokens[paramIndex] === ',') {
                  paramIndex++;
                }
              }
              
              if (paramIndex >= tokens.length || tokens[paramIndex] !== ')') {
                throw new Error('Expected ) after function parameters');
              }
              
              return { params, bodyStartIndex: paramIndex + 1 };
            };
            
            const { params, bodyStartIndex } = parseParameters();
            const bodyExpr = parseExpression(bodyStartIndex);
            
            return {
              type: 'function_definition',
              name: varName,
              params,
              body: bodyExpr,
              nextIndex: bodyExpr.nextIndex
            };
          }
          
          // 通常の変数代入
          if (!/^[A-Z][A-Z0-9_]*$/.test(varName)) {
            throw new Error(`Invalid variable name: ${varName}`);
          }
          
          const valueExpr = parseExpression(index + 2);
          
          return {
            type: 'assignment',
            variable: varName,
            value: valueExpr,
            nextIndex: valueExpr.nextIndex
          };
        }
        
        // 二項演算子
        const left = parseExpression(index + 1);
        const right = parseExpression(left.nextIndex);
        
        return {
          type: 'operation',
          operator: token,
          left,
          right,
          nextIndex: right.nextIndex
        };
      }
      
      throw new Error(`Unexpected token: ${token}`);
    };
    
    // プログラム全体を式のシーケンスとして解析
    const parseProgram = () => {
      const expressions = [];
      let index = 0;
      
      while (index < tokens.length) {
        const expr = parseExpression(index);
        expressions.push(expr);
        index = expr.nextIndex;
        
        // オプションのセミコロンをスキップ
        if (index < tokens.length && tokens[index] === ';') {
          index++;
        }
      }
      
      return expressions;
    };
    
    return parseProgram();
  };
  
  // 評価 - 構文木を実行して結果を返す
  const evaluate = (ast, env = { variables: state.variables, functions: state.functions }) => {
    // 単一ノードの評価
    const evaluateNode = (node, scope = env) => {
      // 数値ノード
      const evalNumber = () => {
        if (node.value.numerator !== undefined) {
          return node.value;
        }
        return Fraction(node.value, 1, node.isFraction || false);
      };
      
      // 変数参照
      const evalVariable = () => {
        if (scope.variables.hasOwnProperty(node.name)) {
          return scope.variables[node.name];
        }
        throw new Error(`Undefined variable: ${node.name}`);
      };
      
      // 演算
      const evalOperation = () => {
        const left = evaluateNode(node.left, scope);
        const right = evaluateNode(node.right, scope);
        
        // 文字列結合（+演算子）
        if (typeof left === 'string' || typeof right === 'string') {
          if (node.operator === '+') {
            return String(left) + String(right);
          }
          throw new Error(`Cannot apply operator ${node.operator} to strings`);
        }
        
        // 数値演算
        const operators = {
          '+': (a, b) => a.add(b, false),
          '-': (a, b) => a.subtract(b, false),
          '*': (a, b) => a.multiply(b, false),
          '/': (a, b) => a.divide(b, true),
          '>': (a, b) => a.greaterThan(b),
          '>=': (a, b) => a.greaterThanOrEqual(b),
          '==': (a, b) => a.equals(b)
        };
        
        if (operators[node.operator]) {
          return operators[node.operator](left, right);
        }
        
        throw new Error(`Unknown operator: ${node.operator}`);
      };
      
      // 変数代入
      const evalAssignment = () => {
        const value = evaluateNode(node.value, scope);
        scope.variables[node.variable] = value;
        return value;
      };
      
      // 関数定義
      const evalFunctionDefinition = () => {
        scope.functions[node.name] = {
          params: node.params,
          body: node.body
        };
        return `Function ${node.name} defined`;
      };
      
      // 関数呼び出し
      const evalFunctionCall = () => {
        // 関数を探す
        if (!scope.functions.hasOwnProperty(node.name)) {
          throw new Error(`Undefined function: ${node.name}`);
        }
        
        const func = scope.functions[node.name];
        
        // 引数の数をチェック
        if (func.params.length !== node.arguments.length) {
          throw new Error(`Expected ${func.params.length} arguments, got ${node.arguments.length}`);
        }
        
        // 関数スコープを作成
        const functionScope = {
          variables: { ...scope.variables },
          functions: scope.functions
        };
        
        // 引数を評価して関数スコープに追加
        node.arguments.forEach((arg, index) => {
          functionScope.variables[func.params[index]] = evaluateNode(arg, scope);
        });
        
        // 関数本体を評価
        return evaluateNode(func.body, functionScope);
      };
      
      // ノードタイプに応じた評価関数の呼び出し
      const evaluators = {
        'number': evalNumber,
        'string': () => node.value,
        'variable': evalVariable,
        'operation': evalOperation,
        'assignment': evalAssignment,
        'function_definition': evalFunctionDefinition,
        'function_call': evalFunctionCall
      };
      
      if (evaluators[node.type]) {
        return evaluators[node.type]();
      }
      
      throw new Error(`Unknown node type: ${node.type}`);
    };
    
    // プログラム全体（式のシーケンス）の評価
    const evaluateProgram = () => {
      let result;
      ast.forEach(expr => {
        result = evaluateNode(expr, env);
      });
      return result;
    };
    
    return evaluateProgram();
  };
  
  // コード実行のエントリーポイント
  const execute = (code) => {
    try {
      console.log("実行コード:", code);
      
      // 後方互換性のある処理（デモ用）
      if (code.includes("FIZZBUZZ")) {
        let maxNum = 20;
        const match = code.match(/FIZZBUZZ\s*\(\s*(\d+)\s*\)/);
        if (match && match[1]) {
          maxNum = parseInt(match[1], 10);
          if (maxNum > 1000) maxNum = 1000;
        }
        const result = Array.from({ length: maxNum }, (_, i) => {
          const num = i + 1;
          if (num % 15 === 0) return "FizzBuzz";
          if (num % 3 === 0) return "Fizz";
          if (num % 5 === 0) return "Buzz";
          return num.toString();
        });
        return result.join(", ");
      }
      
      // 新しいパーサーとインタープリターを使用
      const tokens = tokenize(code);
      console.log("Tokens:", tokens);
      
      const ast = parse(tokens);
      console.log("AST:", JSON.stringify(ast, null, 2));
      
      const result = evaluate(ast);
      console.log("Result:", result);
      
      // 結果を文字列化して返す
      if (result && result.numerator !== undefined) {
        return result.toString();
      }
      
      return result !== undefined ? String(result) : "実行完了";
    } catch (error) {
      console.error("Interpreter error:", error);
      return `エラー: ${error.message}`;
    }
  };
  
  // 公開インターフェース
  return {
    variables: state.variables,
    functions: state.functions,
    tokenize,
    parse,
    evaluate,
    execute
  };
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
    if (isMobileDevice()) showTextSection();
    focusOnInput();
};

const clearInput = () => {
    if (elements.input) {
        elements.input.value = '';
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
            if (cutoff === -1) {
                 cutoff = 0;
            } else if (lastNewline !== -1 && lastNewline === pos -1) {
                 cutoff = lastNewline;
            } else if (lastSpace !== -1 && lastSpace === pos - 1 && !/\s/.test(before.charAt(pos-2))) {
                 cutoff = lastSpace;
            } else if (lastNewline > lastSpace) {
                 cutoff = lastNewline + 1;
            } else if (lastSpace > lastNewline) {
                 cutoff = lastSpace + 1;
            } else {
                 cutoff = 0;
            }
            
            if (before.trim() === '') cutoff = 0;
            before = before.slice(0, cutoff);
        } else {
            before = before.slice(0, -1);
        }
        ta.value = before + after;
        ta.selectionStart = ta.selectionEnd = before.length;
    }
    if (isMobileDevice()) showTextSection();
    focusOnInput();
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

const executeCode = () => {
    const code = elements.input ? elements.input.value : '';
    if (!code.trim()) return;
    let isShikigamiSuccess = false;
    try {
        // 式神コードを実行
        const result = shikigamiInterpreter.execute(code);
        const resultString = result !== undefined ? String(result) : "実行完了";
        
        if (typeof resultString === 'string' && resultString.startsWith("エラー:")) {
            // shikigami言語レベルのエラーが返ってきた場合
            isShikigamiSuccess = false;
            if (elements.output) {
                elements.output.value = resultString;
            }
        } else {
            // shikigami言語レベルで成功した場合
            isShikigamiSuccess = true;
            if (elements.output) {
                elements.output.value = resultString;
                elements.output.classList.add('executed');
                setTimeout(() => elements.output.classList.remove('executed'), 300);
            }
        }
        // outputセクションを表示 (エラーでも成功でも表示)
        showOutputSection();
        // 成功した場合のみ、入力エリアをクリア
        if (isShikigamiSuccess && elements.input) {
            elements.input.value = '';
        }
        focusOnInput();
    } catch (err) {
        // JavaScriptレベルのエラー
        isShikigamiSuccess = false;
        if (elements.output) {
            elements.output.value = `致命的なエラー: ${err.message}`;
        }
        showOutputSection();
        focusOnInput();
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
    spaceBtn.textContent = '空白';
    spaceBtn.dataset.action = 'space';
    spaceBtn.title = '空白 (ダブルタップで改行)';
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

// --- Initialization on load ---
window.addEventListener('DOMContentLoaded', () => {
    initKeypad();
    initResponsiveLayout();
    setupExecuteButtonListener();
    setupClearButtonListener();
    setupKeyboardHandlers();
    focusOnInput();
});