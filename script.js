// Состояние приложения
const appState = {
    audioFiles: [],
    coverImage: null,
    processedFiles: [],
    isTelegramWebApp: false
};

// Элементы DOM
const blurBackground = document.getElementById('blurBackground');
const processingModal = document.getElementById('processingModal');
const downloadModal = document.getElementById('downloadModal');
const downloadLinks = document.getElementById('downloadLinks');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const sendToBotButton = document.getElementById('sendToBotButton');
const closeModalButton = document.getElementById('closeModalButton');

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

// Токен бота (замените на ваш)
const BOT_TOKEN = "8486286436:AAFLyKilUp1yNQusRd2qrzeR2IMjm_iTl44";

// Инициализация Telegram Web App
function initTelegramWebApp() {
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        appState.isTelegramWebApp = true;
        
        // Расширяем на весь экран
        tg.expand();
        
        // Применяем стили для мини-приложения
        document.body.classList.add('mini-app-mode');
        
        // Включаем кнопку закрытия
        tg.BackButton.show();
        tg.BackButton.onClick(() => {
            tg.close();
        });
        
        console.log('Telegram Web App initialized in fullscreen mode');
    }
}

// Получаем user_id из Telegram Web App
function getTelegramUserId() {
    if (window.Telegram && window.Telegram.WebApp) {
        return window.Telegram.WebApp.initDataUnsafe?.user?.id;
    }
    return null;
}

// Функция для отправки файла через Telegram Bot API
async function sendFileToBot(file, filename) {
    const userId = getTelegramUserId();
    
    if (!userId) {
        throw new Error('Не удалось определить пользователя');
    }

    try {
        // Создаем FormData для отправки файла
        const formData = new FormData();
        formData.append('chat_id', userId);
        formData.append('document', file, filename);
        formData.append('caption', `Обработанный трек: ${filename}`);

        // Отправляем файл напрямую к Telegram Bot API
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        
        if (result.ok) {
            return true;
        } else {
            console.error('Ошибка Telegram API:', result);
            throw new Error(result.description || 'Ошибка отправки файла');
        }
    } catch (error) {
        console.error('Ошибка при отправке файла:', error);
        throw error;
    }
}

// Функция для отправки всех файлов в бота
async function sendFilesToBot() {
    if (appState.processedFiles.length === 0) {
        alert('Нет файлов для отправки');
        return;
    }

    const sendButton = sendToBotButton;
    const originalText = sendButton.textContent;
    sendButton.textContent = 'Отправка...';
    sendButton.disabled = true;

    try {
        let successCount = 0;
        const totalFiles = appState.processedFiles.length;
        
        for (let i = 0; i < totalFiles; i++) {
            const file = appState.processedFiles[i];
            
            // Обновляем прогресс
            sendButton.textContent = `Отправка ${i + 1}/${totalFiles}...`;
            
            try {
                // Отправляем файл
                const success = await sendFileToBot(file, file.name);
                if (success) {
                    successCount++;
                    console.log(`✅ Файл отправлен: ${file.name}`);
                }
            } catch (error) {
                console.error(`❌ Ошибка отправки файла ${file.name}:`, error);
            }
            
            // Задержка между отправками (1 секунда)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Показываем результат
        if (successCount > 0) {
            if (successCount === totalFiles) {
                alert(`✅ Все ${successCount} файлов успешно отправлены в бота!`);
            } else {
                alert(`✅ Успешно отправлено ${successCount} из ${totalFiles} файлов в бота!`);
            }
            
            // Закрываем модальное окно после успешной отправки
            setTimeout(() => {
                downloadModal.classList.remove('active');
                blurBackground.classList.remove('active');
                resetAppState();
            }, 2000);
        } else {
            alert('❌ Не удалось отправить файлы. Проверьте подключение к интернету и попробуйте еще раз.');
        }
        
    } catch (error) {
        console.error('Общая ошибка при отправке файлов:', error);
        alert('❌ Произошла ошибка при отправке файлов. Попробуйте еще раз.');
    } finally {
        sendButton.textContent = originalText;
        sendButton.disabled = false;
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    initTelegramWebApp();
    
    // Обработчик для кнопки закрытия модального окна
    closeModalButton.addEventListener('click', function() {
        downloadModal.classList.remove('active');
        blurBackground.classList.remove('active');
        resetAppState();
    });
    
    // Обработчик для кнопки отправки в бота
    sendToBotButton.addEventListener('click', sendFilesToBot);
});

// Обработчики событий
audioFilesInput.addEventListener('change', handleAudioFilesSelection);
coverImageInput.addEventListener('change', handleCoverImageSelection);
processButton.addEventListener('click', handleProcessFiles);

// Функции обработки
function handleAudioFilesSelection(event) {
    const files = Array.from(event.target.files);

    const validFiles = files.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return extension === '.mp3';
    });

    if (validFiles.length === 0) {
        alert('Пожалуйста, выберите MP3 файлы');
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
        alert('Пожалуйста, выберите поддерживаемое изображение (JPG, PNG)');
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

async function handleProcessFiles() {
    if (appState.audioFiles.length === 0) {
        alert('Пожалуйста, загрузите MP3 файлы');
        return;
    }

    if (!appState.coverImage) {
        alert('Пожалуйста, загрузите обложку');
        return;
    }

    if (!trackTitleInput.value.trim()) {
        alert('Пожалуйста, введите название трека');
        return;
    }

    if (!artistNameInput.value.trim()) {
        alert('Пожалуйста, введите имя исполнителя');
        return;
    }

    if (!albumNameInput.value.trim()) {
        alert('Пожалуйста, введите название альбома');
        return;
    }

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

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        processingModal.classList.remove('active');
        showDownloadModal();

    } catch (error) {
        console.error('Ошибка обработки:', error);
        alert('Произошла ошибка при обработке файлов: ' + error.message);
        processingModal.classList.remove('active');
        blurBackground.classList.remove('active');
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
    downloadLinks.innerHTML = '';

    // Показываем кнопку "Отправить в бота" только если мы в Telegram Web App
    if (appState.isTelegramWebApp) {
        sendToBotButton.style.display = 'block';
    } else {
        sendToBotButton.style.display = 'none';
    }

    appState.processedFiles.forEach((file, index) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(file);
        downloadLink.download = file.name;
        downloadLink.className = 'download-button';
        downloadLink.textContent = `Скачать ${file.name}`;
        downloadLink.style.display = 'block';

        const fileInfo = document.createElement('div');
        fileInfo.style.fontSize = '12px';
        fileInfo.style.color = '#666';
        fileInfo.style.marginTop = '5px';
        fileInfo.textContent = `Размер: ${(file.size / 1024 / 1024).toFixed(2)} MB`;

        const container = document.createElement('div');
        container.style.marginBottom = '15px';
        container.appendChild(downloadLink);
        container.appendChild(fileInfo);

        downloadLinks.appendChild(container);
    });

    downloadModal.classList.add('active');
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

    processButton.classList.remove('sent');
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

// Обновляем обработчик кнопки
processButton.addEventListener('click', handleProcessFiles);
