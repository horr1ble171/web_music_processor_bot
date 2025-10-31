// Telegram Web App инициализация
let tg = null;
let isTelegramWebApp = false;

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        isTelegramWebApp = true;
        
        // Развернуть на весь экран
        tg.expand();
        
        // Изменить цвет фона
        tg.setBackgroundColor('#ffffff');
        tg.setHeaderColor('#000000');
        
        console.log('Telegram Web App инициализирован');
    }
}

// Состояние приложения
const appState = {
    audioFiles: [],
    coverImage: null,
    processedFiles: [],
    currentProcessedFile: null
};

// Элементы DOM
const blurBackground = document.getElementById('blurBackground');
const processingModal = document.getElementById('processingModal');
const downloadModal = document.getElementById('downloadModal');
const downloadLinks = document.getElementById('downloadLinks');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const sendToBotButton = document.getElementById('sendToBotButton');
const backButton = document.getElementById('backButton');
const modalButtons = document.getElementById('modalButtons');

// Кнопки
const processButton = document.getElementById('processButton');

// Входные данные
const audioFilesInput = document.getElementById('audioFiles');
const coverImageInput = document.getElementById('coverImage');
const coverPreview = document.getElementById('coverPreview');
const trackTitleInput = document.getElementById('trackTitle');
const artistNameInput = document.getElementById('artistName');
const albumNameInput = document.getElementById('albumName');
const audioFileList = document.getElementById('audioFileList');

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWebApp();
    setupEventListeners();
});

function setupEventListeners() {
    audioFilesInput.addEventListener('change', handleAudioFilesSelection);
    coverImageInput.addEventListener('change', handleCoverImageSelection);
    processButton.addEventListener('click', processAndDownload);
    sendToBotButton.addEventListener('click', handleSendToBot);
    backButton.addEventListener('click', handleBackButton);
}

function handleAudioFilesSelection(event) {
    const files = Array.from(event.target.files);

    const validFiles = files.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return extension === '.mp3';
    });

    if (validFiles.length === 0) {
        showAlert('Пожалуйста, выберите MP3 файлы');
        return;
    }

    appState.audioFiles = appState.audioFiles.concat(validFiles);
    updateFileList();
}

