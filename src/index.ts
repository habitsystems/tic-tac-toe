const STORAGE_KEY_SECRET = 'exesandos-key-v1';
const STORAGE_VALUE_SECRET = 'exesandos-value-v1';

function xorBytes(input: Uint8Array, secret: Uint8Array): Uint8Array {
    const output = new Uint8Array(input.length);
    for (let i = 0; i < input.length; i++) {
        output[i] = input[i] ^ secret[i % secret.length];
    }
    return output;
}

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function obfuscate(value: string, secret: string): string {
    const encoder = new TextEncoder();
    const valueBytes = encoder.encode(value);
    const secretBytes = encoder.encode(secret);
    return toBase64(xorBytes(valueBytes, secretBytes));
}

function deobfuscate(value: string, secret: string): string {
    const decoder = new TextDecoder();
    const secretBytes = new TextEncoder().encode(secret);
    const decoded = xorBytes(fromBase64(value), secretBytes);
    return decoder.decode(decoded);
}

function getEncryptedStorageKey(rawKey: string): string {
    return `exo_${obfuscate(rawKey, STORAGE_KEY_SECRET)}`;
}

function storageSet(rawKey: string, rawValue: string) {
    const encryptedKey = getEncryptedStorageKey(rawKey);
    const encryptedValue = obfuscate(rawValue, STORAGE_VALUE_SECRET);
    localStorage.setItem(encryptedKey, encryptedValue);
    localStorage.removeItem(rawKey);
}

