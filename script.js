// Состояние приложения
const appState = {
    audioFiles: [], // Array of { file: File, tags: Object, coverUrl: String }
    coverImage: null,
    processedFiles: [],
    isTelegramWebApp: false,
    isProcessing: false
};

// Элементы DOM
let blurBackground, processingModal, downloadModal, processedFilesContainer, progressFill, progressText;
let processButton, audioFilesInput, coverImageInput, coverPreview, coverPreviewContainer;
let trackTitleInput, artistNameInput, albumNameInput, audioFileList, coverFileList, closeDownloadModalButton, downloadAllButton, successMessage;

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        appState.isTelegramWebApp = true;
        tg.expand();
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');
        console.log('Telegram Web App initialized in fullscreen mode');
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initDOMElements();
    initTelegramWebApp();
    initDragAndDrop();
    initInputListeners();
    initFileInputReset();
    initHapticFeedback();
});

// Инициализация DOM элементов
function initDOMElements() {
    blurBackground = document.getElementById('blurBackground');
    processingModal = document.getElementById('processingModal');
    downloadModal = document.getElementById('downloadModal');
    processedFilesContainer = document.getElementById('processed-files-container');
    progressFill = document.getElementById('progressFill');
    progressText = document.getElementById('progressText');
    processButton = document.getElementById('processButton');
    audioFilesInput = document.getElementById('audioFiles');
    coverImageInput = document.getElementById('coverImage');
    coverPreview = document.getElementById('coverPreview');
    coverPreviewContainer = document.getElementById('coverPreviewContainer');
    trackTitleInput = document.getElementById('trackTitle');
    artistNameInput = document.getElementById('artistName');
    albumNameInput = document.getElementById('albumName');
    audioFileList = document.getElementById('audioFileList');
    coverFileList = document.getElementById('coverFileList');
    closeDownloadModalButton = document.getElementById('closeDownloadModalButton');
    downloadAllButton = document.getElementById('downloadAllButton');
    successMessage = document.getElementById('successMessage');
}

// Инициализация обработчиков событий
function initInputListeners() {
    audioFilesInput.addEventListener('change', handleAudioFilesSelection);
    coverImageInput.addEventListener('change', handleCoverImageSelection);
    processButton.addEventListener('click', handleProcessFiles);

    closeDownloadModalButton.addEventListener('click', () => {
        downloadModal.classList.remove('active');
        blurBackground.classList.remove('active');
        document.body.classList.remove('no-scroll');
        resetAppState();
    });

    downloadAllButton.addEventListener('click', handleDownloadAll);

    [trackTitleInput, artistNameInput, albumNameInput].forEach(input => {
        input.addEventListener('input', validateForm);
    });
}

// --- HAPTIC FEEDBACK (ВИБРАЦИЯ) ---
function triggerHapticFeedback(type = 'light') {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback) {
        const haptic = window.Telegram.WebApp.HapticFeedback;
        try {
            if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(type)) {
                haptic.impactOccurred(type);
            } else if (['error', 'success', 'warning'].includes(type)) {
                haptic.notificationOccurred(type);
            } else if (type === 'selection') {
                haptic.selectionChanged();
            } else {
                haptic.impactOccurred('light');
            }
        } catch (e) {
            console.error('Haptic error:', e);
        }
    } else if (navigator.vibrate) {
        const durationMap = { light: 10, medium: 20, heavy: 40, rigid: 15, soft: 5, error: [50, 50, 50], success: 50, warning: 30, selection: 5 };
        try {
            navigator.vibrate(durationMap[type] || 10);
        } catch (e) { /* Ignore */ }
    }
}

function initHapticFeedback() {
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('button, .button, .custum-file-upload, .file-remove, .download-button-icon, a, .modal-close-button')) {
            triggerHapticFeedback('light');
        }
    });
}

// --- КОНЕЦ HAPTIC FEEDBACK ---

