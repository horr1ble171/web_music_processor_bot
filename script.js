// Состояние приложения
const appState = {
    audioFiles: [],
    coverImage: null,
    processedFiles: [],
    isTelegramWebApp: false,
    isProcessing: false
};

// Элементы DOM
let blurBackground, processingModal, downloadModal, downloadLinks, progressFill, progressText;
let processButton, audioFilesInput, coverImageInput, coverPreview, coverPreviewContainer;
let trackTitleInput, artistNameInput, albumNameInput, audioFileList, coverFileList;

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        appState.isTelegramWebApp = true;

        // Расширяем на весь экран
        tg.expand();

        // Применяем стили для мини-приложения
        document.body.classList.add('mini-app-mode');

        // Устанавливаем цвет тему
        tg.setHeaderColor('#000000');
        tg.setBackgroundColor('#000000');

        console.log('Telegram Web App initialized in fullscreen mode');
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Инициализируем DOM элементы
    initDOMElements();

    initTelegramWebApp();
    initDragAndDrop();
    initInputListeners();
    initFileInputReset();
});

// Инициализация DOM элементов
function initDOMElements() {
    blurBackground = document.getElementById('blurBackground');
    processingModal = document.getElementById('processingModal');
    downloadModal = document.getElementById('downloadModal');
    downloadLinks = document.getElementById('downloadLinks');
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
}

// Инициализация обработчиков событий
function initInputListeners() {
    audioFilesInput.addEventListener('change', handleAudioFilesSelection);
    coverImageInput.addEventListener('change', handleCoverImageSelection);
    processButton.addEventListener('click', handleProcessFiles);

    // Валидация в реальном времени
    [trackTitleInput, artistNameInput, albumNameInput].forEach(input => {
        input.addEventListener('input', validateForm);
    });
}

// Drag and Drop функциональность
function initDragAndDrop() {
    const audioDropZone = audioFilesInput.closest('.custum-file-upload');
    const coverDropZone = coverImageInput.closest('.custum-file-upload');

    [audioDropZone, coverDropZone].forEach(zone => {
        if (!zone) return;

        zone.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
        });

        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                if (this === audioDropZone) {
                    handleDroppedAudioFiles(files);
                } else {
                    handleDroppedCoverImage(files[0]);
                }
            }
        });
    });
}

function handleDroppedAudioFiles(files) {
    const validFiles = Array.from(files).filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return extension === '.mp3';
    });

    if (validFiles.length === 0) {
        showError('Пожалуйста, перетащите MP3 файлы');
        return;
    }

    appState.audioFiles = appState.audioFiles.concat(validFiles);
    updateFileList();
    validateForm();
}

function handleDroppedCoverImage(file) {
    if (!file) return;

    const supportedFormats = ['.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!supportedFormats.includes(extension)) {
        showError('Пожалуйста, перетащите поддерживаемое изображение (JPG, PNG)');
        return;
    }

    // Создаем событие change для имитации выбора файла
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    coverImageInput.files = dataTransfer.files;

    // Вызываем обработчик напрямую
    handleCoverImageSelection({ target: coverImageInput });
}

// Валидация формы
function validateForm() {
    const isValid = appState.audioFiles.length > 0 &&
                   appState.coverImage &&
                   trackTitleInput.value.trim() &&
                   artistNameInput.value.trim() &&
                   albumNameInput.value.trim();

    processButton.disabled = !isValid;
    return isValid;
}

function showError(message) {
    alert(message);
}

// Обработчики событий
function handleAudioFilesSelection(event) {
    const files = Array.from(event.target.files);

    const validFiles = files.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return extension === '.mp3';
    });

    if (validFiles.length === 0) {
        showError('Пожалуйста, выберите MP3 файлы');
        return;
    }

    appState.audioFiles = appState.audioFiles.concat(validFiles);
    updateFileList();
    validateForm();
}

function handleCoverImageSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    const supportedFormats = ['.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!supportedFormats.includes(extension)) {
        showError('Пожалуйста, выберите поддерживаемое изображение (JPG, PNG)');
        return;
    }

    appState.coverImage = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        // Обновляем превью обложки
        coverPreview.src = e.target.result;
        coverPreviewContainer.style.display = 'block';

        // Обновляем список файлов для обложки
        updateCoverFileList();
    };
    reader.readAsDataURL(file);

    validateForm();
}

// Функция обновления списка файлов обложки
function updateCoverFileList() {
    if (!coverFileList) return;

    coverFileList.innerHTML = '';

    if (appState.coverImage) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = appState.coverImage.name;

        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = `${(appState.coverImage.size / 1024 / 1024).toFixed(2)} MB`;

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);

        const fileRemove = document.createElement('div');
        fileRemove.className = 'file-remove';
        fileRemove.textContent = '×';
        fileRemove.title = 'Удалить обложку';
        fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            removeCoverImage();
        });

        fileItem.appendChild(fileInfo);
        fileItem.appendChild(fileRemove);
        coverFileList.appendChild(fileItem);
    }
}

// Функция удаления обложки
function removeCoverImage() {
    appState.coverImage = null;
    coverImageInput.value = '';
    coverPreviewContainer.style.display = 'none';
    coverFileList.innerHTML = '';

    validateForm();
}