function storageGet(rawKey: string, fallback: string): string {
    const encryptedKey = getEncryptedStorageKey(rawKey);
    const encryptedValue = localStorage.getItem(encryptedKey);

    if (encryptedValue !== null) {
        try {
            return deobfuscate(encryptedValue, STORAGE_VALUE_SECRET);
        } catch {
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

let currentPlayer: 'X' | 'O' = 'X';
let board: (string | null)[] = Array(9).fill(null);
let gameActive = true;
let isMisereMode = false;
let is3DMode = false;
let is4x4Mode = false;
let is4x4x4Mode = false;
let isHardMode = storageGet('hard_mode', 'false') === 'true';
let hardModeWins = parseInt(storageGet('hard_mode_wins', '0'));
let useMonsterPieces = storageGet('use_monster_pieces', 'false') === 'true';
let flowerLossCount = parseInt(storageGet('flower_loss_count', '0'));
let rotationX = -20;
let rotationY = -20;

const wins = {
    'default': parseInt(storageGet('wins_default', '0')),
    'misere': parseInt(storageGet('wins_misere', '0')),
    '3d': parseInt(storageGet('wins_3d', '0')),
    '4x4': parseInt(storageGet('wins_4x4', '0'))
};

const gameScores: { [key: string]: { [mode: string]: number } } = {
    'X': JSON.parse(storageGet('score_X_v2', '{}')),
    'O': JSON.parse(storageGet('score_O_v2', '{}'))
};

const statusDisplay = document.getElementById('status')!;
const gameTitle = document.getElementById('game-title')!;
const playerLabel = document.getElementById('player-label')!;
let cells = document.querySelectorAll('.cell');
const resetButton = document.getElementById('reset')!;
const resetScoresButton = document.getElementById('reset-scores')!;
const misereToggle = document.getElementById('misere-toggle') as HTMLInputElement;
const mode3DToggle = document.getElementById('mode-3d-toggle') as HTMLInputElement;
const mode4x4Toggle = document.getElementById('mode-4x4-toggle') as HTMLInputElement;
const mode4x4x4Toggle = document.getElementById('mode-4x4x4-toggle') as HTMLInputElement;
const hardModeToggle = document.getElementById('hard-mode-toggle') as HTMLInputElement;
const hardModeContainer = document.getElementById('hard-mode-container')!;
const cube = document.getElementById('cube')!;
const controls3D = document.getElementById('controls-3d')!;
const messageOverlay = document.getElementById('message-overlay')!;
let messageTimeout: number | null = null;

const misereContainer = document.getElementById('misere-container')!;
const mode3DContainer = document.getElementById('mode-3d-container')!;
const mode4x4Container = document.getElementById('mode-4x4-container')!;
const mode4x4x4Container = document.getElementById('mode-4x4x4-container')!;

const scorePlayerContainer = document.getElementById('score-player')!;
const scoreComputerContainer = document.getElementById('score-computer')!;

let inactivityTimer: number | null = null;
let treeTimer: number | null = null;
let snailElement: HTMLElement | null = null;
let treeElement: HTMLElement | null = null;
let moneyRainInterval: number | null = null;
const maxMoneyPile = 160;

// 2D Winning Conditions for 3x3 grid
const winningConditions2D = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// 2D Winning Conditions for 4x4 grid
const winningConditions4x4: number[][] = [
    [0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15],
    [0, 4, 8, 12], [1, 5, 9, 13], [2, 6, 10, 14], [3, 7, 11, 15],
    [0, 5, 10, 15], [3, 6, 9, 12]
];

// 3D Winning Conditions for 3x3x3 grid
const winningConditions3D = [
    // Layer 1 (Top) - 8 lines
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6],             // Diagonals

    // Layer 2 (Middle) - 8 lines
    [9, 10, 11], [12, 13, 14], [15, 16, 17], // Rows
    [9, 12, 15], [10, 13, 16], [11, 14, 17], // Columns
    [9, 13, 17], [11, 13, 15],             // Diagonals

    // Layer 3 (Bottom) - 8 lines
    [18, 19, 20], [21, 22, 23], [24, 25, 26], // Rows
    [18, 21, 24], [19, 22, 25], [20, 23, 26], // Columns
    [18, 22, 26], [20, 22, 24],             // Diagonals

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
const winningConditions4x4x4: number[][] = [];
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

function showMessage(text: string) {
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

function handleCellClick(clickedCellEvent: Event) {
    if (currentPlayer === 'O' || !gameActive) {
        return;
    }
    resetInactivityTimer();

    const clickedCell = clickedCellEvent.target as HTMLElement;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index')!);

    if (clickedCellIndex >= board.length || board[clickedCellIndex] !== null) {
        return;
    }

    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();

    if (gameActive && (currentPlayer as string) === 'O') {
        setTimeout(handleComputerMove, 500);
    }
}

function handleComputerMove() {
    const availableIndices = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null) as number[];
    if (availableIndices.length === 0 || !gameActive) {
        stopInactivityTimer();
        return;
    }

    let moveIndex: number;

    if (isHardMode) {
        moveIndex = getBestMove(availableIndices);
    } else {
        // Simple AI: pick a random available cell
        moveIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    }

    const computerCell = document.querySelector(`.cell[data-index="${moveIndex}"]`) as HTMLElement;

    handleCellPlayed(computerCell, moveIndex);
    handleResultValidation();
    if (gameActive) {
        startInactivityTimer();
    }
}

function getBestMove(availableIndices: number[]): number {
    let currentWinningConditions = winningConditions2D;
    if (is4x4x4Mode) currentWinningConditions = winningConditions4x4x4;
    else if (is4x4Mode) currentWinningConditions = winningConditions4x4;
    else if (is3DMode) currentWinningConditions = winningConditions3D;

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
            if (availableIndices.includes(13)) return 13; // Center of 3x3x3
        } else {
            if (availableIndices.includes(4)) return 4; // Center of 3x3
        }
    }

    // 4. Random move
    return availableIndices[Math.floor(Math.random() * availableIndices.length)];
}

function checkWin(currentBoard: (string | null)[], conditions: number[][]): boolean {
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
    } else {
        misereContainer.style.display = 'none';
        misereToggle.checked = false;
    }

    if (wins['misere'] >= 10) {
        mode4x4Container.style.display = 'inline-block';
    } else {
        mode4x4Container.style.display = 'none';
        mode4x4Toggle.checked = false;
    }

    if (wins['4x4'] >= 10) {
        mode3DContainer.style.display = 'inline-block';
    } else {
        mode3DContainer.style.display = 'none';
        mode3DToggle.checked = false;
    }

    if (wins['3d'] >= 10) {
        mode4x4x4Container.style.display = 'inline-block';
    } else {
        mode4x4x4Container.style.display = 'none';
        mode4x4x4Toggle.checked = false;
    }
}

