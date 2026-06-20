"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const STORAGE_KEY_SECRET = 'exesandos-key-v1';
const STORAGE_VALUE_SECRET = 'exesandos-value-v1';
function xorBytes(input, secret) {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = input[i] ^ secret[i % secret.length];
    }
    return output;
}
function toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}
function obfuscate(value, secret) {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);
    const secretBytes = encoder.encode(secret);
    return toBase64(xorBytes(valueBytes, secretBytes));
}
function deobfuscate(value, secret) {
    const decoder = new TextDecoder();
    const secretBytes = new TextEncoder().encode(secret);
    const decoded = xorBytes(fromBase64(value), secretBytes);
    return decoder.decode(decoded);
}
function getEncryptedStorageKey(rawKey) {
    return `exo_${obfuscate(rawKey, STORAGE_KEY_SECRET)}`;
}
function storageSet(rawKey, rawValue) {
    const encryptedKey = getEncryptedStorageKey(rawKey);
    const encryptedValue = obfuscate(rawValue, STORAGE_VALUE_SECRET);
    localStorage.setItem(encryptedKey, encryptedValue);
    localStorage.removeItem(rawKey);
}
function storageGet(rawKey, fallback) {
    const encryptedKey = getEncryptedStorageKey(rawKey);
    const encryptedValue = localStorage.getItem(encryptedKey);
    if (encryptedValue !== null) {
        try {
            return deobfuscate(encryptedValue, STORAGE_VALUE_SECRET);
        }
        catch (_a) {
            localStorage.removeItem(encryptedKey);
        }
    }
    const legacyValue = localStorage.getItem(rawKey);
    if (legacyValue !== null) {
        storageSet(rawKey, legacyValue);
        return legacyValue;
    }
    return fallback;
}
const debugWeatherEffectOptions = [
    { id: 'debug-weather-clear', weatherClass: 'meadow-weather-clear' },
    { id: 'debug-weather-cloudy', weatherClass: 'meadow-weather-cloudy' },
    { id: 'debug-weather-rain', weatherClass: 'meadow-weather-rain' },
    { id: 'debug-weather-snow', weatherClass: 'meadow-weather-snow' },
    { id: 'debug-weather-fog', weatherClass: 'meadow-weather-fog' },
    { id: 'debug-weather-storm', weatherClass: 'meadow-weather-storm' }
];
let currentPlayer = 'X';
let board = Array(9).fill(null);
let gameActive = true;
let isMisereMode = false;
let is3DMode = false;
let is4x4Mode = false;
let is4x4x4Mode = false;
let isHardMode = storageGet('hard_mode', 'false') === 'true';
let hardModeWins = parseInt(storageGet('hard_mode_wins', '0'));
let useMonsterPieces = storageGet('use_monster_pieces', 'false') === 'true';
let flowerLossCount = parseInt(storageGet('flower_loss_count', '0'));
let lastPlayerOutcome = null;
let consecutivePlayerOutcomeCount = 0;
let rotationX = -20;
let rotationY = -20;
const wins = {
    'default': parseInt(storageGet('wins_default', '0')),
    'misere': parseInt(storageGet('wins_misere', '0')),
    '3d': parseInt(storageGet('wins_3d', '0')),
    '4x4': parseInt(storageGet('wins_4x4', '0'))
};
const gameScores = {
    'X': JSON.parse(storageGet('score_X_v2', '{}')),
    'O': JSON.parse(storageGet('score_O_v2', '{}'))
};
const statusDisplay = document.getElementById('status');
const gameTitle = document.getElementById('game-title');
const playerLabel = document.getElementById('player-label');
let cells = document.querySelectorAll('.cell');
const resetButton = document.getElementById('reset');
const resetScoresButton = document.getElementById('reset-scores');
const misereToggle = document.getElementById('misere-toggle');
const mode3DToggle = document.getElementById('mode-3d-toggle');
const mode4x4Toggle = document.getElementById('mode-4x4-toggle');
const mode4x4x4Toggle = document.getElementById('mode-4x4x4-toggle');
const hardModeToggle = document.getElementById('hard-mode-toggle');
const hardModeContainer = document.getElementById('hard-mode-container');
const cube = document.getElementById('cube');
const controls3D = document.getElementById('controls-3d');
const messageOverlay = document.getElementById('message-overlay');
let messageTimeout = null;
const debugPanel = document.getElementById('debug-panel');
const debugMisereToggle = document.getElementById('debug-misere');
const debug4x4Toggle = document.getElementById('debug-4x4');
const debug3DToggle = document.getElementById('debug-3d');
const debug4x4x4Toggle = document.getElementById('debug-4x4x4');
const debugHardModeToggle = document.getElementById('debug-hard-mode');
const debugMeadowToggle = document.getElementById('debug-meadow');
const debugMonstersToggle = document.getElementById('debug-monsters');
const debugTreeToggle = document.getElementById('debug-tree');
const debugMoneyToggle = document.getElementById('debug-money');
const debugCreatureToggle = document.getElementById('debug-creature');
const debugLocationSelect = document.getElementById('debug-location');
const debugMeadowTimeInput = document.getElementById('debug-meadow-time');
const debugSystemTimeToggle = document.getElementById('debug-system-time');
const debugWeatherEffectToggles = debugWeatherEffectOptions.map((option) => {
    return Object.assign(Object.assign({}, option), { input: document.getElementById(option.id) });
});
const debugWeatherWindyToggle = document.getElementById('debug-weather-windy');
const misereContainer = document.getElementById('misere-container');
const mode3DContainer = document.getElementById('mode-3d-container');
const mode4x4Container = document.getElementById('mode-4x4-container');
const mode4x4x4Container = document.getElementById('mode-4x4x4-container');
const scorePlayerContainer = document.getElementById('score-player');
const scoreComputerContainer = document.getElementById('score-computer');
const meadowSkyLayer = document.getElementById('meadow-sky-layer');
const meadowWeatherLayer = document.getElementById('meadow-weather-layer');
let inactivityTimer = null;
let treeTimer = null;
let snailElement = null;
let treeElement = null;
let moneyRainInterval = null;
let moneyCleanupPromptElement = null;
let moneySweeperElement = null;
let moneySweepFrame = null;
let snowClearSignElement = null;
let snowRegrowTimer = null;
let meadowTimeInterval = null;
let lastMeadowWeatherRequestAt = 0;
let meadowWeatherRequestId = 0;
let activeMeadowWeatherClass = 'meadow-weather-clear';
let activeMeadowIsWindy = false;
let debugMeadowTimeOverride = null;
let debugWeatherLocation = 'local';
let debugForcedWeatherClass = null;
let debugForcedWindy = false;
let hasUserInteracted = false;
let cricketAudioContext = null;
let cricketInterval = null;
const maxMoneyPile = 160;
const meadowTimeClassNames = ['meadow-dawn', 'meadow-day', 'meadow-dusk', 'meadow-night'];
const meadowWeatherClassNames = [
    'meadow-weather-clear',
    'meadow-weather-cloudy',
    'meadow-weather-rain',
    'meadow-weather-snow',
    'meadow-weather-fog',
    'meadow-weather-storm',
    'meadow-weather-windy'
];
const debugWeatherLocations = {
    sheffield: { latitude: 53.3811, longitude: -1.4701, timeZone: 'Europe/London' },
    manila: { latitude: 14.5995, longitude: 120.9842, timeZone: 'Asia/Manila' },
    moscow: { latitude: 55.7558, longitude: 37.6173, timeZone: 'Europe/Moscow' },
    sydney: { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' }
};
// 2D Winning Conditions for 3x3 grid
const winningConditions2D = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];
// 2D Winning Conditions for 4x4 grid
const winningConditions4x4 = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
    [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
    [0, 5, 10, 15], [3, 6, 9, 12]
];
// 3D Winning Conditions for 3x3x3 grid
const winningConditions3D = [
    // Layer 1 (Top) - 8 lines
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6], // Diagonals
    // Layer 2 (Middle) - 8 lines
    [9, 10, 11], [12, 13, 14], [15, 16, 17], // Rows
    [9, 12, 15], [10, 13, 16], [11, 14, 17], // Columns
    [9, 13, 17], [11, 13, 15], // Diagonals
    // Layer 3 (Bottom) - 8 lines
    [18, 19, 20], [21, 22, 23], [24, 25, 26], // Rows
    [18, 21, 24], [19, 22, 25], [20, 23, 26], // Columns
    [18, 22, 26], [20, 22, 24], // Diagonals
    // Vertical columns through layers - 9 lines
    [0, 9, 18], [1, 10, 19], [2, 11, 20],
    [3, 12, 21], [4, 13, 22], [5, 14, 23],
    [6, 15, 24], [7, 16, 25], [8, 17, 26],
    // Cross-layer rows (Y-axis fixed):
    [0, 10, 20], [2, 10, 18], // Layer 1-2-3 Row 1
    [3, 13, 23], [5, 13, 21], // Layer 1-2-3 Row 2
    [6, 16, 26], [8, 16, 24], // Layer 1-2-3 Row 3
    // Cross-layer columns (X-axis fixed):
    [0, 12, 24], [18, 12, 6], // Layer 1-2-3 Col 1
    [1, 13, 25], [19, 13, 7], // Layer 1-2-3 Col 2
    [2, 14, 26], [20, 14, 8], // Layer 1-2-3 Col 3
    // 4 Space Diagonals (Corner to opposite corner through center):
    [0, 13, 26], [2, 13, 24], [6, 13, 20], [8, 13, 18]
];
// 4x4x4 Winning Conditions
const winningConditions4x4x4 = [];
function generateWinningConditions4x4x4() {
    const size = 4;
    // Rows within layers
    for (let l = 0; l < size; l++) {
        for (let r = 0; r < size; r++) {
            winningConditions4x4x4.push([l * 16 + r * 4, l * 16 + r * 4 + 1, l * 16 + r * 4 + 2, l * 16 + r * 4 + 3]);
        }
    }
    // Columns within layers
    for (let l = 0; l < size; l++) {
        for (let c = 0; c < size; c++) {
            winningConditions4x4x4.push([l * 16 + c, l * 16 + 4 + c, l * 16 + 8 + c, l * 16 + 12 + c]);
        }
    }
    // Diagonals within layers
    for (let l = 0; l < size; l++) {
        winningConditions4x4x4.push([l * 16, l * 16 + 5, l * 16 + 10, l * 16 + 15]);
        winningConditions4x4x4.push([l * 16 + 3, l * 16 + 6, l * 16 + 9, l * 16 + 12]);
    }
    // Vertical through layers
    for (let i = 0; i < 16; i++) {
        winningConditions4x4x4.push([i, i + 16, i + 32, i + 48]);
    }
    // Cross-layer rows
    for (let r = 0; r < size; r++) {
        winningConditions4x4x4.push([r * 4, 16 + r * 4 + 1, 32 + r * 4 + 2, 48 + r * 4 + 3]);
        winningConditions4x4x4.push([r * 4 + 3, 16 + r * 4 + 2, 32 + r * 4 + 1, 48 + r * 4]);
    }
    // Cross-layer columns
    for (let c = 0; c < size; c++) {
        winningConditions4x4x4.push([c, 20 + c, 40 + c, 60 + c]);
        winningConditions4x4x4.push([12 + c, 24 + c, 36 + c, 48 + c]);
    }
    // Space Diagonals
    winningConditions4x4x4.push([0, 21, 42, 63]);
    winningConditions4x4x4.push([3, 22, 41, 60]);
    winningConditions4x4x4.push([12, 25, 38, 51]);
    winningConditions4x4x4.push([15, 26, 37, 48]);
}
generateWinningConditions4x4x4();
function updateCubeRotation() {
    cube.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg)`;
}
function showMessage(text) {
    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }
    messageOverlay.innerText = text;
    messageOverlay.style.opacity = '1';
    messageTimeout = window.setTimeout(() => {
        messageOverlay.style.opacity = '0';
        messageTimeout = null;
    }, 5000);
}
function handleCellClick(clickedCellEvent) {
    if (currentPlayer === 'O' || !gameActive) {
        return;
    }
    resetInactivityTimer();
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));
    if (clickedCellIndex >= board.length || board[clickedCellIndex] !== null) {
        return;
    }
    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
    if (gameActive && currentPlayer === 'O') {
        setTimeout(handleComputerMove, 500);
    }
}
function handleComputerMove() {
    const availableIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
    if (availableIndices.length === 0 || !gameActive) {
        stopInactivityTimer();
        return;
    }
    let moveIndex;
    if (isHardMode) {
        moveIndex = getBestMove(availableIndices);
    }
    else {
        // Simple AI: pick a random available cell
        moveIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }
    const computerCell = document.querySelector(`.cell[data-index="${moveIndex}"]`);
    handleCellPlayed(computerCell, moveIndex);
    handleResultValidation();
    if (gameActive) {
        startInactivityTimer();
    }
}
function getBestMove(availableIndices) {
    let currentWinningConditions = winningConditions2D;
    if (is4x4x4Mode)
        currentWinningConditions = winningConditions4x4x4;
    else if (is4x4Mode)
        currentWinningConditions = winningConditions4x4;
    else if (is3DMode)
        currentWinningConditions = winningConditions3D;
    if (isMisereMode) {
        // Misere mode: try to avoid winning
        // 1. Filter out moves that would lead to a win
        const safeMoves = availableIndices.filter(index => {
            board[index] = 'O';
            const wins = checkWin(board, currentWinningConditions);
            board[index] = null;
            return !wins;
        });
        if (safeMoves.length > 0) {
            // Among safe moves, try to block player if player is about to win
            // But only if blocking doesn't make us win (already filtered by safeMoves)
            for (const index of safeMoves) {
                board[index] = 'X';
                if (checkWin(board, currentWinningConditions)) {
                    board[index] = null;
                    return index;
                }
                board[index] = null;
            }
            // Otherwise, pick a random safe move
            return safeMoves[Math.floor(Math.random() * safeMoves.length)];
        }
        // If no safe moves, we are forced to win (or all moves lead to win)
        return availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }
    // Normal mode: try to win, then block
    // 1. Try to win
    for (const index of availableIndices) {
        board[index] = 'O';
        if (checkWin(board, currentWinningConditions)) {
            board[index] = null;
            return index;
        }
        board[index] = null;
    }
    // 2. Block player
    for (const index of availableIndices) {
        board[index] = 'X';
        if (checkWin(board, currentWinningConditions)) {
            board[index] = null;
            return index;
        }
        board[index] = null;
    }
    // 3. Take center if available (for 3x3 and 3x3x3)
    if (!is4x4Mode && !is4x4x4Mode) {
        if (is3DMode) {
            if (availableIndices.includes(13))
                return 13; // Center of 3x3x3
        }
        else {
            if (availableIndices.includes(4))
                return 4; // Center of 3x3
        }
    }
    // 4. Random move
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
}
function checkWin(currentBoard, conditions) {
    for (let i = 0; i < conditions.length; i++) {
        const winCondition = conditions[i];
        const values = winCondition.map(idx => currentBoard[idx]);
        if (values.every(v => v !== null && v === values[0])) {
            return true;
        }
    }
    return false;
}
function updateUnlockStatus() {
    if (wins['default'] >= 10) {
        misereContainer.style.display = 'inline-block';
    }
    else {
        misereContainer.style.display = 'none';
        misereToggle.checked = false;
    }
    if (wins['misere'] >= 10) {
        mode4x4Container.style.display = 'inline-block';
    }
    else {
        mode4x4Container.style.display = 'none';
        mode4x4Toggle.checked = false;
    }
    if (wins['4x4'] >= 10) {
        mode3DContainer.style.display = 'inline-block';
    }
    else {
        mode3DContainer.style.display = 'none';
        mode3DToggle.checked = false;
    }
    if (wins['3d'] >= 10) {
        mode4x4x4Container.style.display = 'inline-block';
    }
    else {
        mode4x4x4Container.style.display = 'none';
        mode4x4x4Toggle.checked = false;
    }
}
function handleCellPlayed(clickedCell, clickedCellIndex) {
    board[clickedCellIndex] = currentPlayer;
    let piece = currentPlayer;
    if (useMonsterPieces) {
        if (isHardMode) {
            piece = (currentPlayer === 'X' ? '👾' : '👻');
        }
        else {
            piece = (currentPlayer === 'X' ? '🌸' : '🌼');
        }
    }
    clickedCell.innerText = piece;
    resetButton.style.visibility = 'visible';
}
function handleResultValidation() {
    const encouragingWinPhrases = [
        ' Nice going, champ!',
        ' You are on fire!',
        ' Unstoppable streak!',
        ' Incredible run!',
        ' Keep it up, legend!'
    ];
    const encouragingLossPhrases = [
        ' You have got this.',
        ' Shake it off, you will get the next one.',
        ' Tough round, but you are still in it.',
        ' Keep going, comebacks are the best.',
        ' Hang in there, better turns are coming.'
    ];
    const getRandomPhrase = (phrases) => {
        return phrases[Math.floor(Math.random() * phrases.length)];
    };
    const updateOutcomeStreak = (outcome) => {
        if (lastPlayerOutcome === outcome) {
            consecutivePlayerOutcomeCount++;
        }
        else {
            lastPlayerOutcome = outcome;
            consecutivePlayerOutcomeCount = 1;
        }
        const againSuffix = consecutivePlayerOutcomeCount > 1 ? ' again' : '';
        const streakPhrase = consecutivePlayerOutcomeCount >= 5
            ? getRandomPhrase(outcome === 'win' ? encouragingWinPhrases : encouragingLossPhrases)
            : '';
        return outcome === 'win'
            ? `You won${againSuffix}!${streakPhrase}`
            : `You lost${againSuffix}!${streakPhrase}`;
    };
    let winningLine = null;
    let currentWinningConditions = winningConditions2D;
    if (is4x4x4Mode) {
        currentWinningConditions = winningConditions4x4x4;
    }
    else if (is4x4Mode) {
        currentWinningConditions = winningConditions4x4;
    }
    else if (is3DMode) {
        currentWinningConditions = winningConditions3D;
    }
    for (let i = 0; i < currentWinningConditions.length; i++) {
        const winCondition = currentWinningConditions[i];
        const values = winCondition.map(idx => board[idx]);
        if (values.every(v => v !== null && v === values[0])) {
            winningLine = winCondition;
            break;
        }
    }
    if (winningLine) {
        highlightWinningLine(winningLine);
        if (isMisereMode) {
            statusDisplay.innerText = `Player ${currentPlayer} has lost (Misère)!`;
            lastPlayerOutcome = null;
            consecutivePlayerOutcomeCount = 0;
            if (currentPlayer === 'O') {
                recordWin();
                updateScores('X');
            }
            else {
                updateScores('O');
            }
        }
        else {
            statusDisplay.innerText = updateOutcomeStreak(currentPlayer === 'X' ? 'win' : 'loss');
            if (currentPlayer === 'X') {
                recordWin();
                updateScores('X');
                if (useMonsterPieces && !isHardMode) {
                    flowerLossCount = 0;
                    storageSet('flower_loss_count', '0');
                }
                if (isHardMode) {
                    hardModeWins++;
                    storageSet('hard_mode_wins', hardModeWins.toString());
                    renderMonsters();
                }
            }
            else {
                updateScores('O');
                if (useMonsterPieces && !isHardMode) {
                    flowerLossCount++;
                    storageSet('flower_loss_count', flowerLossCount.toString());
                    if (flowerLossCount >= 5) {
                        document.body.classList.add('meadow-wilted');
                        setTimeout(() => {
                            useMonsterPieces = false;
                            flowerLossCount = 0;
                            storageSet('use_monster_pieces', 'false');
                            storageSet('flower_loss_count', '0');
                            showMessage("You've lost too many times. The flowers have wilted... back to basics.");
                            document.body.classList.remove('meadow-wilted');
                            updateHardModeTheme();
                            // Refresh pieces immediately
                            cells.forEach((cell, idx) => {
                                if (board[idx] !== null) {
                                    cell.innerText = board[idx];
                                }
                            });
                        }, 2000);
                    }
                }
            }
        }
        gameActive = false;
        resetButton.innerText = "Play Again";
        return;
    }
    const roundDraw = !board.includes(null);
    if (roundDraw) {
        statusDisplay.innerText = "Game ended in a draw!";
        lastPlayerOutcome = null;
        consecutivePlayerOutcomeCount = 0;
        gameActive = false;
        resetButton.innerText = "Play Again";
        return;
    }
    handlePlayerChange();
}
function recordWin() {
    const currentMode = is4x4x4Mode ? '4x4x4'
        : is4x4Mode ? '4x4'
            : is3DMode ? '3d'
                : isMisereMode ? 'misere'
                    : 'default';
    if (currentMode !== '4x4x4') {
        wins[currentMode]++;
        storageSet(`wins_${currentMode}`, wins[currentMode].toString());
        updateUnlockStatus();
    }
}
function updateScores(winner) {
    const currentMode = is4x4x4Mode ? '4x4x4'
        : is4x4Mode ? '4x4'
            : is3DMode ? '3d'
                : isMisereMode ? 'misere'
                    : 'default';
    if (!gameScores[winner][currentMode]) {
        gameScores[winner][currentMode] = 0;
    }
    gameScores[winner][currentMode]++;
    storageSet(`score_${winner}_v2`, JSON.stringify(gameScores[winner]));
    renderScores();
}
function renderScores() {
    renderPlayerTally(scorePlayerContainer, gameScores['X']);
    renderPlayerTally(scoreComputerContainer, gameScores['O']);
}
function renderPlayerTally(container, scoresByMode) {
    container.innerHTML = '';
    const modes = ['default', 'misere', '4x4', '3d', '4x4x4'];
    modes.forEach(mode => {
        const score = scoresByMode[mode] || 0;
        if (score > 0) {
            renderTallyForMode(container, score, `mode-${mode}`);
        }
    });
}
function renderTallyForMode(container, score, modeClass) {
    const fullGroups = Math.floor(score / 5);
    const remainder = score % 5;
    for (let i = 0; i < fullGroups; i++) {
        const group = document.createElement('div');
        group.className = 'tally-group';
        for (let j = 0; j < 4; j++) {
            const mark = document.createElement('div');
            mark.className = `tally-mark ${modeClass}`;
            group.appendChild(mark);
        }
        const diagonal = document.createElement('div');
        diagonal.className = `tally-mark diagonal ${modeClass}`;
        group.appendChild(diagonal);
        container.appendChild(group);
    }
    if (remainder > 0) {
        const group = document.createElement('div');
        group.className = 'tally-group';
        for (let j = 0; j < remainder; j++) {
            const mark = document.createElement('div');
            mark.className = `tally-mark ${modeClass}`;
            group.appendChild(mark);
        }
        container.appendChild(group);
    }
}
function highlightWinningLine(line) {
    const size = (is4x4x4Mode || is4x4Mode) ? 4 : 3;
    // Helper to determine win type for 2D planes
    const getWinType = (indices) => {
        const coords = indices.map(idx => ({
            l: Math.floor(idx / (size * size)),
            r: Math.floor((idx % (size * size)) / size),
            c: idx % size
        }));
        const sameLayer = coords.every(v => v.l === coords[0].l);
        if (!sameLayer)
            return 'win-generic';
        const sameRow = coords.every(v => v.r === coords[0].r);
        if (sameRow)
            return 'win-horizontal';
        const sameCol = coords.every(v => v.c === coords[0].c);
        if (sameCol)
            return 'win-vertical';
        // Diagonals within a layer
        const isDiag1 = coords.every((v, i) => v.r === i && v.c === i);
        if (isDiag1)
            return 'win-diagonal-1';
        const isDiag2 = coords.every((v, i) => v.r === i && v.c === (size - 1 - i));
        if (isDiag2)
            return 'win-diagonal-2';
        return 'win-generic';
    };
    const winType = getWinType(line);
    line.forEach(index => {
        const cell = document.querySelector(`.cell[data-index="${index}"]`);
        if (cell) {
            cell.classList.add('winning-cell', winType);
        }
    });
}
function handlePlayerChange() {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusDisplay.innerText = currentPlayer === 'X' ? "Your turn" : "Computer's turn";
    if (currentPlayer === 'X' && gameActive) {
        startInactivityTimer();
    }
    else {
        stopInactivityTimer();
    }
}
function randomizeHardModePosition() {
    const corners = [
        { top: '10px', left: '10px', bottom: 'auto', right: 'auto' },
        { top: '10px', right: '10px', bottom: 'auto', left: 'auto' },
        { bottom: '10px', left: '10px', top: 'auto', right: 'auto' },
        { bottom: '10px', right: '10px', top: 'auto', left: 'auto' }
    ];
    const corner = corners[Math.floor(Math.random() * corners.length)];
    hardModeContainer.style.top = corner.top;
    hardModeContainer.style.bottom = corner.bottom;
    hardModeContainer.style.left = corner.left;
    hardModeContainer.style.right = corner.right;
}
function handleRestartGame() {
    gameActive = true;
    currentPlayer = "X";
    startInactivityTimer();
    randomizeHardModePosition();
    cells.forEach(cell => {
        cell.classList.remove('winning-cell', 'win-horizontal', 'win-vertical', 'win-diagonal-1', 'win-diagonal-2', 'win-generic');
    });
    resetButton.style.visibility = 'hidden';
    resetButton.innerText = "Reset Game";
    is4x4x4Mode = mode4x4x4Toggle.checked || (mode4x4Toggle.checked && mode3DToggle.checked);
    is4x4Mode = mode4x4Toggle.checked && !is4x4x4Mode;
    is3DMode = mode3DToggle.checked || is4x4x4Mode;
    isMisereMode = misereToggle.checked;
    isHardMode = hardModeToggle.checked;
    hardModeToggle.checked = isHardMode;
    renderScores();
    const size = (is4x4x4Mode || is4x4Mode) ? 4 : 3;
    const totalCells = is4x4x4Mode ? 64 : (is3DMode ? 27 : (is4x4Mode ? 16 : 9));
    board = Array(totalCells).fill(null);
    statusDisplay.innerText = currentPlayer === 'X' ? "Your turn" : "Computer's turn";
    // Re-generate board UI
    const layers = [
        document.getElementById('layer-0'),
        document.getElementById('layer-1'),
        document.getElementById('layer-2'),
        document.getElementById('layer-3')
    ];
    layers.forEach((layer, lIdx) => {
        layer.innerHTML = '';
        if (lIdx < (is4x4x4Mode ? 4 : (is3DMode ? 3 : 1))) {
            layer.classList.toggle('size-4', size === 4);
            for (let i = 0; i < size * size; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                const cellIndex = lIdx * size * size + i;
                cell.setAttribute('data-index', cellIndex.toString());
                cell.addEventListener('click', handleCellClick);
                layer.appendChild(cell);
            }
            layer.parentElement.style.display = 'block';
        }
        else {
            layer.parentElement.style.display = 'none';
        }
    });
    cells = document.querySelectorAll('.cell');
    // Update UI for 3D/2D
    if (is3DMode) {
        cube.classList.remove('mode-3d', 'mode-4x4x4');
        cube.classList.add(is4x4x4Mode ? 'mode-4x4x4' : 'mode-3d');
        controls3D.style.display = 'block';
        updateCubeRotation();
    }
    else {
        cube.classList.remove('mode-3d', 'mode-4x4x4');
        cube.style.transform = '';
        controls3D.style.display = 'none';
    }
    updateUnlockStatus();
    renderScores();
}
misereToggle.addEventListener('change', () => {
    isMisereMode = misereToggle.checked;
});
mode3DToggle.addEventListener('change', () => {
    if (mode3DToggle.checked && mode4x4Toggle.checked) {
        mode4x4x4Toggle.checked = true;
    }
    if (board.every(cell => cell === null)) {
        handleRestartGame();
    }
    else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        }
        else {
            mode3DToggle.checked = is3DMode;
        }
    }
});
mode4x4Toggle.addEventListener('change', () => {
    if (mode3DToggle.checked && mode4x4Toggle.checked) {
        mode4x4x4Toggle.checked = true;
    }
    if (board.every(cell => cell === null)) {
        handleRestartGame();
    }
    else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        }
        else {
            mode4x4Toggle.checked = is4x4Mode;
        }
    }
});
mode4x4x4Toggle.addEventListener('change', () => {
    if (mode4x4x4Toggle.checked) {
        mode4x4Toggle.checked = true;
        mode3DToggle.checked = true;
    }
    if (board.every(cell => cell === null)) {
        handleRestartGame();
    }
    else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        }
        else {
            mode4x4x4Toggle.checked = is4x4x4Mode;
        }
    }
});
hardModeToggle.addEventListener('change', () => {
    isHardMode = hardModeToggle.checked;
    storageSet('hard_mode', isHardMode.toString());
    updateHardModeTheme();
});
function updateHardModeTheme() {
    if (isHardMode) {
        document.body.classList.add('hard-mode-active');
        document.body.classList.remove('meadow-active');
        gameTitle.innerText = "Aaaaaaargh!!!";
        playerLabel.innerText = "Victim";
        renderMonsters();
        removeMeadow();
    }
    else {
        document.body.classList.remove('hard-mode-active');
        gameTitle.innerText = "Tic-Tac-Toe";
        playerLabel.innerText = "Player";
        removeMonsters();
        if (useMonsterPieces) {
            document.body.classList.add('meadow-active');
            renderMeadow();
        }
        else {
            document.body.classList.remove('meadow-active');
            removeMeadow();
        }
    }
    // Refresh board to update pieces if they changed (monster -> flower or vice versa)
    if (useMonsterPieces) {
        cells.forEach((cell, idx) => {
            if (board[idx] !== null) {
                cell.innerText = board[idx] === 'X'
                    ? (isHardMode ? '👾' : '🌸')
                    : (isHardMode ? '👻' : '🌼');
            }
        });
    }
}
const MONSTERS = ['👾', '👹', '👺', '👻', '👽', '💀', '🤡', '🧛', '🧟', '👁️', '🕸️', '🦂', '🐍', '🦇'];
function renderMonsters() {
    removeMonsters();
    if (!isHardMode)
        return;
    const clickableIndex = Math.floor(Math.random() * hardModeWins);
    // Add one monster for each hard mode win
    for (let i = 0; i < hardModeWins; i++) {
        const monster = document.createElement('div');
        monster.className = 'monster';
        monster.innerText = MONSTERS[i % MONSTERS.length];
        // Random position
        const top = Math.random() * 90 + 5;
        const left = Math.random() * 90 + 5;
        monster.style.top = `${top}%`;
        monster.style.left = `${left}%`;
        // Random delay for animation
        monster.style.animationDelay = `${Math.random() * 5}s`;
        if (i === clickableIndex) {
            monster.style.cursor = 'pointer';
            monster.style.pointerEvents = 'auto';
            monster.title = "Click me if you dare...";
            monster.addEventListener('click', (e) => {
                e.stopPropagation();
                useMonsterPieces = !useMonsterPieces;
                storageSet('use_monster_pieces', useMonsterPieces.toString());
                showMessage(useMonsterPieces ? (isHardMode ? "Monsters have taken over the game!" : "Flowers have bloomed in the garden!") : "The nightmare recedes... for now.");
                updateHardModeTheme();
                handleRestartGame();
            });
        }
        document.body.appendChild(monster);
    }
}
function removeMonsters() {
    const existingMonsters = document.querySelectorAll('.monster');
    existingMonsters.forEach(m => m.remove());
}
function clearMeadowEnvironmentClasses() {
    document.body.classList.remove(...meadowTimeClassNames, ...meadowWeatherClassNames);
    meadowSkyLayer.innerHTML = '';
    meadowWeatherLayer.innerHTML = '';
    removeSnowPiles();
}
function getDebugLocationCoordinates() {
    var _a;
    return (_a = debugWeatherLocations[debugWeatherLocation]) !== null && _a !== void 0 ? _a : null;
}
function twoDigit(value) {
    return value < 10 ? `0${value}` : value.toString();
}
function getTimeZoneDateParts(date, timeZone) {
    const formatted = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(date);
    const match = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4}),?\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (!match) {
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds()
        };
    }
    return {
        day: Number(match[1]),
        month: Number(match[2]),
        year: Number(match[3]),
        hour: Number(match[4]),
        minute: Number(match[5]),
        second: Number(match[6])
    };
}
function getTimeZoneOffsetMinutes(date, timeZone) {
    const parts = getTimeZoneDateParts(date, timeZone);
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return (localAsUtc - date.getTime()) / 60000;
}
function createDateFromTimeZoneParts(year, month, day, hour, minute, timeZone) {
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
    const offset = getTimeZoneOffsetMinutes(new Date(localAsUtc), timeZone);
    return new Date(localAsUtc - offset * 60000);
}
function getCurrentMeadowDate() {
    const debugLocation = getDebugLocationCoordinates();
    const date = new Date();
    if (debugMeadowTimeOverride) {
        const [hour, minute] = debugMeadowTimeOverride.split(':').map((part) => parseInt(part, 10));
        if (Number.isFinite(hour)) {
            if (debugLocation) {
                const locationParts = getTimeZoneDateParts(date, debugLocation.timeZone);
                return createDateFromTimeZoneParts(locationParts.year, locationParts.month, locationParts.day, hour, Number.isFinite(minute) ? minute : 0, debugLocation.timeZone);
            }
            date.setHours(hour, Number.isFinite(minute) ? minute : 0, 0, 0);
        }
    }
    return date;
}
function getMeadowLocalHour(date = getCurrentMeadowDate()) {
    const debugLocation = getDebugLocationCoordinates();
    if (!debugLocation) {
        return date.getHours();
    }
    return getTimeZoneDateParts(date, debugLocation.timeZone).hour;
}
function getMeadowTimeClass() {
    const hour = getMeadowLocalHour();
    if (hour >= 5 && hour < 9)
        return 'meadow-dawn';
    if (hour >= 9 && hour < 17)
        return 'meadow-day';
    if (hour >= 17 && hour < 21)
        return 'meadow-dusk';
    return 'meadow-night';
}
function createSeededRandom(seed) {
    let state = seed % 2147483647;
    if (state <= 0)
        state += 2147483646;
    return () => {
        state = (state * 16807) % 2147483647;
        return (state - 1) / 2147483646;
    };
}
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}
function radiansToDegrees(radians) {
    return radians * 180 / Math.PI;
}
function normalizeDegrees(degrees) {
    return ((degrees % 360) + 360) % 360;
}
function normalizeSignedDegrees(degrees) {
    const normalized = normalizeDegrees(degrees);
    return normalized > 180 ? normalized - 360 : normalized;
}
function getJulianDay(date) {
    return date.getTime() / 86400000 + 2440587.5;
}
function getAstronomyDays(date) {
    return getJulianDay(date) - 2451543.5;
}
function solveEccentricAnomaly(meanAnomalyDegrees, eccentricity) {
    const meanAnomaly = degreesToRadians(normalizeDegrees(meanAnomalyDegrees));
    let eccentricAnomaly = meanAnomaly + eccentricity * Math.sin(meanAnomaly) * (1 + eccentricity * Math.cos(meanAnomaly));
    for (let i = 0; i < 6; i++) {
        eccentricAnomaly -= (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(eccentricAnomaly));
    }
    return eccentricAnomaly;
}
function getObliquity(daysSinceEpoch) {
    return 23.4393 - 3.563e-7 * daysSinceEpoch;
}
function eclipticToEquatorial(x, y, z, daysSinceEpoch) {
    const obliquity = degreesToRadians(getObliquity(daysSinceEpoch));
    const equatorialX = x;
    const equatorialY = y * Math.cos(obliquity) - z * Math.sin(obliquity);
    const equatorialZ = y * Math.sin(obliquity) + z * Math.cos(obliquity);
    return {
        rightAscension: normalizeDegrees(radiansToDegrees(Math.atan2(equatorialY, equatorialX))),
        declination: radiansToDegrees(Math.atan2(equatorialZ, Math.sqrt(equatorialX * equatorialX + equatorialY * equatorialY))),
        distance: Math.sqrt(equatorialX * equatorialX + equatorialY * equatorialY + equatorialZ * equatorialZ)
    };
}
function getHeliocentricEcliptic(elements) {
    const eccentricAnomaly = solveEccentricAnomaly(elements.meanAnomaly, elements.eccentricity);
    const xv = elements.semiMajorAxis * (Math.cos(eccentricAnomaly) - elements.eccentricity);
    const yv = elements.semiMajorAxis * Math.sqrt(1 - elements.eccentricity * elements.eccentricity) * Math.sin(eccentricAnomaly);
    const trueAnomaly = Math.atan2(yv, xv);
    const radius = Math.sqrt(xv * xv + yv * yv);
    const node = degreesToRadians(elements.node);
    const inclination = degreesToRadians(elements.inclination);
    const perihelion = degreesToRadians(elements.perihelion);
    const argument = trueAnomaly + perihelion;
    return {
        x: radius * (Math.cos(node) * Math.cos(argument) - Math.sin(node) * Math.sin(argument) * Math.cos(inclination)),
        y: radius * (Math.sin(node) * Math.cos(argument) + Math.cos(node) * Math.sin(argument) * Math.cos(inclination)),
        z: radius * Math.sin(argument) * Math.sin(inclination),
        radius
    };
}
function getEarthHeliocentricEcliptic(daysSinceEpoch) {
    const sun = getSunEcliptic(daysSinceEpoch);
    return {
        x: -sun.x,
        y: -sun.y,
        z: 0
    };
}
function getSunEcliptic(daysSinceEpoch) {
    const perihelion = 282.9404 + 4.70935e-5 * daysSinceEpoch;
    const eccentricity = 0.016709 - 1.151e-9 * daysSinceEpoch;
    const meanAnomaly = 356.0470 + 0.9856002585 * daysSinceEpoch;
    const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, eccentricity);
    const xv = Math.cos(eccentricAnomaly) - eccentricity;
    const yv = Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(eccentricAnomaly);
    const trueAnomaly = radiansToDegrees(Math.atan2(yv, xv));
    const radius = Math.sqrt(xv * xv + yv * yv);
    const longitude = degreesToRadians(normalizeDegrees(trueAnomaly + perihelion));
    return {
        x: radius * Math.cos(longitude),
        y: radius * Math.sin(longitude),
        z: 0,
        longitude: normalizeDegrees(trueAnomaly + perihelion)
    };
}
function getSunEquatorial(date) {
    const daysSinceEpoch = getAstronomyDays(date);
    const sun = getSunEcliptic(daysSinceEpoch);
    return eclipticToEquatorial(sun.x, sun.y, sun.z, daysSinceEpoch);
}
function getMoonEquatorial(date) {
    const daysSinceEpoch = getAstronomyDays(date);
    const elements = {
        node: 125.1228 - 0.0529538083 * daysSinceEpoch,
        inclination: 5.1454,
        perihelion: 318.0634 + 0.1643573223 * daysSinceEpoch,
        semiMajorAxis: 60.2666,
        eccentricity: 0.054900,
        meanAnomaly: 115.3654 + 13.0649929509 * daysSinceEpoch
    };
    const moon = getHeliocentricEcliptic(elements);
    return eclipticToEquatorial(moon.x, moon.y, moon.z, daysSinceEpoch);
}
function getLocalSiderealTime(date, longitude) {
    const julianDay = getJulianDay(date);
    const daysSinceJ2000 = julianDay - 2451545.0;
    const centuriesSinceJ2000 = daysSinceJ2000 / 36525;
    return normalizeDegrees(280.46061837
        + 360.98564736629 * daysSinceJ2000
        + 0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000
        - centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000 / 38710000
        + longitude);
}
function equatorialToHorizontal(position, date, latitude, longitude) {
    const hourAngle = degreesToRadians(normalizeSignedDegrees(getLocalSiderealTime(date, longitude) - position.rightAscension));
    const latitudeRadians = degreesToRadians(latitude);
    const declination = degreesToRadians(position.declination);
    const sinAltitude = Math.sin(declination) * Math.sin(latitudeRadians)
        + Math.cos(declination) * Math.cos(latitudeRadians) * Math.cos(hourAngle);
    const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
    const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitudeRadians) - Math.tan(declination) * Math.cos(latitudeRadians));
    return {
        altitude: radiansToDegrees(altitude),
        azimuth: normalizeDegrees(radiansToDegrees(azimuth) + 180)
    };
}
function getSkyLayerPosition(position) {
    return {
        left: position.azimuth / 360 * 100,
        top: Math.max(3, Math.min(62, 58 - (position.altitude / 90) * 54))
    };
}
function getHorizontalScreenVector(from, to) {
    const azimuthDelta = normalizeSignedDegrees(to.azimuth - from.azimuth);
    return {
        x: azimuthDelta / 180,
        y: (from.altitude - to.altitude) / 90
    };
}
function getMoonRotationDegrees(moonPosition, sunPosition) {
    const vectorToSun = getHorizontalScreenVector(moonPosition, sunPosition);
    return radiansToDegrees(Math.atan2(vectorToSun.y, vectorToSun.x));
}
const planetDefinitions = [
    {
        name: 'Mercury',
        className: 'mercury',
        baseMagnitude: -0.4,
        size: 4,
        elements: (d) => ({
            node: 48.3313 + 3.24587e-5 * d,
            inclination: 7.0047 + 5.00e-8 * d,
            perihelion: 29.1241 + 1.01444e-5 * d,
            semiMajorAxis: 0.387098,
            eccentricity: 0.205635 + 5.59e-10 * d,
            meanAnomaly: 168.6562 + 4.0923344368 * d
        })
    },
    {
        name: 'Venus',
        className: 'venus',
        baseMagnitude: -4.0,
        size: 6,
        elements: (d) => ({
            node: 76.6799 + 2.46590e-5 * d,
            inclination: 3.3946 + 2.75e-8 * d,
            perihelion: 54.8910 + 1.38374e-5 * d,
            semiMajorAxis: 0.723330,
            eccentricity: 0.006773 - 1.302e-9 * d,
            meanAnomaly: 48.0052 + 1.6021302244 * d
        })
    },
    {
        name: 'Mars',
        className: 'mars',
        baseMagnitude: -1.2,
        size: 5,
        elements: (d) => ({
            node: 49.5574 + 2.11081e-5 * d,
            inclination: 1.8497 - 1.78e-8 * d,
            perihelion: 286.5016 + 2.92961e-5 * d,
            semiMajorAxis: 1.523688,
            eccentricity: 0.093405 + 2.516e-9 * d,
            meanAnomaly: 18.6021 + 0.5240207766 * d
        })
    },
    {
        name: 'Jupiter',
        className: 'jupiter',
        baseMagnitude: -2.2,
        size: 7,
        elements: (d) => ({
            node: 100.4542 + 2.76854e-5 * d,
            inclination: 1.3030 - 1.557e-7 * d,
            perihelion: 273.8777 + 1.64505e-5 * d,
            semiMajorAxis: 5.20256,
            eccentricity: 0.048498 + 4.469e-9 * d,
            meanAnomaly: 19.8950 + 0.0830853001 * d
        })
    },
    {
        name: 'Saturn',
        className: 'saturn',
        baseMagnitude: 0.4,
        size: 6,
        elements: (d) => ({
            node: 113.6634 + 2.38980e-5 * d,
            inclination: 2.4886 - 1.081e-7 * d,
            perihelion: 339.3939 + 2.97661e-5 * d,
            semiMajorAxis: 9.55475,
            eccentricity: 0.055546 - 9.499e-9 * d,
            meanAnomaly: 316.9670 + 0.0334442282 * d
        })
    }
];
function getPlanetEquatorial(date, planet) {
    const daysSinceEpoch = getAstronomyDays(date);
    const earth = getEarthHeliocentricEcliptic(daysSinceEpoch);
    const planetPosition = getHeliocentricEcliptic(planet.elements(daysSinceEpoch));
    return eclipticToEquatorial(planetPosition.x - earth.x, planetPosition.y - earth.y, planetPosition.z - earth.z, daysSinceEpoch);
}
function getPlanetVisibilityOpacity(baseMagnitude, sunAltitude) {
    if (sunAltitude < -10)
        return 0.95;
    if (baseMagnitude <= -3.5 && sunAltitude < 2)
        return 0.78;
    if (baseMagnitude <= -1.5 && sunAltitude < -4)
        return 0.82;
    return 0;
}
function getMoonPhaseClass(date) {
    const lunarAgeFraction = getLunarAgeFraction(date);
    const phaseIndex = Math.floor(lunarAgeFraction * 8 + 0.5) % 8;
    return [
        'phase-new',
        'phase-waxing-crescent',
        'phase-first-quarter',
        'phase-waxing-gibbous',
        'phase-full',
        'phase-waning-gibbous',
        'phase-last-quarter',
        'phase-waning-crescent'
    ][phaseIndex];
}
function getLunarAgeFraction(date) {
    const synodicMonth = 29.530588853;
    const knownNewMoonUtc = Date.UTC(2000, 0, 6, 18, 14);
    const daysSinceKnownNewMoon = (date.getTime() - knownNewMoonUtc) / 86400000;
    const lunarAge = ((daysSinceKnownNewMoon % synodicMonth) + synodicMonth) % synodicMonth;
    return lunarAge / synodicMonth;
}
function renderSun(position) {
    if (position.altitude < -4)
        return;
    const screenPosition = getSkyLayerPosition(position);
    const sun = document.createElement('div');
    sun.className = 'meadow-sun';
    sun.setAttribute('aria-hidden', 'true');
    sun.style.setProperty('--sun-left', `${screenPosition.left.toFixed(2)}vw`);
    sun.style.setProperty('--sun-top', `${screenPosition.top.toFixed(2)}vh`);
    sun.style.setProperty('--sun-opacity', `${Math.min(0.84, Math.max(0.26, (position.altitude + 4) / 24)).toFixed(2)}`);
    meadowSkyLayer.appendChild(sun);
}
function renderVisiblePlanets(date, latitude, longitude, sunPosition) {
    planetDefinitions.forEach((planet) => {
        const equatorial = getPlanetEquatorial(date, planet);
        const horizontal = equatorialToHorizontal(equatorial, date, latitude, longitude);
        if (horizontal.altitude < 4)
            return;
        const opacity = getPlanetVisibilityOpacity(planet.baseMagnitude, sunPosition.altitude);
        if (opacity <= 0)
            return;
        const screenPosition = getSkyLayerPosition(horizontal);
        const planetElement = document.createElement('span');
        planetElement.className = `meadow-planet ${planet.className}`;
        planetElement.setAttribute('aria-hidden', 'true');
        planetElement.title = planet.name;
        planetElement.style.setProperty('--planet-left', `${screenPosition.left.toFixed(2)}vw`);
        planetElement.style.setProperty('--planet-top', `${screenPosition.top.toFixed(2)}vh`);
        planetElement.style.setProperty('--planet-size', `${planet.size}px`);
        planetElement.style.setProperty('--planet-opacity', opacity.toFixed(2));
        meadowSkyLayer.appendChild(planetElement);
    });
}
function getSeasonIndex(date, latitude) {
    const month = date.getMonth();
    const northernSeason = Math.floor(((month + 1) % 12) / 3);
    return latitude < 0 ? (northernSeason + 2) % 4 : northernSeason;
}
function renderConstellation(latitude, date) {
    const season = getSeasonIndex(date, latitude);
    const isSouthern = latitude < -10;
    const constellations = isSouthern
        ? [
            [[70, 18], [73, 23], [76, 30], [69, 30], [76, 30]],
            [[18, 24], [21, 20], [25, 22], [28, 27], [24, 31], [21, 29]],
            [[58, 15], [62, 20], [66, 24], [69, 30]],
            [[36, 18], [40, 23], [44, 18], [48, 23], [52, 18]]
        ]
        : [
            [[64, 18], [68, 20], [72, 19], [76, 22], [80, 28], [75, 30], [70, 27]],
            [[18, 18], [22, 14], [26, 18], [24, 23], [19, 25]],
            [[44, 15], [48, 18], [52, 21], [56, 24], [60, 27]],
            [[30, 22], [34, 18], [39, 17], [43, 21], [41, 27], [35, 28]]
        ];
    const points = constellations[season];
    points.forEach(([left, top]) => {
        const star = document.createElement('span');
        star.className = 'meadow-star meadow-constellation-star';
        star.style.setProperty('--star-left', `${left}vw`);
        star.style.setProperty('--star-top', `${top}vh`);
        star.style.setProperty('--star-opacity', '0.95');
        star.style.setProperty('--star-twinkle', '5.5s');
        meadowSkyLayer.appendChild(star);
    });
}
function renderMeadowSky() {
    var _a, _b;
    meadowSkyLayer.innerHTML = '';
    const date = getCurrentMeadowDate();
    const location = getDebugLocationCoordinates();
    const latitude = (_a = location === null || location === void 0 ? void 0 : location.latitude) !== null && _a !== void 0 ? _a : 49.2827;
    const longitude = (_b = location === null || location === void 0 ? void 0 : location.longitude) !== null && _b !== void 0 ? _b : -123.1207;
    const isNight = document.body.classList.contains('meadow-night');
    const seed = Math.round((latitude + 90) * 1000 + (longitude + 180) * 10 + date.getMonth() * 101);
    const random = createSeededRandom(seed);
    const sunEquatorial = getSunEquatorial(date);
    const sunPosition = equatorialToHorizontal(sunEquatorial, date, latitude, longitude);
    const moonEquatorial = getMoonEquatorial(date);
    const moonPosition = equatorialToHorizontal(moonEquatorial, date, latitude, longitude);
    renderSun(sunPosition);
    if (isNight) {
        const starCount = Math.round(55 + Math.min(35, Math.abs(latitude) * 0.35));
        for (let i = 0; i < starCount; i++) {
            const star = document.createElement('span');
            star.className = 'meadow-star';
            star.style.setProperty('--star-left', `${(random() * 96 + 2).toFixed(2)}vw`);
            star.style.setProperty('--star-top', `${(random() * 43 + 4).toFixed(2)}vh`);
            star.style.setProperty('--star-size', `${(random() * 2 + 1).toFixed(1)}px`);
            star.style.setProperty('--star-opacity', `${(random() * 0.45 + 0.35).toFixed(2)}`);
            star.style.setProperty('--star-twinkle', `${(random() * 4 + 3).toFixed(2)}s`);
            meadowSkyLayer.appendChild(star);
        }
        renderConstellation(latitude, date);
    }
    renderVisiblePlanets(date, latitude, longitude, sunPosition);
    if (moonPosition.altitude < 0)
        return;
    const moon = document.createElement('div');
    moon.className = `meadow-moon ${getMoonPhaseClass(date)}`;
    moon.classList.toggle('daylight', !isNight);
    moon.setAttribute('aria-hidden', 'true');
    const moonScreenPosition = getSkyLayerPosition(moonPosition);
    moon.style.setProperty('--moon-left', `${moonScreenPosition.left.toFixed(2)}vw`);
    moon.style.setProperty('--moon-top', `${moonScreenPosition.top.toFixed(2)}vh`);
    moon.style.setProperty('--moon-rotation', `${getMoonRotationDegrees(moonPosition, sunPosition).toFixed(1)}deg`);
    meadowSkyLayer.appendChild(moon);
}
function updateMeadowTimeOfDay() {
    if (!document.body.classList.contains('meadow-active'))
        return;
    const wasNight = document.body.classList.contains('meadow-night');
    document.body.classList.remove(...meadowTimeClassNames);
    document.body.classList.add(getMeadowTimeClass());
    renderMeadowSky();
    syncNightCrickets();
    if (wasNight !== document.body.classList.contains('meadow-night')) {
        renderMeadowCreatures();
    }
    if (document.body.classList.contains('meadow-night') && (snailElement === null || snailElement === void 0 ? void 0 : snailElement.classList.contains('tortoise'))) {
        snailElement.remove();
        snailElement = null;
    }
}
function getWeatherClassForCode(weatherCode) {
    if ([0, 1].includes(weatherCode))
        return 'meadow-weather-clear';
    if ([2, 3].includes(weatherCode))
        return 'meadow-weather-cloudy';
    if ([45, 48].includes(weatherCode))
        return 'meadow-weather-fog';
    if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82))
        return 'meadow-weather-rain';
    if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86))
        return 'meadow-weather-snow';
    if (weatherCode >= 95 && weatherCode <= 99)
        return 'meadow-weather-storm';
    return 'meadow-weather-cloudy';
}
function applyMeadowWeather(weatherClass, isWindy) {
    if (!document.body.classList.contains('meadow-active'))
        return;
    activeMeadowWeatherClass = weatherClass;
    activeMeadowIsWindy = isWindy || debugForcedWindy;
    document.body.classList.remove(...meadowWeatherClassNames);
    document.body.classList.add(weatherClass);
    if (activeMeadowIsWindy) {
        document.body.classList.add('meadow-weather-windy');
    }
    renderWeatherEffects(weatherClass, activeMeadowIsWindy);
    if (weatherClass === 'meadow-weather-snow') {
        ensureSnowPiles();
    }
    else {
        removeSnowPiles();
    }
}
function addWeatherElement(className, styles) {
    const element = document.createElement('span');
    element.className = className;
    Object.keys(styles).forEach((property) => {
        element.style.setProperty(property, styles[property]);
    });
    meadowWeatherLayer.appendChild(element);
}
function renderWeatherEffects(weatherClass = activeMeadowWeatherClass, isWindy = activeMeadowIsWindy) {
    meadowWeatherLayer.innerHTML = '';
    const seed = weatherClass.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const random = createSeededRandom(seed + Math.round(Date.now() / 600000));
    const addClouds = ['meadow-weather-cloudy', 'meadow-weather-rain', 'meadow-weather-snow', 'meadow-weather-storm'].includes(weatherClass);
    if (addClouds) {
        const cloudCount = weatherClass === 'meadow-weather-cloudy' ? 7 : weatherClass === 'meadow-weather-snow' ? 3 : 5;
        for (let i = 0; i < cloudCount; i++) {
            addWeatherElement('weather-cloud', {
                '--cloud-top': `${Math.round(random() * 24 + 4)}vh`,
                '--cloud-width': `${Math.round(random() * 100 + 145)}px`,
                '--cloud-height': `${Math.round(random() * 28 + 42)}px`,
                '--cloud-opacity': `${(weatherClass === 'meadow-weather-storm' ? 0.82 : weatherClass === 'meadow-weather-snow' ? 0.3 : random() * 0.28 + 0.42).toFixed(2)}`,
                '--weather-speed': `${Math.round(random() * 28 + 36)}s`,
                '--weather-delay': `${Math.round(random() * -38)}s`
            });
        }
    }
    if (weatherClass === 'meadow-weather-rain' || weatherClass === 'meadow-weather-storm') {
        const dropCount = weatherClass === 'meadow-weather-storm' ? 130 : 90;
        for (let i = 0; i < dropCount; i++) {
            addWeatherElement('weather-drop', {
                '--weather-left': `${(random() * 118 - 8).toFixed(2)}vw`,
                '--weather-speed': `${(random() * 0.35 + (weatherClass === 'meadow-weather-storm' ? 0.32 : 0.58)).toFixed(2)}s`,
                '--weather-delay': `${(random() * -2.5).toFixed(2)}s`,
                '--rain-length': `${Math.round(random() * 26 + (weatherClass === 'meadow-weather-storm' ? 38 : 25))}px`
            });
        }
    }
    if (weatherClass === 'meadow-weather-snow') {
        for (let i = 0; i < 180; i++) {
            addWeatherElement('weather-flake', {
                '--weather-left': `${(random() * 108 - 4).toFixed(2)}vw`,
                '--weather-speed': `${(random() * 4.5 + 4.2).toFixed(2)}s`,
                '--weather-delay': `${(random() * -7).toFixed(2)}s`,
                '--flake-size': `${(random() * 7 + 4).toFixed(1)}px`,
                '--snow-drift': `${(random() * 24 - 12).toFixed(2)}vw`
            });
        }
    }
    if (weatherClass === 'meadow-weather-fog') {
        for (let i = 0; i < 4; i++) {
            addWeatherElement('weather-fog-bank', {
                top: `${Math.round(i * 10 + 18)}vh`,
                '--weather-speed': `${Math.round(random() * 8 + 10)}s`,
                '--weather-delay': `${Math.round(random() * -8)}s`
            });
        }
    }
    if (weatherClass === 'meadow-weather-storm') {
        for (let i = 0; i < 3; i++) {
            addWeatherElement('weather-lightning', {
                '--weather-left': `${Math.round(random() * 70 + 12)}vw`,
                '--weather-delay': `${(random() * -6).toFixed(2)}s`
            });
        }
    }
    if (isWindy) {
        for (let i = 0; i < 22; i++) {
            addWeatherElement('weather-leaf', {
                '--leaf-top': `${Math.round(random() * 42 + 36)}vh`,
                '--weather-speed': `${(random() * 2.2 + 2.4).toFixed(2)}s`,
                '--weather-delay': `${(random() * -4).toFixed(2)}s`
            });
        }
    }
}
function removeSnowClearSign() {
    if (snowClearSignElement) {
        snowClearSignElement.remove();
        snowClearSignElement = null;
    }
}
function removeSnowPiles() {
    if (snowRegrowTimer !== null) {
        clearTimeout(snowRegrowTimer);
        snowRegrowTimer = null;
    }
    removeSnowClearSign();
    document.querySelectorAll('.snow-pile').forEach((pile) => pile.remove());
}
function hasSnowPiles() {
    return document.querySelector('.snow-pile') !== null;
}
function ensureSnowClearSign() {
    if (snowClearSignElement || !hasSnowPiles() || moneySweeperElement)
        return;
    const sign = document.createElement('button');
    sign.className = 'snow-clear-sign';
    sign.type = 'button';
    sign.setAttribute('aria-label', 'Clear snow with the plow');
    const board = document.createElement('span');
    board.className = 'snow-clear-sign-board';
    board.textContent = '!';
    sign.appendChild(board);
    sign.addEventListener('click', () => {
        startSnowSweeper();
    });
    snowClearSignElement = sign;
    document.body.appendChild(sign);
}
function ensureSnowPiles() {
    if (!document.body.classList.contains('meadow-active'))
        return;
    if (snowRegrowTimer !== null) {
        clearTimeout(snowRegrowTimer);
        snowRegrowTimer = null;
    }
    if (hasSnowPiles()) {
        ensureSnowClearSign();
        return;
    }
    const random = createSeededRandom(Math.round(Date.now() / 600000) + 811);
    const pileCount = 16;
    for (let i = 0; i < pileCount; i++) {
        const pile = document.createElement('span');
        pile.className = 'snow-pile';
        pile.setAttribute('aria-hidden', 'true');
        pile.style.setProperty('--snow-pile-left', `${(i * (100 / (pileCount - 1)) + (random() * 4 - 2)).toFixed(2)}vw`);
        pile.style.setProperty('--snow-pile-bottom', `${Math.round(random() * 10)}px`);
        pile.style.setProperty('--snow-pile-width', `${Math.round(random() * 130 + 96)}px`);
        pile.style.setProperty('--snow-pile-height', `${Math.round(random() * 28 + 18)}px`);
        pile.style.animationDelay = `${(random() * 1.4).toFixed(2)}s`;
        document.body.appendChild(pile);
    }
    ensureSnowClearSign();
}
function scheduleSnowRegrowth() {
    if (snowRegrowTimer !== null) {
        clearTimeout(snowRegrowTimer);
    }
    snowRegrowTimer = window.setTimeout(() => {
        snowRegrowTimer = null;
        if (document.body.classList.contains('meadow-active')
            && activeMeadowWeatherClass === 'meadow-weather-snow'
            && !hasSnowPiles()
            && !moneySweeperElement) {
            ensureSnowPiles();
        }
    }, 2800);
}
function fetchAndApplyMeadowWeather(latitude, longitude, requestId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current=weather_code,wind_speed_10m&wind_speed_unit=mph`;
        try {
            const response = yield fetch(weatherUrl);
            if (requestId !== meadowWeatherRequestId)
                return;
            if (!response.ok)
                return;
            const data = yield response.json();
            if (requestId !== meadowWeatherRequestId)
                return;
            const weatherCode = Number((_b = (_a = data.current) === null || _a === void 0 ? void 0 : _a.weather_code) !== null && _b !== void 0 ? _b : (_c = data.current_weather) === null || _c === void 0 ? void 0 : _c.weathercode);
            if (!Number.isFinite(weatherCode))
                return;
            const windSpeed = Number((_g = (_e = (_d = data.current) === null || _d === void 0 ? void 0 : _d.wind_speed_10m) !== null && _e !== void 0 ? _e : (_f = data.current_weather) === null || _f === void 0 ? void 0 : _f.windspeed) !== null && _g !== void 0 ? _g : 0);
            applyMeadowWeather(getWeatherClassForCode(weatherCode), windSpeed >= 18);
        }
        catch (_h) {
            // Keep the time-based meadow if live weather is unavailable.
        }
    });
}
function requestMeadowWeather() {
    if (Date.now() - lastMeadowWeatherRequestAt < 15 * 60 * 1000)
        return;
    lastMeadowWeatherRequestAt = Date.now();
    meadowWeatherRequestId++;
    const requestId = meadowWeatherRequestId;
    if (debugForcedWeatherClass) {
        applyMeadowWeather(debugForcedWeatherClass, debugForcedWindy);
        return;
    }
    const debugLocation = debugWeatherLocations[debugWeatherLocation];
    if (debugLocation) {
        void fetchAndApplyMeadowWeather(debugLocation.latitude, debugLocation.longitude, requestId);
        return;
    }
    if (!navigator.geolocation)
        return;
    navigator.geolocation.getCurrentPosition((position) => __awaiter(this, void 0, void 0, function* () {
        if (!document.body.classList.contains('meadow-active'))
            return;
        if (requestId !== meadowWeatherRequestId)
            return;
        const { latitude, longitude } = position.coords;
        yield fetchAndApplyMeadowWeather(latitude, longitude, requestId);
    }), () => {
        if (requestId !== meadowWeatherRequestId)
            return;
        applyMeadowWeather('meadow-weather-clear', false);
    }, {
        maximumAge: 10 * 60 * 1000,
        timeout: 6000
    });
}
function startMeadowEnvironment() {
    updateMeadowTimeOfDay();
    requestMeadowWeather();
    if (meadowTimeInterval !== null) {
        clearInterval(meadowTimeInterval);
    }
    meadowTimeInterval = window.setInterval(updateMeadowTimeOfDay, 5 * 60 * 1000);
}
function stopMeadowEnvironment() {
    if (meadowTimeInterval !== null) {
        clearInterval(meadowTimeInterval);
        meadowTimeInterval = null;
    }
    stopNightCrickets();
    clearMeadowEnvironmentClasses();
}
function isMeadowNight() {
    return document.body.classList.contains('meadow-active') && document.body.classList.contains('meadow-night');
}
function getCricketAudioContext() {
    var _a;
    if (cricketAudioContext)
        return cricketAudioContext;
    const audioWindow = window;
    const AudioContextConstructor = (_a = window.AudioContext) !== null && _a !== void 0 ? _a : audioWindow.webkitAudioContext;
    if (!AudioContextConstructor)
        return null;
    cricketAudioContext = new AudioContextConstructor();
    return cricketAudioContext;
}
function playCricketChirp() {
    if (!hasUserInteracted || !isMeadowNight() || document.hidden)
        return;
    const audioContext = getCricketAudioContext();
    if (!audioContext)
        return;
    const chirp = (delay, frequency) => {
        const startTime = audioContext.currentTime + delay;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.022, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.095);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.11);
    };
    if (audioContext.state === 'suspended') {
        void audioContext.resume().then(() => {
            if (isMeadowNight()) {
                playCricketChirp();
            }
        });
        return;
    }
    const frequency = 3200 + Math.random() * 900;
    chirp(0, frequency);
    chirp(0.16, frequency * 0.96);
    chirp(0.33, frequency * 1.03);
}
function startNightCrickets() {
    if (cricketInterval !== null)
        return;
    cricketInterval = window.setInterval(playCricketChirp, 3600);
    playCricketChirp();
}
function stopNightCrickets() {
    if (cricketInterval !== null) {
        clearInterval(cricketInterval);
        cricketInterval = null;
    }
}
function syncNightCrickets() {
    if (isMeadowNight()) {
        startNightCrickets();
    }
    else {
        stopNightCrickets();
    }
}
function removeMeadowCreatures() {
    document.querySelectorAll('.bee, .bird, .moth, .sleeping-bee, .cryptid, .raccoon').forEach((creature) => creature.remove());
}
function renderCryptid() {
    const cryptid = document.createElement('div');
    cryptid.className = 'cryptid';
    cryptid.setAttribute('aria-hidden', 'true');
    const head = document.createElement('div');
    head.className = 'cryptid-head';
    const body = document.createElement('div');
    body.className = 'cryptid-body';
    const leftLeg = document.createElement('div');
    leftLeg.className = 'cryptid-leg left';
    const rightLeg = document.createElement('div');
    rightLeg.className = 'cryptid-leg right';
    cryptid.append(head, body, leftLeg, rightLeg);
    document.body.appendChild(cryptid);
    window.setTimeout(() => cryptid.remove(), 33000);
}
function renderRaccoon() {
    const raccoon = document.createElement('div');
    raccoon.className = 'raccoon';
    raccoon.setAttribute('aria-hidden', 'true');
    const tail = document.createElement('div');
    tail.className = 'raccoon-tail';
    const body = document.createElement('div');
    body.className = 'raccoon-body';
    const head = document.createElement('div');
    head.className = 'raccoon-head';
    const leftEar = document.createElement('div');
    leftEar.className = 'raccoon-ear left';
    const rightEar = document.createElement('div');
    rightEar.className = 'raccoon-ear right';
    const frontLeg = document.createElement('div');
    frontLeg.className = 'raccoon-leg front';
    const backLeg = document.createElement('div');
    backLeg.className = 'raccoon-leg back';
    head.append(leftEar, rightEar);
    raccoon.append(tail, body, head, frontLeg, backLeg);
    document.body.appendChild(raccoon);
}
function renderNightMeadowCreatures() {
    for (let i = 0; i < 5; i++) {
        const moth = document.createElement('div');
        moth.className = 'moth';
        moth.innerText = '⊰';
        moth.style.setProperty('--moth-delay', `${(Math.random() * -9).toFixed(2)}s`);
        moth.style.setProperty('--moth-speed', `${(Math.random() * 5 + 8).toFixed(2)}s`);
        moth.style.top = `${Math.random() * 42 + 8}vh`;
        moth.style.left = '-8vw';
        document.body.appendChild(moth);
    }
    for (let i = 0; i < 3; i++) {
        const sleepingBee = document.createElement('div');
        sleepingBee.className = 'sleeping-bee';
        sleepingBee.innerText = '🐝';
        sleepingBee.style.setProperty('--sleeping-bee-left', `${Math.round(Math.random() * 55 + 8)}vw`);
        sleepingBee.style.setProperty('--sleeping-bee-bottom', `${Math.round(Math.random() * 34 + 46)}px`);
        document.body.appendChild(sleepingBee);
    }
    const owl = document.createElement('div');
    owl.className = 'bird nocturnal';
    owl.innerHTML = '🦉';
    owl.style.animationDelay = `${Math.random() * 4}s`;
    owl.style.left = '105vw';
    owl.style.top = '8vh';
    document.body.appendChild(owl);
    renderRaccoon();
    if (Math.random() > 0.35) {
        window.setTimeout(() => {
            if (document.body.classList.contains('meadow-active') && document.body.classList.contains('meadow-night')) {
                renderCryptid();
            }
        }, Math.random() * 6000 + 1200);
    }
}
function renderDayMeadowCreatures() {
    for (let i = 0; i < 3; i++) {
        const bee = document.createElement('div');
        bee.className = 'bee';
        bee.innerText = '🐝';
        bee.style.animationDelay = `${Math.random() * 10}s`;
        bee.style.top = `${Math.random() * 50 + 10}vh`;
        bee.style.left = '-5vw';
        document.body.appendChild(bee);
        if (Math.random() > 0.5) {
            setTimeout(() => {
                if (!document.body.classList.contains('meadow-active') || document.body.classList.contains('meadow-night'))
                    return;
                const flowers = document.querySelectorAll('.cell');
                const randomFlower = flowers[Math.floor(Math.random() * flowers.length)];
                if (randomFlower) {
                    const rect = randomFlower.getBoundingClientRect();
                    bee.classList.add('landed');
                    bee.style.top = `${rect.top}px`;
                    bee.style.left = `${rect.left}px`;
                    setTimeout(() => {
                        bee.classList.remove('landed');
                    }, 3000);
                }
            }, Math.random() * 5000 + 2000);
        }
    }
    const bird = document.createElement('div');
    bird.className = 'bird';
    bird.innerHTML = '🕊️<span class="wing"></span>';
    bird.style.animationDelay = `${Math.random() * 5}s`;
    bird.style.left = '105vw';
    bird.style.top = '10vh';
    document.body.appendChild(bird);
    if (Math.random() > 0.3) {
        setTimeout(() => {
            if (!document.body.classList.contains('meadow-active') || document.body.classList.contains('meadow-night'))
                return;
            const targets = document.querySelectorAll('.score-container, button');
            const target = targets[Math.floor(Math.random() * targets.length)];
            if (target) {
                const rect = target.getBoundingClientRect();
                bird.classList.add('landed');
                bird.style.top = `${rect.top - 20}px`;
                bird.style.left = `${rect.left + rect.width / 2}px`;
                setTimeout(() => {
                    bird.classList.remove('landed');
                }, 4000);
            }
        }, Math.random() * 10000 + 5000);
    }
}
function renderMeadowCreatures() {
    removeMeadowCreatures();
    if (!document.body.classList.contains('meadow-active'))
        return;
    if (document.body.classList.contains('meadow-night')) {
        renderNightMeadowCreatures();
    }
    else {
        renderDayMeadowCreatures();
    }
}
function renderMeadow() {
    removeMeadow();
    if (isHardMode || !useMonsterPieces)
        return;
    startMeadowEnvironment();
    renderMeadowCreatures();
    // Add grass blades at the bottom
    for (let i = 0; i < 50; i++) {
        const blade = document.createElement('div');
        blade.className = 'grass-blade';
        blade.style.left = `${i * 2}vw`;
        blade.style.height = `${Math.random() * 75 + 50}px`;
        blade.style.animationDelay = `${Math.random() * 3}s`;
        document.body.appendChild(blade);
    }
}
function removeMeadow() {
    stopInactivityTimer();
    stopMeadowEnvironment();
    const elements = document.querySelectorAll('.bee, .bird, .moth, .sleeping-bee, .cryptid, .raccoon, .grass-blade, .snail-traversal, .tree');
    // We don't remove them immediately to allow the CSS transition to finish
    // Instead, we remove them after a delay
    setTimeout(() => {
        // Only remove if meadow is still inactive
        if (!document.body.classList.contains('meadow-active')) {
            elements.forEach(el => el.remove());
        }
    }, 1000);
}
// Rotation controls
document.getElementById('rotate-up').addEventListener('click', () => { rotationX += 10; updateCubeRotation(); });
document.getElementById('rotate-down').addEventListener('click', () => { rotationX -= 10; updateCubeRotation(); });
document.getElementById('rotate-left').addEventListener('click', () => { rotationY -= 10; updateCubeRotation(); });
document.getElementById('rotate-right').addEventListener('click', () => { rotationY += 10; updateCubeRotation(); });
window.addEventListener('keydown', (e) => {
    if (!is3DMode)
        return;
    if (e.key === 'ArrowUp')
        rotationX += 10;
    if (e.key === 'ArrowDown')
        rotationX -= 10;
    if (e.key === 'ArrowLeft')
        rotationY -= 10;
    if (e.key === 'ArrowRight')
        rotationY += 10;
    updateCubeRotation();
});
cells.forEach(cell => cell.addEventListener('click', handleCellClick));
function handleResetScores() {
    if (confirm("This will reset all your progress and scores. Are you sure?")) {
        stopInactivityTimer();
        // Reset wins (unlocks)
        Object.keys(wins).forEach(key => {
            wins[key] = 0;
            storageSet(`wins_${key}`, '0');
        });
        // Reset game scores
        Object.keys(gameScores).forEach(key => {
            gameScores[key] = {};
            storageSet(`score_${key}_v2`, '{}');
            localStorage.removeItem(`score_${key}`); // Also clear old format
        });
        hardModeWins = 0;
        storageSet('hard_mode_wins', '0');
        flowerLossCount = 0;
        storageSet('flower_loss_count', '0');
        removeMonsters();
        removeMeadow();
        updateUnlockStatus();
        renderScores();
        handleRestartGame();
    }
}
resetButton.addEventListener('click', handleRestartGame);
resetScoresButton.addEventListener('click', handleResetScores);
function createSlowCreatureElement(allowTortoise = true) {
    const creature = document.createElement('div');
    creature.className = 'snail-traversal';
    const isTortoise = allowTortoise && Math.random() > 0.5;
    creature.classList.toggle('tortoise', isTortoise);
    creature.classList.toggle('snail', !isTortoise);
    creature.setAttribute('aria-hidden', 'true');
    if (isTortoise) {
        const body = document.createElement('div');
        body.className = 'tortoise-body';
        const shell = document.createElement('div');
        shell.className = 'tortoise-shell';
        const head = document.createElement('div');
        head.className = 'tortoise-head';
        const frontLeg = document.createElement('div');
        frontLeg.className = 'tortoise-leg front';
        const backLeg = document.createElement('div');
        backLeg.className = 'tortoise-leg back';
        const tail = document.createElement('div');
        tail.className = 'tortoise-tail';
        creature.append(body, shell, head, frontLeg, backLeg, tail);
    }
    else {
        const body = document.createElement('div');
        body.className = 'snail-body';
        const head = document.createElement('div');
        head.className = 'snail-head';
        const shell = document.createElement('div');
        shell.className = 'snail-shell';
        const eyeOne = document.createElement('div');
        eyeOne.className = 'snail-eye one';
        const eyeTwo = document.createElement('div');
        eyeTwo.className = 'snail-eye two';
        creature.append(body, head, shell, eyeOne, eyeTwo);
    }
    return creature;
}
function spawnSlowCreature() {
    if (!snailElement) {
        snailElement = createSlowCreatureElement(!isMeadowNight());
        document.body.appendChild(snailElement);
    }
    if (isMeadowNight() && snailElement.classList.contains('tortoise')) {
        snailElement.remove();
        snailElement = createSlowCreatureElement(false);
        document.body.appendChild(snailElement);
    }
    snailElement.getBoundingClientRect();
    snailElement.style.left = '-220px';
}
function startInactivityTimer() {
    stopInactivityTimer();
    if (!gameActive || currentPlayer === 'O')
        return;
    inactivityTimer = window.setTimeout(() => {
        spawnSlowCreature();
        // Remove after traversal
        setTimeout(() => {
            if (snailElement) {
                snailElement.remove();
                snailElement = null;
            }
        }, 10000);
    }, 10000);
    treeTimer = window.setTimeout(() => {
        renderTree();
    }, 60000);
}
function renderTree() {
    if (treeElement || !document.body.classList.contains('meadow-active'))
        return;
    treeElement = document.createElement('div');
    treeElement.className = 'tree';
    const trunk = document.createElement('div');
    trunk.className = 'tree-trunk';
    const fruits = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥭', '🥝', '🍅', '🍆', '🌽', '🥕', '🥔', '🥦', '🥬', '🥒', '🥑'];
    const getRandomFruit = () => fruits[Math.floor(Math.random() * fruits.length)];
    const areAllTreeFruitsMatching = () => {
        const fruitElements = treeElement === null || treeElement === void 0 ? void 0 : treeElement.querySelectorAll('.tree-foliage span');
        if (!fruitElements || fruitElements.length < 2)
            return false;
        const firstFruit = fruitElements[0].innerText;
        if (!firstFruit)
            return false;
        return Array.from(fruitElements).every((fruitEl) => {
            return fruitEl.innerText === firstFruit;
        });
    };
    const stopMoneyRain = () => {
        if (moneyRainInterval !== null) {
            clearInterval(moneyRainInterval);
            moneyRainInterval = null;
        }
    };
    const spawnMoneyDrop = () => {
        if (!document.body.classList.contains('meadow-active')) {
            stopMoneyRain();
            return;
        }
        const moneyPieces = document.querySelectorAll('.money-drop');
        if (moneyPieces.length >= maxMoneyPile)
            return;
        const money = document.createElement('div');
        money.className = 'money-drop';
        money.innerText = Math.random() > 0.4 ? '💸' : '💵';
        money.style.left = `${Math.random() * 100}vw`;
        money.style.setProperty('--fall-duration', `${(Math.random() * 1.8 + 1.8).toFixed(2)}s`);
        money.style.setProperty('--money-drift', `${Math.round((Math.random() - 0.5) * 40)}px`);
        money.style.setProperty('--money-ground-offset', `${Math.round(Math.random() * 40 + 65)}px`);
        money.addEventListener('animationend', () => {
            money.classList.add('piled');
            money.style.setProperty('--pile-left', `${Math.min(98, Math.max(2, parseFloat(money.style.left) + (Math.random() - 0.5) * 2))}vw`);
            money.style.setProperty('--pile-bottom', `${Math.round(Math.random() * 38)}px`);
            money.style.setProperty('--pile-tilt', `${Math.round((Math.random() - 0.5) * 24)}deg`);
        }, { once: true });
        document.body.appendChild(money);
    };
    const startMoneyRain = () => {
        if (moneyRainInterval !== null)
            return;
        moneyRainInterval = window.setInterval(() => {
            if (!areAllTreeFruitsMatching()) {
                stopMoneyRain();
                return;
            }
            spawnMoneyDrop();
        }, 220);
    };
    const updateMoneyRainState = () => {
        if (areAllTreeFruitsMatching()) {
            startMoneyRain();
        }
        else {
            stopMoneyRain();
        }
    };
    const createFruitElement = (parent) => {
        const fruit = document.createElement('span');
        fruit.innerText = getRandomFruit();
        updateMoneyRainState();
        fruit.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fruit.classList.contains('eating'))
                return;
            fruit.classList.add('eating');
            showMessage("Crunch! *Munch* *Munch*");
            setTimeout(() => {
                fruit.innerText = getRandomFruit();
                fruit.classList.remove('eating');
                fruit.classList.add('growing-fruit');
                updateMoneyRainState();
                setTimeout(() => {
                    fruit.classList.remove('growing-fruit');
                }, 2000);
            }, 1000);
        });
        parent.appendChild(fruit);
    };
    const createBranch = (className, top, left, hasNest = false) => {
        const branch = document.createElement('div');
        branch.className = className;
        branch.style.top = top;
        if (className.includes('left')) {
            branch.style.right = left;
        }
        else {
            branch.style.left = left;
        }
        const foliage = document.createElement('div');
        foliage.className = 'tree-foliage';
        createFruitElement(foliage);
        branch.appendChild(foliage);
        if (hasNest) {
            const nest = document.createElement('div');
            nest.className = 'tree-nest';
            nest.setAttribute('aria-hidden', 'true');
            nest.append(document.createElement('span'), document.createElement('span'));
            branch.appendChild(nest);
        }
        trunk.appendChild(branch);
    };
    // Main foliage
    const mainFoliage = document.createElement('div');
    mainFoliage.className = 'tree-foliage main';
    createFruitElement(mainFoliage);
    trunk.appendChild(mainFoliage);
    // Branches
    createBranch('tree-branch left upper', '74px', '27px');
    createBranch('tree-branch right upper', '122px', '28px', true);
    createBranch('tree-branch left lower', '182px', '26px');
    createBranch('tree-branch right lower', '234px', '29px');
    treeElement.appendChild(trunk);
    // Position to left or right of scoreboard
    const side = Math.random() > 0.5 ? 'left' : 'right';
    const treeLeftOverhangPx = 80;
    const treeRightOverhangPx = 285;
    const minTrunkLeftPx = treeLeftOverhangPx;
    const maxTrunkLeftPx = window.innerWidth - treeRightOverhangPx;
    const targetTrunkLeftPx = side === 'left'
        ? window.innerWidth * 0.08
        : (window.innerWidth * 0.92) - 45;
    const clampedTrunkLeftPx = maxTrunkLeftPx < minTrunkLeftPx
        ? Math.max(0, (window.innerWidth - 45) / 2)
        : Math.min(maxTrunkLeftPx, Math.max(minTrunkLeftPx, targetTrunkLeftPx));
    treeElement.style.left = `${clampedTrunkLeftPx}px`;
    document.body.appendChild(treeElement);
    updateMoneyRainState();
    // Trigger growth
    setTimeout(() => {
        if (treeElement) {
            treeElement.classList.add('growing');
        }
    }, 100);
}
function removeMoneyCleanupPrompt() {
    if (moneyCleanupPromptElement) {
        moneyCleanupPromptElement.remove();
        moneyCleanupPromptElement = null;
    }
}
function removeMoneySweeper() {
    if (moneySweepFrame !== null) {
        cancelAnimationFrame(moneySweepFrame);
        moneySweepFrame = null;
    }
    if (moneySweeperElement) {
        moneySweeperElement.remove();
        moneySweeperElement = null;
    }
    if (hasSnowPiles()) {
        ensureSnowClearSign();
    }
}
function hasMoneyDrops() {
    return document.querySelector('.money-drop') !== null;
}
function showMoneyCleanupPrompt() {
    if (!hasMoneyDrops() || moneyCleanupPromptElement || moneySweeperElement)
        return;
    const prompt = document.createElement('button');
    prompt.className = 'money-cleanup-z';
    prompt.type = 'button';
    prompt.textContent = 'Z';
    prompt.setAttribute('aria-label', 'Clear the money');
    const maxLeft = Math.max(0, window.innerWidth - 55);
    const maxTop = Math.max(0, window.innerHeight - 170);
    prompt.style.left = `${Math.round(Math.random() * maxLeft)}px`;
    prompt.style.top = `${Math.round(Math.random() * maxTop)}px`;
    prompt.addEventListener('click', () => {
        startMoneySweeper();
    });
    moneyCleanupPromptElement = prompt;
    document.body.appendChild(prompt);
}
function startGroundSweeper(mode) {
    if (moneySweeperElement)
        return;
    if (mode === 'money') {
        removeMoneyCleanupPrompt();
    }
    else {
        removeSnowClearSign();
    }
    const sweeper = document.createElement('div');
    sweeper.className = mode === 'snow' ? 'money-sweeper snow-sweeper' : 'money-sweeper';
    sweeper.setAttribute('aria-hidden', 'true');
    const cab = document.createElement('div');
    cab.className = 'money-sweeper-cab';
    const body = document.createElement('div');
    body.className = 'money-sweeper-body';
    const plow = document.createElement('div');
    plow.className = 'money-sweeper-plow';
    const frontWheel = document.createElement('div');
    frontWheel.className = 'money-sweeper-wheel front';
    const backWheel = document.createElement('div');
    backWheel.className = 'money-sweeper-wheel back';
    sweeper.append(cab, body, plow, frontWheel, backWheel);
    document.body.appendChild(sweeper);
    moneySweeperElement = sweeper;
    const targetSelector = mode === 'snow' ? '.snow-pile' : '.money-drop';
    const clearTouchedItems = () => {
        const plowRect = plow.getBoundingClientRect();
        document.querySelectorAll(targetSelector).forEach((item) => {
            const itemRect = item.getBoundingClientRect();
            const isTouched = itemRect.left < plowRect.right
                && itemRect.right > plowRect.left
                && itemRect.top < plowRect.bottom
                && itemRect.bottom > plowRect.top;
            if (isTouched) {
                item.remove();
            }
        });
        if (moneySweeperElement) {
            moneySweepFrame = requestAnimationFrame(clearTouchedItems);
        }
    };
    moneySweepFrame = requestAnimationFrame(clearTouchedItems);
    sweeper.addEventListener('animationend', () => {
        document.querySelectorAll(targetSelector).forEach((item) => item.remove());
        removeMoneySweeper();
        if (mode === 'snow' && activeMeadowWeatherClass === 'meadow-weather-snow') {
            scheduleSnowRegrowth();
        }
    }, { once: true });
}
function startMoneySweeper() {
    startGroundSweeper('money');
}
function startSnowSweeper() {
    startGroundSweeper('snow');
}
function stopInactivityTimer() {
    const hadTree = treeElement !== null;
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
    if (treeTimer) {
        clearTimeout(treeTimer);
        treeTimer = null;
    }
    if (snailElement) {
        snailElement.remove();
        snailElement = null;
    }
    if (treeElement) {
        treeElement.remove();
        treeElement = null;
    }
    if (moneyRainInterval !== null) {
        clearInterval(moneyRainInterval);
        moneyRainInterval = null;
    }
    if (hadTree) {
        showMoneyCleanupPrompt();
    }
}
function resetInactivityTimer() {
    stopInactivityTimer();
    startInactivityTimer();
}
function isLocalhost() {
    return ['localhost', '127.0.0.1', '::1', ''].includes(window.location.hostname);
}
function createDebugMoneyPile() {
    document.querySelectorAll('.money-drop.debug-money').forEach((money) => money.remove());
    for (let i = 0; i < 28; i++) {
        const money = document.createElement('div');
        money.className = 'money-drop piled debug-money';
        money.innerText = Math.random() > 0.4 ? '💸' : '💵';
        money.style.setProperty('--pile-left', `${Math.round(Math.random() * 92 + 3)}vw`);
        money.style.setProperty('--pile-bottom', `${Math.round(Math.random() * 44)}px`);
        money.style.setProperty('--pile-tilt', `${Math.round((Math.random() - 0.5) * 28)}deg`);
        document.body.appendChild(money);
    }
}
function removeDebugMoneyPile() {
    document.querySelectorAll('.money-drop.debug-money').forEach((money) => money.remove());
}
function applyDebugModeToggles() {
    misereToggle.checked = debugMisereToggle.checked;
    mode4x4Toggle.checked = debug4x4Toggle.checked;
    mode3DToggle.checked = debug3DToggle.checked;
    mode4x4x4Toggle.checked = debug4x4x4Toggle.checked;
    hardModeToggle.checked = debugHardModeToggle.checked;
    isHardMode = debugHardModeToggle.checked;
    storageSet('hard_mode', isHardMode.toString());
    updateHardModeTheme();
    handleRestartGame();
}
function applyDebugMeadowToggle() {
    useMonsterPieces = debugMeadowToggle.checked;
    storageSet('use_monster_pieces', useMonsterPieces.toString());
    updateHardModeTheme();
}
function applyDebugMonsterToggle() {
    if (debugMonstersToggle.checked) {
        if (!isHardMode) {
            debugHardModeToggle.checked = true;
            hardModeToggle.checked = true;
            isHardMode = true;
            storageSet('hard_mode', 'true');
            updateHardModeTheme();
        }
        renderMonsters();
    }
    else {
        removeMonsters();
    }
}
function applyDebugTreeToggle() {
    if (debugTreeToggle.checked) {
        document.body.classList.add('meadow-active');
        startMeadowEnvironment();
        renderTree();
    }
    else if (treeElement) {
        treeElement.remove();
        treeElement = null;
    }
}
function applyDebugCreatureToggle() {
    if (debugCreatureToggle.checked) {
        spawnSlowCreature();
    }
    else if (snailElement) {
        snailElement.remove();
        snailElement = null;
    }
}
function applyDebugEnvironmentOverrides() {
    if (!document.body.classList.contains('meadow-active')) {
        debugHardModeToggle.checked = false;
        hardModeToggle.checked = false;
        isHardMode = false;
        storageSet('hard_mode', 'false');
        debugMeadowToggle.checked = true;
        useMonsterPieces = true;
        storageSet('use_monster_pieces', 'true');
        updateHardModeTheme();
    }
    debugWeatherLocation = debugLocationSelect.value;
    debugMeadowTimeOverride = debugSystemTimeToggle.checked || !debugMeadowTimeInput.value ? null : debugMeadowTimeInput.value;
    lastMeadowWeatherRequestAt = 0;
    updateMeadowTimeOfDay();
    requestMeadowWeather();
}
function applyDebugWeatherEffectToggle(changedInput) {
    var _a;
    if (changedInput === null || changedInput === void 0 ? void 0 : changedInput.checked) {
        debugWeatherEffectToggles.forEach(({ input }) => {
            if (input !== changedInput) {
                input.checked = false;
            }
        });
    }
    const selectedWeather = debugWeatherEffectToggles.find(({ input }) => input.checked);
    debugForcedWeatherClass = (_a = selectedWeather === null || selectedWeather === void 0 ? void 0 : selectedWeather.weatherClass) !== null && _a !== void 0 ? _a : null;
    debugForcedWindy = debugWeatherWindyToggle.checked;
    lastMeadowWeatherRequestAt = 0;
    applyDebugEnvironmentOverrides();
}
function setupDebugPanel() {
    if (!isLocalhost())
        return;
    debugPanel.style.display = 'block';
    const now = new Date();
    debugMeadowTimeInput.value = `${twoDigit(now.getHours())}:${twoDigit(now.getMinutes())}`;
    debugMeadowTimeInput.disabled = true;
    debugMisereToggle.checked = misereToggle.checked;
    debug4x4Toggle.checked = mode4x4Toggle.checked;
    debug3DToggle.checked = mode3DToggle.checked;
    debug4x4x4Toggle.checked = mode4x4x4Toggle.checked;
    debugHardModeToggle.checked = hardModeToggle.checked;
    debugMeadowToggle.checked = useMonsterPieces && !isHardMode;
    [debugMisereToggle, debug4x4Toggle, debug3DToggle, debug4x4x4Toggle, debugHardModeToggle].forEach((toggle) => {
        toggle.addEventListener('change', applyDebugModeToggles);
    });
    debugMeadowToggle.addEventListener('change', applyDebugMeadowToggle);
    debugMonstersToggle.addEventListener('change', applyDebugMonsterToggle);
    debugTreeToggle.addEventListener('change', applyDebugTreeToggle);
    debugMoneyToggle.addEventListener('change', () => {
        if (debugMoneyToggle.checked) {
            createDebugMoneyPile();
        }
        else {
            removeDebugMoneyPile();
        }
    });
    debugCreatureToggle.addEventListener('change', applyDebugCreatureToggle);
    debugLocationSelect.addEventListener('change', applyDebugEnvironmentOverrides);
    debugMeadowTimeInput.addEventListener('change', applyDebugEnvironmentOverrides);
    debugWeatherEffectToggles.forEach(({ input }) => {
        input.addEventListener('change', () => applyDebugWeatherEffectToggle(input));
    });
    debugWeatherWindyToggle.addEventListener('change', () => applyDebugWeatherEffectToggle());
    debugSystemTimeToggle.addEventListener('change', () => {
        debugMeadowTimeInput.disabled = debugSystemTimeToggle.checked;
        if (!debugSystemTimeToggle.checked && !debugMeadowTimeInput.value) {
            const current = new Date();
            debugMeadowTimeInput.value = `${twoDigit(current.getHours())}:${twoDigit(current.getMinutes())}`;
        }
        applyDebugEnvironmentOverrides();
    });
}
function markUserInteracted() {
    hasUserInteracted = true;
    syncNightCrickets();
}
window.addEventListener('pointerdown', markUserInteracted, { once: true });
window.addEventListener('keydown', markUserInteracted, { once: true });
// Initial setup
randomizeHardModePosition();
updateHardModeTheme();
handleRestartGame();
renderScores();
setupDebugPanel();
console.log('Exes and Os game initialized ✨');
