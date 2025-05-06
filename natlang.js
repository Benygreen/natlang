const fs = require('fs').promises;
const path = require('path')
const cli_arg = process.argv[2];
let readData;
if(!(cli_arg.toLowerCase()).endsWith(".nat")) {
    console.log("Not a NAT file.");
    process.exit(0);
}
function stripComments(code) {
    code = code.replace(/\/\*[\s\S]*?\*\//g, '');
    code = code.replace(/\/\/.*/g, '');
    return code;
}
function tokenize(input) {
    input = stripComments(input);
    let tokens = [];
    let current = '';
    let inString = false;
    for (let i = 0; i < input.length; i++) {
        const char = input[i];
        if (char === '"') {
            current += char;
            if (inString) {
                tokens.push(current);
                current = '';
                inString = false;
            } else {
                inString = true;
            }
            continue;
        }
        if (inString) {
            current += char;
            continue;
        }
        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            if (char === '\n') tokens.push('__newline__');
            continue;
        }
        if ('=():,'.includes(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            tokens.push(char);
            continue;
        }
        current += char;
    }
    if (current) tokens.push(current);
    return tokens;
}
function to2DTokenLines(tokens) {
    const lines = [];
    let currentLine = [];
    for (let token of tokens) {
        if (token === '__newline__') {
            lines.push(currentLine);
            currentLine = [];
        } else {
            currentLine.push(token);
        }
    }
    if (currentLine.length > 0) {
        lines.push(currentLine);
    }
    return lines;
}
function isString(input) {
    try {
        if(eval("typeof " + input) == "string") {
            return true;
        } else {
            return false;
        }
    } catch(err) {
        return false;
    }
}
function throwSyntaxError(message) {
    console.error("Natlang: " + message);
    process.exit(-2);
}
let debug = false;
function run(code) {
    let parsingCode = to2DTokenLines(code);
    let vars = {};
    for (let line of parsingCode) {
        for (let i = 0; i < line.length; i++) {
            const token = line[i];
            if (isString(token)) {
                const stringVal = eval(token);
            } else {
                switch (token) {
                    case 'show':
                        const showOpen = line[i + 1];
                        const showArg = line[i + 2];
                        const showClose = line[i + 3];
                        if (showOpen === '(' && showClose === ')') {
                            let valToShow;
                            if (isString(showArg)) {
                                valToShow = eval(showArg);
                            } else if (vars.hasOwnProperty(showArg)) {
                                valToShow = vars[showArg].value;
                            } else {
                                valToShow = showArg;
                            }
                            console.log(valToShow);
                            i += 3;
                        }
                        break;
                        case 'allow':
                            const varName = line[i + 1];
                            const eq = line[i + 2];
                            const valueToken = line[i + 3];
                            if (eq === '=') {
                                let val, type;
                                if (isString(valueToken)) {
                                    val = eval(valueToken);
                                    type = 'string';
                                } else if (!isNaN(valueToken)) {
                                    val = Number(valueToken);
                                    type = 'number';
                                } else {
                                    val = valueToken;
                                    type = 'unknown';
                                }
                                vars[varName] = {
                                    type,
                                    value: val
                                };
                                i += 3;
                            }
                            if(debug) {
                                console.log("> variable declared: ", varName, " = ", val, ": ", type)
                            }
                            break;
                    case 'return':
                        break;
                    default:
                        if (line[i + 1] === "=") {
                            if (token in vars) {
                                if(typeof line[i + 2] === "undefined") {
                                    throwSyntaxError("No assignment candidate");
                                }
                                let newValue = line[i + 2];
                                let newType;
                                if (isString(newValue)) {
                                    newValue = eval(newValue);
                                    newType = "string";
                                } else if (!isNaN(newValue)) {
                                    newValue = Number(newValue);
                                    newType = "number";
                                } else if (newValue in vars) {
                                    newValue = vars[newValue].value;
                                    newType = vars[newValue].type;
                                } else {
                                    newType = "unknown";
                                }
                                vars[token].value = newValue;
                                vars[token].type = newType;
                            }
                            i += 3;
                            break;
                        } else {
                            throwSyntaxError("Unexpected identifier");
                        }
                }
            }
        }
    }
}
function main(arg) {
    const tokenized = tokenize(arg);
    const filteredTokens = [];
    for (let token of tokenized) {
        if (typeof token === "string" && token.startsWith("-interpreter-")) {
            const option = token.replace("-interpreter-", "");
            switch (option) {
                case "debug-mode":
                    debug = true;
                    break;
                default:
                    throwSyntaxError("Invalid interpreter switch");
            }
        } else {
            filteredTokens.push(token);
        }
    }
    const tokenLines = to2DTokenLines(filteredTokens);
    run(tokenLines);
}
fs.readFile(path.join(__dirname, cli_arg), 'utf8')
    .then(data => {
        main(data);
    })