function handleCellPlayed(clickedCell: HTMLElement, clickedCellIndex: number) {
    board[clickedCellIndex] = currentPlayer;
    let piece = currentPlayer as string;
    if (useMonsterPieces) {
        if (isHardMode) {
            piece = (currentPlayer === 'X' ? '👾' : '👻');
        } else {
            piece = (currentPlayer === 'X' ? '🌸' : '🌼');
        }
    }
    clickedCell.innerText = piece;
    resetButton.style.visibility = 'visible';
}

function handleResultValidation() {
    let winningLine: number[] | null = null;
    let currentWinningConditions = winningConditions2D;
    if (is4x4x4Mode) {
        currentWinningConditions = winningConditions4x4x4;
    } else if (is4x4Mode) {
        currentWinningConditions = winningConditions4x4;
    } else if (is3DMode) {
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
            if (currentPlayer === 'O') {
                recordWin();
                updateScores('X');
            } else {
                updateScores('O');
            }
        } else {
            statusDisplay.innerText = `Player ${currentPlayer} has won!`;
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
            } else {
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
                                    (cell as HTMLElement).innerText = board[idx] as string;
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
        wins[currentMode as keyof typeof wins]++;
        storageSet(`wins_${currentMode}`, wins[currentMode as keyof typeof wins].toString());
        updateUnlockStatus();
    }
}

function updateScores(winner: 'X' | 'O') {
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

function renderPlayerTally(container: HTMLElement, scoresByMode: { [mode: string]: number }) {
    container.innerHTML = '';
    const modes = ['default', 'misere', '4x4', '3d', '4x4x4'];
    modes.forEach(mode => {
        const score = scoresByMode[mode] || 0;
        if (score > 0) {
            renderTallyForMode(container, score, `mode-${mode}`);
        }
    });
}

function renderTallyForMode(container: HTMLElement, score: number, modeClass: string) {
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

function highlightWinningLine(line: number[]) {
    const size = (is4x4x4Mode || is4x4Mode) ? 4 : 3;
    
    // Helper to determine win type for 2D planes
    const getWinType = (indices: number[]) => {
        const coords = indices.map(idx => ({
            l: Math.floor(idx / (size * size)),
            r: Math.floor((idx % (size * size)) / size),
            c: idx % size
        }));

        const sameLayer = coords.every(v => v.l === coords[0].l);
        if (!sameLayer) return 'win-generic';

        const sameRow = coords.every(v => v.r === coords[0].r);
        if (sameRow) return 'win-horizontal';

        const sameCol = coords.every(v => v.c === coords[0].c);
        if (sameCol) return 'win-vertical';

        // Diagonals within a layer
        const isDiag1 = coords.every((v, i) => v.r === i && v.c === i);
        if (isDiag1) return 'win-diagonal-1';

        const isDiag2 = coords.every((v, i) => v.r === i && v.c === (size - 1 - i));
        if (isDiag2) return 'win-diagonal-2';

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
    } else {
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
        document.getElementById('layer-0')!,
        document.getElementById('layer-1')!,
        document.getElementById('layer-2')!,
        document.getElementById('layer-3')!
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
            (layer.parentElement as HTMLElement).style.display = 'block';
        } else {
            (layer.parentElement as HTMLElement).style.display = 'none';
        }
    });
    
    cells = document.querySelectorAll('.cell');

    // Update UI for 3D/2D
    if (is3DMode) {
        cube.classList.remove('mode-3d', 'mode-4x4x4');
        cube.classList.add(is4x4x4Mode ? 'mode-4x4x4' : 'mode-3d');
        controls3D.style.display = 'block';
        updateCubeRotation();
    } else {
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
    } else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        } else {
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
    } else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        } else {
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
    } else {
        if (confirm("Changing mode will reset the current game. Continue?")) {
            handleRestartGame();
        } else {
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
    } else {
        document.body.classList.remove('hard-mode-active');
        gameTitle.innerText = "Tic-Tac-Toe";
        playerLabel.innerText = "Player";
        removeMonsters();
        if (useMonsterPieces) {
            document.body.classList.add('meadow-active');
            renderMeadow();
        } else {
            document.body.classList.remove('meadow-active');
            removeMeadow();
        }
    }
    // Refresh board to update pieces if they changed (monster -> flower or vice versa)
    if (useMonsterPieces) {
        cells.forEach((cell, idx) => {
            if (board[idx] !== null) {
                (cell as HTMLElement).innerText = board[idx] === 'X'
                    ? (isHardMode ? '👾' : '🌸')
                    : (isHardMode ? '👻' : '🌼');
            }
        });
    }
}