async function handleProcessFiles() {
    if (appState.isProcessing) return;

    if (appState.audioFiles.length === 0) {
        showError('Пожалуйста, загрузите MP3 файлы');
        return;
    }

    if (!appState.coverImage) {
        showError('Пожалуйста, загрузите обложку');
        return;
    }

    if (!trackTitleInput.value.trim()) {
        showError('Пожалуйста, введите название трека');
        return;
    }

    if (!artistNameInput.value.trim()) {
        showError('Пожалуйста, введите имя исполнителя');
        return;
    }

    if (!albumNameInput.value.trim()) {
        showError('Пожалуйста, введите название альбома');
        return;
    }

    appState.isProcessing = true;
    processButton.disabled = true;

    blurBackground.classList.add('active');
    processingModal.classList.add('active');

    try {
        appState.processedFiles = [];
        const totalFiles = appState.audioFiles.length;

        for (let i = 0; i < totalFiles; i++) {
            const progress = ((i + 1) / totalFiles) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Обработано: ${i + 1}/${totalFiles}`;

            const processedFile = await processSingleFile(
                appState.audioFiles[i],
                appState.coverImage,
                trackTitleInput.value,
                artistNameInput.value,
                albumNameInput.value
            );
            appState.processedFiles.push(processedFile);

            // Искусственная задержка для плавности анимации
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

async function processSingleFile(audioFile, coverImage, title, artist, album) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const writer = new ID3Writer(arrayBuffer);

            // Добавляем обложку если есть
            if (coverImage) {
                const coverArrayBuffer = await coverImage.arrayBuffer();
                writer.setFrame('APIC', {
                    type: 3,
                    data: new Uint8Array(coverArrayBuffer),
                    description: 'Cover'
                });
            }

            // Добавляем текстовые метаданные
            if (title) writer.setFrame('TIT2', title);
            if (artist) writer.setFrame('TPE1', [artist]);
            if (album) writer.setFrame('TALB', album);

            writer.addTag();

            const blob = writer.getBlob();
            const fileName = `${title || 'track'} - ${artist || 'artist'}.mp3`;
            const newFile = new File([blob], fileName, { type: 'audio/mpeg' });

            resolve(newFile);
        } catch (error) {
            reject(error);
        }
    });
}

function showDownloadModal() {
    if (!downloadLinks) return;

    downloadLinks.innerHTML = '';

    appState.processedFiles.forEach((file, index) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(file);
        downloadLink.download = file.name;
        downloadLink.className = 'download-button';
        downloadLink.textContent = file.name;
        downloadLink.style.display = 'block';

        // Для мобильных устройств добавляем дополнительные атрибуты
        downloadLink.setAttribute('target', '_blank');
        downloadLink.setAttribute('rel', 'noopener noreferrer');

        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = 'var(--text-tertiary)';
        fileInfo.style.marginTop = '4px';
        fileInfo.textContent = `Размер: ${(file.size / 1024 / 1024).toFixed(2)} MB`;

        const container = document.createElement('div');
        container.style.marginBottom = '12px';
        container.appendChild(downloadLink);
        container.appendChild(fileInfo);

        downloadLinks.appendChild(container);
    });

    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close-button';
    closeButton.textContent = 'Готово';
    closeButton.addEventListener('click', function() {
        downloadModal.classList.remove('active');
        blurBackground.classList.remove('active');
        resetAppState();
    });

    downloadLinks.appendChild(closeButton);
    downloadModal.classList.add('active');
}

function updateFileList() {
    if (!audioFileList) return;

    audioFileList.innerHTML = '';

    appState.audioFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        const fileSize = document.createElement('div');
        fileSize.className = 'file-size';
        fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;

        fileInfo.appendChild(fileName);
        fileInfo.appendChild(fileSize);

        const fileRemove = document.createElement('div');
        fileRemove.className = 'file-remove';
        fileRemove.textContent = '×';
        fileRemove.title = 'Удалить файл';
        fileRemove.addEventListener('click', (e) => {
            e.stopPropagation();
            appState.audioFiles.splice(index, 1);
            updateFileList();
            validateForm();

            // Сбрасываем значение input при удалении файлов
            if (appState.audioFiles.length === 0) {
                audioFilesInput.value = '';
            }
        });

        fileItem.appendChild(fileInfo);
        fileItem.appendChild(fileRemove);
        audioFileList.appendChild(fileItem);
    });
}

function resetAppState() {
    appState.audioFiles = [];
    appState.coverImage = null;
    appState.processedFiles = [];
    appState.isProcessing = false;

    processButton.disabled = false;

    // Полностью сбрасываем значения inputs
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
}

// Добавляем функцию для принудительного сброса input при клике на зону загрузки
function initFileInputReset() {
    const audioUploadZone = audioFilesInput.closest('.custum-file-upload');
    const coverUploadZone = coverImageInput.closest('.custum-file-upload');

    if (!audioUploadZone || !coverUploadZone) return;

    // Дополнительная защита: при клике на зону загрузки сбрасываем значение,
    // если файлов нет в состоянии приложения
    audioUploadZone.addEventListener('click', function() {
        if (appState.audioFiles.length === 0) {
            audioFilesInput.value = '';
        }
    });

    coverUploadZone.addEventListener('click', function() {
        if (!appState.coverImage) {
            coverImageInput.value = '';
        }
    });
}

// Функция для определения мобильного устройства
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Альтернативный метод скачивания для мобильных устройств
function forceDownload(url, filename) {
    if (isMobileDevice()) {
        // Для мобильных устройств открываем в новом окне
        const newWindow = window.open(url, '_blank');
        if (newWindow) {
            setTimeout(() => {
                newWindow.close();
            }, 1000);
        }
    } else {
        // Для десктопов используем стандартное скачивание
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
