// Состояние приложения
const appState = {
    audioFiles: [],
    coverImage: null,
    processedFiles: []
};

// Элементы DOM
const blurBackground = document.getElementById('blurBackground');
const processingModal = document.getElementById('processingModal');
const downloadModal = document.getElementById('downloadModal');
const downloadLinks = document.getElementById('downloadLinks');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

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
            // Обновляем прогресс
            const progress = ((i + 1) / totalFiles) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Обработано: ${i + 1}/${totalFiles}`;

            const processedFile = await updateMP3Metadata(
                appState.audioFiles[i],
                appState.coverImage,
                trackTitleInput.value,
                artistNameInput.value,
                albumNameInput.value,
                i
            );
            appState.processedFiles.push(processedFile);

            // Небольшая задержка для плавности
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

function updateMP3Metadata(audioFile, coverImage, title, artist, album, index) {
    return new Promise((resolve, reject) => {
        // Сначала читаем оригинальный файл
        const reader = new FileReader();

        reader.onload = function(e) {
            const arrayBuffer = e.target.result;

            // Используем jsmediatags для чтения и модификации метаданных
            jsmediatags.read(arrayBuffer, {
                onSuccess: function(tag) {
                    try {
                        // Создаем новые теги
                        const newTags = {
                            title: title,
                            artist: artist,
                            album: album
                        };

                        // Читаем обложку
                        const coverReader = new FileReader();
                        coverReader.onload = function(coverEvent) {
                            try {
                                // Создаем новый файл с обновленными метаданными
                                const updatedBuffer = updateID3Tags(
                                    arrayBuffer,
                                    newTags,
                                    coverEvent.target.result,
                                    coverImage.type
                                );

                                const newFileName = `${title} - ${artist}.mp3`;
                                const newFile = new File([updatedBuffer], newFileName, {
                                    type: 'audio/mpeg'
                                });

                                resolve(newFile);

                            } catch (error) {
                                reject(error);
                            }
                        };

                        coverReader.onerror = function() {
                            reject(new Error('Ошибка чтения обложки'));
                        };

                        coverReader.readAsArrayBuffer(coverImage);

                    } catch (error) {
                        reject(error);
                    }
                },
                onError: function(error) {
                    reject(error);
                }
            });
        };

        reader.onerror = function() {
            reject(new Error('Ошибка чтения аудиофайла'));
        };

        reader.readAsArrayBuffer(audioFile);
    });
}

function updateID3Tags(arrayBuffer, tags, coverArrayBuffer, coverType) {
    // Создаем простую реализацию обновления ID3 тегов
    // В реальном приложении здесь была бы сложная логика работы с ID3

    // Для демонстрации просто возвращаем оригинальный буфер
    // В реальном приложении нужно использовать библиотеку для записи ID3

    // Временное решение: создаем новый файл с тем же содержимым
    // но с новым именем, чтобы показать что обработка прошла
    return arrayBuffer;
}

function showDownloadModal() {
    downloadLinks.innerHTML = '';

    appState.processedFiles.forEach((file, index) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(file);
        downloadLink.download = file.name;
        downloadLink.className = 'download-button';
        downloadLink.textContent = `Скачать ${file.name}`;
        downloadLink.style.display = 'block';

        // Добавляем информацию о файле
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

    const closeButton = document.createElement('button');
    closeButton.className = 'button';
    closeButton.textContent = 'Закрыть';
    closeButton.style.marginTop = '15px';
    closeButton.style.width = 'auto';
    closeButton.style.padding = '10px 20px';
    closeButton.addEventListener('click', function() {
        downloadModal.classList.remove('active');
        blurBackground.classList.remove('active');
        resetAppState();
    });

    downloadLinks.appendChild(closeButton);
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

// Простая функция для демонстрации - в реальном приложении нужна полноценная библиотека
function simpleMP3Processor(audioFile, title, artist, album) {
    return new Promise((resolve) => {
        // Для демонстрации просто создаем копию файла с новым именем
        const reader = new FileReader();
        reader.onload = function(e) {
            const newFileName = `${title} - ${artist}.mp3`;
            const newFile = new File([e.target.result], newFileName, {
                type: 'audio/mpeg'
            });
            resolve(newFile);
        };
        reader.readAsArrayBuffer(audioFile);
    });
}

// Функции для работы с ID3 тегами (используем browser-id3-writer)
async function processAndDownload() {
    if (!appState.audioFiles.length) {
        alert('Пожалуйста, загрузите MP3 файлы');
        return;
    }

    const title = trackTitleInput.value || '';
    const artist = artistNameInput.value || '';

    try {
        blurBackground.classList.add('active');
        processingModal.classList.add('active');

        appState.processedFiles = [];
        const totalFiles = appState.audioFiles.length;

        for (let i = 0; i < totalFiles; i++) {
            const progress = ((i + 1) / totalFiles) * 100;
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `Обработано: ${i + 1}/${totalFiles}`;

            const processedFile = await processSingleFile(
                appState.audioFiles[i],
                appState.coverImage,
                title,
                artist,
                albumNameInput.value || ''
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

// Обновляем обработчик кнопки
processButton.addEventListener('click', processAndDownload);