const MONSTERS = ['👾', '👹', '👺', '👻', '👽', '💀', '🤡', '🧛', '🧟', '👁️', '🕸️', '🦂', '🐍', '🦇'];

function renderMonsters() {
    removeMonsters();
    if (!isHardMode) return;
    
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

function renderMeadow() {
    removeMeadow();
    if (isHardMode || !useMonsterPieces) return;

    // Add bees
    for (let i = 0; i < 3; i++) {
        const bee = document.createElement('div');
        bee.className = 'bee';
        bee.innerText = '🐝';
        bee.style.animationDelay = `${Math.random() * 10}s`;
        bee.style.top = `${Math.random() * 50 + 10}vh`;
        bee.style.left = '-5vw';
        document.body.appendChild(bee);
        
        // Occasionally land on a flower
        if (Math.random() > 0.5) {
            setTimeout(() => {
                if (!document.body.classList.contains('meadow-active')) return;
                const flowers = document.querySelectorAll('.cell');
                const randomFlower = flowers[Math.floor(Math.random() * flowers.length)] as HTMLElement;
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

    // Add a bird
    const bird = document.createElement('div');
    bird.className = 'bird';
    bird.innerHTML = '🕊️<span class="wing"></span>';
    bird.style.animationDelay = `${Math.random() * 5}s`;
    bird.style.left = '105vw';
    bird.style.top = '10vh';
    document.body.appendChild(bird);

    // Occasionally land on scoreboard or button
    if (Math.random() > 0.3) {
        setTimeout(() => {
            if (!document.body.classList.contains('meadow-active')) return;
            const targets = document.querySelectorAll('.score-container, button');
            const target = targets[Math.floor(Math.random() * targets.length)] as HTMLElement;
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
    const elements = document.querySelectorAll('.bee, .bird, .grass-blade, .snail-traversal, .tree');
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
document.getElementById('rotate-up')!.addEventListener('click', () => { rotationX += 10; updateCubeRotation(); });
document.getElementById('rotate-down')!.addEventListener('click', () => { rotationX -= 10; updateCubeRotation(); });
document.getElementById('rotate-left')!.addEventListener('click', () => { rotationY -= 10; updateCubeRotation(); });
document.getElementById('rotate-right')!.addEventListener('click', () => { rotationY += 10; updateCubeRotation(); });

window.addEventListener('keydown', (e) => {
    if (!is3DMode) return;
    if (e.key === 'ArrowUp') rotationX += 10;
    if (e.key === 'ArrowDown') rotationX -= 10;
    if (e.key === 'ArrowLeft') rotationY -= 10;
    if (e.key === 'ArrowRight') rotationY += 10;
    updateCubeRotation();
});

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
function handleResetScores() {
    if (confirm("This will reset all your progress and scores. Are you sure?")) {
        stopInactivityTimer();
        // Reset wins (unlocks)
        Object.keys(wins).forEach(key => {
            wins[key as keyof typeof wins] = 0;
            storageSet(`wins_${key}`, '0');
        });
        
        // Reset game scores
        Object.keys(gameScores).forEach(key => {
            gameScores[key as keyof typeof gameScores] = {};
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

function startInactivityTimer() {
    stopInactivityTimer();
    if (!gameActive || currentPlayer === 'O') return;
    inactivityTimer = window.setTimeout(() => {
        if (!snailElement) {
            snailElement = document.createElement('div');
            snailElement.className = 'snail-traversal';
            snailElement.innerText = Math.random() > 0.5 ? '🐌' : '🐢';
            document.body.appendChild(snailElement);
        }
        // Force reflow
        snailElement.getBoundingClientRect();
        snailElement.style.left = '110vw';
        
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
    if (treeElement || !document.body.classList.contains('meadow-active')) return;
    
    treeElement = document.createElement('div');
    treeElement.className = 'tree';
    
    const trunk = document.createElement('div');
    trunk.className = 'tree-trunk';
    
    const fruits = ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍒', '🍑', '🍍', '🥭', '🥝', '🍅', '🍆', '🌽', '🥕', '🥔', '🥦', '🥬', '🥒', '🥑'];
    const getRandomFruit = () => fruits[Math.floor(Math.random() * fruits.length)];

    const areAllTreeFruitsMatching = () => {
        const fruitElements = treeElement?.querySelectorAll('.tree-foliage span');
        if (!fruitElements || fruitElements.length < 2) return false;

        const firstFruit = (fruitElements[0] as HTMLElement).innerText;
        if (!firstFruit) return false;

        return Array.from(fruitElements).every((fruitEl) => {
            return (fruitEl as HTMLElement).innerText === firstFruit;
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
        if (moneyPieces.length >= maxMoneyPile) return;

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
        if (moneyRainInterval !== null) return;
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
        } else {
            stopMoneyRain();
        }
    };

    const createFruitElement = (parent: HTMLElement) => {
        const fruit = document.createElement('span');
        fruit.innerText = getRandomFruit();
        updateMoneyRainState();
        fruit.addEventListener('click', (e) => {
            e.stopPropagation();
            if (fruit.classList.contains('eating')) return;
            
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

    const createBranch = (className: string, top: string, left: string) => {
        const branch = document.createElement('div');
        branch.className = className;
        branch.style.top = top;
        branch.style.left = left;

        const foliage = document.createElement('div');
        foliage.className = 'tree-foliage';
        createFruitElement(foliage);

        branch.appendChild(foliage);
        trunk.appendChild(branch);
    };

    // Main foliage
    const mainFoliage = document.createElement('div');
    mainFoliage.className = 'tree-foliage main';
    createFruitElement(mainFoliage);
    trunk.appendChild(mainFoliage);

    // Branches
    createBranch('tree-branch left', '113px', '21px');
    createBranch('tree-branch right', '195px', '24px');
    createBranch('tree-branch left', '278px', '18px');
    createBranch('tree-branch right', '360px', '26px');

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
    
    // Trigger breeze after growing
    setTimeout(() => {
        if (treeElement) {
            treeElement.classList.add('breezy');
        }
    }, 5100);
}

function stopInactivityTimer() {
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
    document.querySelectorAll('.money-drop').forEach((money) => money.remove());
}

function resetInactivityTimer() {
    stopInactivityTimer();
    startInactivityTimer();
}

// Initial setup
randomizeHardModePosition();
updateHardModeTheme();
handleRestartGame();
renderScores();

console.log('Exes and Os game initialized ✨');
