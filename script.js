const ASCII_SETS = {
    simple: "@#S%?*+;:,",
    detailed: "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ",
    blocks: "█▓▒░ "
};

const PALETTE = [
    '#ffffff', '#000000', '#ff3b30', '#4cd964', '#007aff', '#ffcc00', '#ff9500', '#5856d6', '#ff2d55', '#5ac8fa'
];

const STATE = {
    image: null,
    width: 100,
    charSet: 'simple',
    colorMode: 'preset', // 'original', 'custom', 'preset'
    color: '#ffffff',
    isRendering: false,
    isPanelCollapsed: false
};

// DOM Elements
const els = {
    uploadScreen: document.getElementById('uploadScreen'),
    editorScreen: document.getElementById('editorScreen'),
    fileInput: document.getElementById('fileInput'),
    canvas: document.getElementById('asciiCanvas'),
    canvasWrapper: document.querySelector('.canvas-wrapper'),
    ctx: document.getElementById('asciiCanvas').getContext('2d', { alpha: false }),
    widthRange: document.getElementById('widthRange'),
    widthVal: document.getElementById('widthVal'),
    charSetTabs: document.getElementById('charSetTabs'),
    presetColors: document.getElementById('presetColors'),
    customColorInput: document.getElementById('customColorInput'),
    btnOriginal: document.getElementById('btnOriginal'),
    downloadBtnBottom: document.getElementById('downloadBtnBottom'),
    sendToBotBtn: document.getElementById('sendToBotBtn'),
    resetBtn: document.getElementById('resetBtn'),
    bottomPanel: document.getElementById('bottomPanel'),
    panelToggle: document.getElementById('panelToggle')
};

// --- Haptic Feedback Helper ---
function haptic(style = 'light') {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        if (style === 'selection') {
            window.Telegram.WebApp.HapticFeedback.selectionChanged();
        } else if (style === 'success') {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
        } else {
            window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
        }
    } else if (navigator.vibrate) {
        navigator.vibrate(10);
    }
}

// Init
function init() {
    renderPalette();
    setupListeners();

    if (window.Telegram && window.Telegram.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();

        // Set colors for Telegram UI
        window.Telegram.WebApp.setHeaderColor('#000000');
        window.Telegram.WebApp.setBackgroundColor('#000000');

        // Show Send to Bot button if in Telegram
        if (els.sendToBotBtn) {
            els.sendToBotBtn.style.display = 'flex';
        }
    }
}

function renderPalette() {
    els.presetColors.innerHTML = '';
    PALETTE.forEach(color => {
        const btn = document.createElement('div');
        btn.className = 'color-item preset-color';
        btn.style.backgroundColor = color;
        btn.dataset.color = color;
        btn.onclick = () => {
            haptic('light');
            setColor(color, 'preset');
        };
        els.presetColors.appendChild(btn);
    });
}

function setupListeners() {
    // File Upload
    els.fileInput.addEventListener('click', () => haptic('light'));
    els.fileInput.addEventListener('change', handleFileSelect);

    // Navigation
    els.resetBtn.addEventListener('click', () => {
        haptic('medium');
        showUploadScreen();
    });

    // Panel Toggle (Click)
    els.panelToggle.addEventListener('click', togglePanel);

    // Panel Drag (Touch)
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    const panelHeight = () => els.bottomPanel.offsetHeight;
    const collapsedOffset = () => panelHeight() - 40; // 40px visible handle

    els.panelToggle.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        isDragging = true;
        els.bottomPanel.style.transition = 'none'; // Disable transition for direct control
    }, { passive: false });

    els.panelToggle.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent scroll

        currentY = e.touches[0].clientY;
        let deltaY = currentY - startY;

        // Calculate new transform
        let newTranslateY = STATE.isPanelCollapsed ? collapsedOffset() + deltaY : deltaY;

        // Constraints
        if (newTranslateY < 0) newTranslateY = 0; // Can't go higher than open
        if (newTranslateY > collapsedOffset()) newTranslateY = collapsedOffset(); // Can't go lower than collapsed

        els.bottomPanel.style.transform = `translateY(${newTranslateY}px)`;
    }, { passive: false });

    els.panelToggle.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        isDragging = false;
        els.bottomPanel.style.transition = ''; // Re-enable transition

        const deltaY = currentY - startY;
        const threshold = 50; // Drag threshold

        if (STATE.isPanelCollapsed) {
            // If dragging up significantly, open
            if (deltaY < -threshold) {
                STATE.isPanelCollapsed = false;
                els.bottomPanel.classList.remove('collapsed');
                els.canvasWrapper.classList.remove('expanded');
                els.bottomPanel.style.transform = '';
                haptic('light');
            } else {
                // Snap back to collapsed
                els.bottomPanel.style.transform = '';
                els.bottomPanel.classList.add('collapsed');
            }
        } else {
            // If dragging down significantly, collapse
            if (deltaY > threshold) {
                STATE.isPanelCollapsed = true;
                els.bottomPanel.classList.add('collapsed');
                els.canvasWrapper.classList.add('expanded');
                els.bottomPanel.style.transform = '';
                haptic('light');
            } else {
                // Snap back to open
                els.bottomPanel.style.transform = '';
                els.bottomPanel.classList.remove('collapsed');
            }
        }
    });

    // Settings
    els.widthRange.addEventListener('input', (e) => {
        haptic('selection');
        STATE.width = parseInt(e.target.value);
        els.widthVal.textContent = STATE.width;
        requestRender();
    });

    els.charSetTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('segment')) {
            haptic('light');
            document.querySelectorAll('.segment').forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            STATE.charSet = e.target.dataset.val;
            requestRender();
        }
    });

    // Colors
    els.btnOriginal.addEventListener('click', () => {
        haptic('light');
        setColor(null, 'original');
    });

    els.customColorInput.addEventListener('click', () => haptic('light'));
    els.customColorInput.addEventListener('input', (e) => {
        setColor(e.target.value, 'custom');
    });
    // Fix for color picker on some devices/browsers
    els.customColorInput.addEventListener('change', (e) => {
        setColor(e.target.value, 'custom');
    });

    // Download
    if (els.downloadBtnBottom) {
        els.downloadBtnBottom.addEventListener('click', () => {
            haptic('heavy');
            downloadImage();
        });
    }

    // Send to Bot
    if (els.sendToBotBtn) {
        els.sendToBotBtn.addEventListener('click', () => {
            haptic('heavy');
            sendToBot();
        });
    }
}

