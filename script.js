if (window.Telegram && window.Telegram.WebApp) {
  Telegram.WebApp.ready();
  try { Telegram.WebApp.expand(); } catch (e) {}
}

const state = { audioFiles: [], cover: null, processed: [] };

const audioInput = document.getElementById("audioFiles");
const coverInput = document.getElementById("coverImage");
const titleInput = document.getElementById("trackTitle");
const artistInput = document.getElementById("artistName");
const albumInput = document.getElementById("albumName");
const processBtn = document.getElementById("processButton");
const sendBtn = document.getElementById("sendToBotButton");
const links = document.getElementById("downloadLinks");

audioInput.addEventListener("change", e => state.audioFiles = Array.from(e.target.files));
coverInput.addEventListener("change", e => state.cover = e.target.files[0]);

processBtn.onclick = async () => {
  if (!state.audioFiles.length) return alert("Выберите MP3-файлы");
  if (!state.cover) return alert("Выберите обложку");
  if (!titleInput.value || !artistInput.value) return alert("Введите название и исполнителя");
  state.processed = [];

  for (const file of state.audioFiles) {
    const buf = await file.arrayBuffer();
    const writer = new ID3Writer(buf);
    const coverBuf = await state.cover.arrayBuffer();
    writer.setFrame("TIT2", titleInput.value)
          .setFrame("TPE1", [artistInput.value])
          .setFrame("TALB", albumInput.value || "")
          .setFrame("APIC", { type: 3, data: new Uint8Array(coverBuf), description: "Cover" });
    writer.addTag();
    const blob = writer.getBlob();
    const newFile = new File([blob], `${artistInput.value} - ${titleInput.value}.mp3`, { type: "audio/mpeg" });
    state.processed.push(newFile);
  }

  links.innerHTML = "";
  for (const f of state.processed) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.textContent = "⬇ " + f.name;
    links.appendChild(a);
  }
  alert("✅ Обработка завершена!");
};

sendBtn.onclick = async () => {
  if (!state.processed.length) return alert("Нет файлов для отправки.");
  const files = [];
  for (const f of state.processed) {
    const dataURL = await fileToDataURL(f);
    files.push({ filename: f.name, dataURL });
  }
  const payload = { files };
  Telegram.WebApp.sendData(JSON.stringify(payload));
  alert("📨 Файлы отправлены в бот. Проверьте чат!");
};

function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