function handleCoverImageSelection(event) {
    const file = event.target.files[0];
    if (!file) return;

    const supportedFormats = ['.jpg', '.jpeg', '.png'];
    const extension = '.' + file.name.split('.').pop().toLowerCase();

    if (!supportedFormats.includes(extension)) {
        showAlert('Пожалуйста, выберите поддерживаемое изображение (JPG, PNG)');
        return;
    }

    appState.coverImage = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        coverPreview.src = e.target.result;
        coverPreview.style.display = 'block';

        document.querySelector('#coverImage ~ .icon').style.display = 'none';
        document.querySelector('#coverImage ~ .text').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function processAndDownload() {
    if (appState.audioFiles.length === 0) {
        showAlert('Пожалуйста, загрузите MP3 файлы');
        return;
    }

    if (!appState.coverImage) {
        showAlert('Пожалуйста, загрузите обложку');
        return;
    }

    if (!trackTitleInput.value.trim()) {
        showAlert('Пожалуйста, введите название трека');
        return;
    }

    if (!artistNameInput.value.trim()) {
        showAlert('Пожалуйста, введите имя исполнителя');
        return;
    }

    if (!albumNameInput.value.trim()) {
        showAlert('Пожалуйста, введите название альбома');
        return;
    }

    showProcessingModal();

    try {
        appState.processedFiles = [];
        const totalFiles = appState.audioFiles.length;

        for (let i = 0; i < totalFiles; i++) {
            updateProgress(i + 1, totalFiles);

            const processedFile = await processSingleFile(
                appState.audioFiles[i],
                appState.coverImage,
                trackTitleInput.value,
                artistNameInput.value,
                albumNameInput.value
            );
            appState.processedFiles.push(processedFile);

            await new Promise(resolve => setTimeout(resolve, 300));
        }

        hideProcessingModal();
        showDownloadModal();

    } catch (error) {
        console.error('Ошибка обработки:', error);
        showAlert('Произошла ошибка при обработке файлов: ' + error.message);
        hideProcessingModal();
    }
}

async function processSingleFile(audioFile, coverImage, title, artist, album) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await audioFile.arrayBuffer();
            const writer = new ID3Writer(arrayBuffer);

            // Добавляем обложку
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

function showProcessingModal() {
    blurBackground.classList.add('active');
    processingModal.classList.add('active');
}

function hideProcessingModal() {
    processingModal.classList.remove('active');
    blurBackground.classList.remove('active');
}

function updateProgress(current, total) {
    const progress = ((current) / total) * 100;
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Обработано: ${current}/${total}`;
}

function showDownloadModal() {
    downloadLinks.innerHTML = '';
    
    // Показываем кнопку отправки в бота только если открыто в Telegram Web App
    if (isTelegramWebApp) {
        sendToBotButton.style.display = 'block';
        appState.currentProcessedFile = appState.processedFiles[0]; // Для простоты берем первый файл
    } else {
        sendToBotButton.style.display = 'none';
    }

    appState.processedFiles.forEach((file, index) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(file);
        downloadLink.download = file.name;
        downloadLink.className = 'download-button';
        downloadLink.textContent = `Скачать "${file.name}"`;
        downloadLink.style.display = 'block';
        downloadLink.style.marginBottom = '10px';

        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = '#666';
        fileInfo.style.marginBottom = '15px';
        fileInfo.textContent = `Размер: ${(file.size / 1024 / 1024).toFixed(2)} MB`;

        downloadLinks.appendChild(downloadLink);
        downloadLinks.appendChild(fileInfo);
    });

    downloadModal.classList.add('active');
    blurBackground.classList.add('active');
}

function handleSendToBot() {
    if (!appState.currentProcessedFile) {
        showAlert('Нет обработанного файла для отправки');
        return;
    }

    if (!isTelegramWebApp || !tg) {
        showAlert('Функция отправки в бота доступна только в Telegram');
        return;
    }

    sendFileToBot(appState.currentProcessedFile);
}

async function sendFileToBot(file) {
    try {
        // Показываем статус загрузки
        const statusDiv = document.createElement('div');
        statusDiv.className = 'upload-status';
        statusDiv.textContent = '📤 Отправка файла в бота...';
        downloadLinks.appendChild(statusDiv);

        // Конвертируем файл в base64 для отправки
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result.split(',')[1];
            
            // Отправляем данные в бота через Telegram Web App
            tg.sendData(JSON.stringify({
                action: 'send_processed_audio',
                filename: file.name,
                data: base64Data,
                mime_type: 'audio/mpeg',
                title: trackTitleInput.value,
                artist: artistNameInput.value
            }));
            
            statusDiv.textContent = '✅ Файл отправлен в бота!';
            statusDiv.className = 'upload-status success';
            
            // Закрываем мини-приложение через 2 секунды
            setTimeout(() => {
                if (tg && tg.close) {
                    tg.close();
                }
            }, 2000);
        };
        
        reader.onerror = function() {
            statusDiv.textContent = '❌ Ошибка при отправке файла';
            statusDiv.className = 'upload-status error';
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Ошибка отправки в бота:', error);
        showAlert('Ошибка при отправке файла в бота: ' + error.message);
    }
}

function handleBackButton() {
    downloadModal.classList.remove('active');
    blurBackground.classList.remove('active');
    resetAppState();
}

function updateFileList() {
    audioFileList.innerHTML = '';

    appState.audioFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileName = document.createElement('div');
        fileName.className = 'file-name';
        fileName.textContent = file.name;

        const fileSize = document.createElement('div');
        fileSize.style.fontSize = '12px';
        fileSize.style.color = '#666';
        fileSize.textContent = `(${(file.size / 1024 / 1024).toFixed(2)} MB)`;

        const fileRemove = document.createElement('div');
        fileRemove.className = 'file-remove';
        fileRemove.textContent = '×';
        fileRemove.addEventListener('click', () => {
            appState.audioFiles.splice(index, 1);
            updateFileList();
        });

        fileItem.appendChild(fileName);
        fileItem.appendChild(fileSize);
        fileItem.appendChild(fileRemove);
        audioFileList.appendChild(fileItem);
    });
}

function resetAppState() {
    appState.audioFiles = [];
    appState.coverImage = null;
    appState.processedFiles = [];
    appState.currentProcessedFile = null;

    audioFilesInput.value = '';
    coverImageInput.value = '';
    trackTitleInput.value = '';
    artistNameInput.value = '';
    albumNameInput.value = '';
    audioFileList.innerHTML = '';
    coverPreview.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = 'Обработано: 0/0';

    document.querySelector('#coverImage ~ .icon').style.display = 'flex';
    document.querySelector('#coverImage ~ .text').style.display = 'flex';
}

function showAlert(message) {
    alert(message);
}