function togglePanel() {
    STATE.isPanelCollapsed = !STATE.isPanelCollapsed;
    haptic('light');

    if (STATE.isPanelCollapsed) {
        els.bottomPanel.classList.add('collapsed');
        els.canvasWrapper.classList.add('expanded');
    } else {
        els.bottomPanel.classList.remove('collapsed');
        els.canvasWrapper.classList.remove('expanded');
    }
}

function setColor(color, mode) {
    STATE.colorMode = mode;
    STATE.color = color;

    document.querySelectorAll('.color-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.preset-color').forEach(b => b.classList.remove('active'));

    if (mode === 'original') els.btnOriginal.classList.add('active');
    if (mode === 'custom') els.customColorInput.parentElement.classList.add('active');
    if (mode === 'preset') {
        const btn = Array.from(els.presetColors.children).find(b => b.dataset.color === color);
        if (btn) btn.classList.add('active');
    }

    requestRender();
}

function handleFileSelect(e) {
    if (e.target.files.length) handleFile(e.target.files[0]);
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            STATE.image = img;
            haptic('success');
            showEditorScreen();

            // Adapt initial width based on screen size
            if (window.innerWidth < 400) STATE.width = 50;
            else if (window.innerWidth < 800) STATE.width = 80;
            else STATE.width = 100; // Desktop

            els.widthRange.value = STATE.width;
            els.widthVal.textContent = STATE.width;

            setColor('#ffffff', 'preset');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showEditorScreen() {
    els.uploadScreen.classList.remove('active');
    els.editorScreen.classList.add('active');
}

function showUploadScreen() {
    els.editorScreen.classList.remove('active');
    els.uploadScreen.classList.add('active');
    els.fileInput.value = '';
    STATE.image = null;

    // Reset panel state
    STATE.isPanelCollapsed = false;
    els.bottomPanel.classList.remove('collapsed');
    els.canvasWrapper.classList.remove('expanded');
    els.bottomPanel.style.transform = '';
}

let renderTimeout;
function requestRender() {
    if (!STATE.image) return;
    if (renderTimeout) cancelAnimationFrame(renderTimeout);
    renderTimeout = requestAnimationFrame(renderAscii);
}

function renderAscii() {
    const { image, width, charSet, colorMode, color } = STATE;
    const chars = ASCII_SETS[charSet];
    const fontHeight = 10;
    const fontFace = 'monospace';

    els.ctx.font = `${fontHeight}px ${fontFace}`;
    const fontWidth = els.ctx.measureText('M').width;

    const aspectRatio = image.height / image.width;
    const height = Math.floor(aspectRatio * width * (fontWidth / fontHeight));

    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d');
    offCtx.drawImage(image, 0, 0, width, height);
    const data = offCtx.getImageData(0, 0, width, height).data;

    els.canvas.width = Math.ceil(width * fontWidth);
    els.canvas.height = Math.ceil(height * fontHeight);

    const bgColor = (colorMode === 'preset' && color === '#000000') ? '#ffffff' : '#000000';
    els.ctx.fillStyle = bgColor;
    els.ctx.fillRect(0, 0, els.canvas.width, els.canvas.height);

    els.ctx.font = `${fontHeight}px ${fontFace}`;
    els.ctx.textBaseline = 'top';

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];

            const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
            const charIndex = Math.floor((brightness / 255) * (chars.length - 1));
            const char = chars[charIndex];

            if (char === ' ') continue;

            if (colorMode === 'original') {
                els.ctx.fillStyle = `rgb(${r},${g},${b})`;
            } else {
                els.ctx.fillStyle = color;
            }

            els.ctx.fillText(char, x * fontWidth, y * fontHeight);
        }
    }
}

function downloadImage() {
    if (!STATE.image) return;

    els.canvas.toBlob((blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `ascii-${Date.now()}.png`;
        link.href = url;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 100);

    }, 'image/png');
}

function sendToBot() {
    if (!STATE.image) return;

    // Сначала скачиваем изображение пользователю
    downloadImage();

    // Затем отправляем уведомление боту
    if (window.Telegram && window.Telegram.WebApp) {
        // Мы не можем отправить само изображение через sendData (лимит 4096 байт)
        // Поэтому отправляем статус
        const data = JSON.stringify({
            action: 'image_generated',
            status: 'success'
        });

        Telegram.WebApp.sendData(data);
    } else {
        alert("Эта функция работает только внутри Telegram.");
    }
}

// Start
init();