// Drag and Drop функциональность
function initDragAndDrop() {
    const audioDropZone = audioFilesInput.closest('.custum-file-upload');
    const coverDropZone = coverImageInput.closest('.custum-file-upload');

    [audioDropZone, coverDropZone].forEach(zone => {
        if (!zone) return;
        zone.addEventListener('dragover', function(e) { e.preventDefault(); this.classList.add('drag-over'); });
        zone.addEventListener('dragleave', function(e) { e.preventDefault(); this.classList.remove('drag-over'); });
        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            triggerHapticFeedback('medium');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                if (this === audioDropZone) handleDroppedAudioFiles(files);
                else handleDroppedCoverImage(files[0]);
            }
        });
    });
}

async function handleDroppedAudioFiles(files) {
    const validFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.mp3'));
    if (validFiles.length === 0) return showError('Пожалуйста, перетащите MP3 файлы');

    await addAudioFiles(validFiles);
}

function handleDroppedCoverImage(file) {
    if (!file) return;
    const supportedFormats = ['.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!supportedFormats.includes(extension)) return showError('Пожалуйста, выберите поддерживаемое изображение (JPG, PNG)');
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    coverImageInput.files = dataTransfer.files;
    handleCoverImageSelection({ target: coverImageInput });
}

// Валидация формы
function validateForm() {
    // Теперь обязательны только аудиофайлы. Остальное опционально.
    const isValid = appState.audioFiles.length > 0;
    processButton.disabled = !isValid;
    return isValid;
}

function showError(message) {
    triggerHapticFeedback('error');
    alert(message);
}

// Обработчики событий
async function handleAudioFilesSelection(event) {
    const validFiles = Array.from(event.target.files).filter(file => file.name.toLowerCase().endsWith('.mp3'));
    if (validFiles.length === 0) return showError('Пожалуйста, выберите MP3 файлы');

    await addAudioFiles(validFiles);
}

async function addAudioFiles(files) {
    // Показываем спиннер или блокируем интерфейс, если файлов много?
    // Пока просто обрабатываем.

    for (const file of files) {
        try {
            const tags = await readTags(file);
            let coverUrl = null;
            if (tags && tags.picture) {
                const { data, format } = tags.picture;
                const base64String = data.reduce((acc, byte) => acc + String.fromCharCode(byte), '');
                coverUrl = `data:${format};base64,${btoa(base64String)}`;
            }

            appState.audioFiles.push({
                file: file,
                tags: tags || {},
                coverUrl: coverUrl
            });
        } catch (e) {
            console.warn('Could not read tags for', file.name, e);
            appState.audioFiles.push({
                file: file,
                tags: {},
                coverUrl: null
            });
        }
    }

    updateFileList();
    validateForm();
}

function readTags(file) {
    return new Promise((resolve) => {
        jsmediatags.read(file, {
            onSuccess: function(tag) {
                resolve(tag.tags);
            },
            onError: function(error) {
                console.log(error);
                resolve(null);
            }
        });
    });
}

function handleCoverImageSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    const supportedFormats = ['.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    if (!supportedFormats.includes(extension)) return showError('Пожалуйста, выберите поддерживаемое изображение (JPG, PNG)');
    appState.coverImage = file;
    const reader = new FileReader();
    reader.onload = e => {
        coverPreview.src = e.target.result;
        coverPreviewContainer.style.display = 'block';
        updateCoverFileList();
    };
    reader.readAsDataURL(file);
    validateForm();
}

function updateCoverFileList() {
    if (!coverFileList) return;
    coverFileList.innerHTML = '';
    if (appState.coverImage) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-name">${appState.coverImage.name}</div>
                <div class="file-size">${(appState.coverImage.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div class="file-remove" title="Удалить обложку">×</div>
        `;
        fileItem.querySelector('.file-remove').addEventListener('click', e => {
            e.stopPropagation();
            removeCoverImage();
        });
        coverFileList.appendChild(fileItem);
    }
}

function removeCoverImage() {
    appState.coverImage = null;
    coverImageInput.value = '';
    coverPreviewContainer.style.display = 'none';
    coverFileList.innerHTML = '';
    validateForm();
}

async function handleProcessFiles() {
    if (appState.isProcessing || !validateForm()) return;
    appState.isProcessing = true;
    processButton.disabled = true;
    triggerHapticFeedback('medium');
    blurBackground.classList.add('active');
    processingModal.classList.add('active');

    try {
        appState.processedFiles = [];
        const totalFiles = appState.audioFiles.length;

        // Глобальные значения из инпутов
        const globalTitle = trackTitleInput.value.trim();
        const globalArtist = artistNameInput.value.trim();
        const globalAlbum = albumNameInput.value.trim();

        for (let i = 0; i < totalFiles; i++) {
            progressFill.style.width = `${((i + 1) / totalFiles) * 100}%`;
            progressText.textContent = `Обработано: ${i + 1}/${totalFiles}`;

            const item = appState.audioFiles[i];

            // Логика слияния данных:
            // 1. Если есть глобальное значение -> используем его
            // 2. Если нет, используем значение из тегов файла
            // 3. Если нет, оставляем пустым (или undefined)

            const title = globalTitle || item.tags.title || item.file.name.replace(/\.mp3$/i, '');
            const artist = globalArtist || item.tags.artist || '';
            const album = globalAlbum || item.tags.album || '';

            // Обложка: глобальная -> из файла -> null
            let coverImageToUse = appState.coverImage;
            let coverBuffer = null;

            if (coverImageToUse) {
                coverBuffer = await coverImageToUse.arrayBuffer();
            } else if (item.tags.picture) {
                // Если обложка есть в файле, нам нужно её извлечь и передать в writer
                // Но ID3Writer требует ArrayBuffer.
                // Мы можем просто не перезаписывать обложку, если не загружена новая.
                // Но ID3Writer пересоздает теги. Поэтому нужно явно передать старую обложку, если хотим её сохранить.
                // item.tags.picture.data - это массив байтов.
                const { data } = item.tags.picture;
                coverBuffer = new Uint8Array(data).buffer;
            }

            const processedFile = await processSingleFile(item.file, coverBuffer, title, artist, album);

            appState.processedFiles.push({
                file: processedFile,
                title: title,
                artist: artist,
                album: album
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        processingModal.classList.remove('active');
        showDownloadModal();
    } catch (error) {
        console.error('Ошибка обработки:', error);
        showError('Произошла ошибка при обработке файлов: ' + error.message);
        processingModal.classList.remove('active');
        blurBackground.classList.remove('active');
    } finally {
        appState.isProcessing = false;
        processButton.disabled = false;
    }
}

async function processSingleFile(audioFile, coverBuffer, title, artist, album) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const writer = new ID3Writer(arrayBuffer);

            if (coverBuffer) {
                writer.setFrame('APIC', {
                    type: 3,
                    data: new Uint8Array(coverBuffer),
                    description: 'Cover'
                });
            }

            if (title) writer.setFrame('TIT2', title);
            if (artist) writer.setFrame('TPE1', [artist]);
            if (album) writer.setFrame('TALB', album);

            writer.addTag();
            const blob = writer.getBlob();

            // Формируем имя файла
            let fileName = audioFile.name; // По умолчанию оригинальное имя
            if (title && artist) {
                fileName = `${title} - ${artist}.mp3`;
            } else if (title) {
                fileName = `${title}.mp3`;
            }

            resolve(new File([blob], fileName, { type: 'audio/mpeg' }));
        } catch (error) {
            reject(error);
        }
    });
}

function showDownloadModal() {
    if (!processedFilesContainer) return;
    triggerHapticFeedback('success');
    processedFilesContainer.innerHTML = '';

    const template = document.getElementById('processed-file-card-template');

    // URL для глобальной обложки, если она есть
    const globalCoverUrl = appState.coverImage ? URL.createObjectURL(appState.coverImage) : null;

    appState.processedFiles.forEach((item, index) => {
        const card = template.content.cloneNode(true);
        const downloadUrl = URL.createObjectURL(item.file);

        // Определяем какую обложку показывать в результате
        const originalItem = appState.audioFiles[index];
        let displayCoverUrl = globalCoverUrl;

        if (!displayCoverUrl && originalItem.coverUrl) {
            displayCoverUrl = originalItem.coverUrl;
        }

        const coverImg = card.querySelector('.processed-file-cover');
        if (displayCoverUrl) {
            coverImg.src = displayCoverUrl;
        } else {
            // Заглушка или скрыть? Пока оставим пустой src или можно поставить плейсхолдер
            coverImg.style.backgroundColor = '#333'; // Серый фон если нет обложки
        }

        card.querySelector('.processed-file-title').textContent = item.title || 'Без названия';
        card.querySelector('.processed-file-artist').textContent = item.artist || 'Неизвестный исполнитель';
        card.querySelector('.processed-file-album').textContent = item.album || '';

        const downloadButton = card.querySelector('.download-button-icon');
        downloadButton.href = downloadUrl;
        downloadButton.download = item.file.name;

        processedFilesContainer.appendChild(card);
    });

    if (appState.processedFiles.length === 1) {
        successMessage.textContent = 'Файл успешно обработан.';
    } else {
        successMessage.textContent = 'Файлы успешно обработаны.';
    }

    if (appState.processedFiles.length > 1) {
        downloadAllButton.style.display = 'block';
    } else {
        downloadAllButton.style.display = 'none';
    }

    downloadModal.classList.add('active');
    document.body.classList.add('no-scroll');
}

async function handleDownloadAll() {
    triggerHapticFeedback('medium');
    for (const item of appState.processedFiles) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(item.file);
        link.download = item.file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function updateFileList() {
    if (!audioFileList) return;
    audioFileList.innerHTML = '';

    appState.audioFiles.forEach((item, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        // Создаем миниатюру
        const thumb = document.createElement('img');
        thumb.className = 'file-thumb';
        if (item.coverUrl) {
            thumb.src = item.coverUrl;
        } else {
            // Можно добавить иконку ноты или оставить серым
            thumb.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzMzMyI+PHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiAvPjwvc3ZnPg==';
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'file-info';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'file-name';
        nameDiv.textContent = item.file.name;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        const metaParts = [];
        if (item.tags.title) metaParts.push(item.tags.title);
        if (item.tags.artist) metaParts.push(item.tags.artist);
        metaDiv.textContent = metaParts.length > 0 ? metaParts.join(' • ') : 'Нет метаданных';

        const sizeDiv = document.createElement('div');
        sizeDiv.className = 'file-size';
        sizeDiv.textContent = `${(item.file.size / 1024 / 1024).toFixed(2)} MB`;

        infoDiv.appendChild(nameDiv);
        infoDiv.appendChild(metaDiv);
        infoDiv.appendChild(sizeDiv);

        const removeBtn = document.createElement('div');
        removeBtn.className = 'file-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Удалить файл';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.audioFiles.splice(index, 1);
            updateFileList();
            validateForm();
            if (appState.audioFiles.length === 0) audioFilesInput.value = '';
        });

        fileItem.appendChild(thumb);
        fileItem.appendChild(infoDiv);
        fileItem.appendChild(removeBtn);

        audioFileList.appendChild(fileItem);
    });
}

function resetAppState() {
    appState.audioFiles = [];
    appState.coverImage = null;
    appState.processedFiles = [];
    appState.isProcessing = false;
    processButton.disabled = true; // Кнопка должна быть неактивна при сбросе

    audioFilesInput.value = '';
    coverImageInput.value = '';
    trackTitleInput.value = '';
    artistNameInput.value = '';
    albumNameInput.value = '';

    if (audioFileList) audioFileList.innerHTML = '';
    if (coverFileList) coverFileList.innerHTML = '';
    if (coverPreviewContainer) coverPreviewContainer.style.display = 'none';
    if (progressFill) progressFill.style.width = '0%';
    if (progressText) progressText.textContent = 'Обработано: 0/0';
    if (downloadAllButton) downloadAllButton.style.display = 'none';
}

function initFileInputReset() {
    const audioUploadZone = audioFilesInput.closest('.custum-file-upload');
    const coverUploadZone = coverImageInput.closest('.custum-file-upload');
    if (!audioUploadZone || !coverUploadZone) return;
    audioUploadZone.addEventListener('click', function() { if (appState.audioFiles.length === 0) audioFilesInput.value = ''; });
    coverUploadZone.addEventListener('click', function() { if (!appState.coverImage) coverImageInput.value = ''; });
}
