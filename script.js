/* === Minimax Update v2 (Integrated into main render pipeline) === */

// HÀNG CHỜ TXT (Batch Queue) — tích hợp trực tiếp vào pipeline gốc
window.miniBatchQueue = [];
window.miniBatchRunning = false;

// Tạo input chọn nhiều TXT
const batchTxtInput = document.createElement('input');
batchTxtInput.type = 'file';
batchTxtInput.multiple = true;
batchTxtInput.accept = '.txt';
batchTxtInput.style.display = 'none';
batchTxtInput.addEventListener('change', e => enqueueBatchTxt(e.target.files));
document.body.appendChild(batchTxtInput);

// Hàm mở chọn file TXT
function openBatchTxtUploader() {
    batchTxtInput.click();
}

// Thêm vào menu Tampermonkey
if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('🌐 Batch TXT (hàng chờ render)', openBatchTxtUploader);
}

// Đưa TXT vào hàng chờ
function enqueueBatchTxt(files) {
    for (const f of files) {
        if (f.name.endsWith('.txt')) {
            miniBatchQueue.push({
                name: f.name,
                file: f,
                status: 'pending',
            });
            addLogEntry(`📄 Thêm file TXT vào hàng chờ: ${f.name}`, 'info');
        }
    }
    runBatchQueue();
}

// Chạy hàng chờ, tích hợp vào pipeline render chunk gốc của bạn
async function runBatchQueue() {
    if (miniBatchRunning) return;
    miniBatchRunning = true;

    while (miniBatchQueue.length > 0) {
        const item = miniBatchQueue.shift();
        item.status = 'processing';
        addLogEntry(`▶️ Đang xử lý TXT: ${item.name}`, 'info');

        const text = await item.file.text();
        
        // Tách chunk bằng hàm split hiện tại của script gốc
        const chunks = smartSplitter(text);

        addLogEntry(`📚 Split ${item.name}: ${chunks.length} chunk`, 'info');

        // Nạp chunk vào hệ thống render gốc
        await runMinimaxRenderPipeline(chunks, item.name);

        addLogEntry(`✅ Hoàn thành TXT: ${item.name}`, 'success');
    }

    miniBatchRunning = false;
}

/* === TÍCH HỢP TỰ ĐỘNG TẢI FILE SAU KHI XỬ LÝ – dựa vào pipeline gốc === */
window.autoDownloadAudio = function(blob, baseName) {
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = baseName.replace(/\.txt$/, '') + '.mp3';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        addLogEntry(`💾 Auto-save âm thanh: ${a.download}`, 'success');
    } catch (e) {
        addLogEntry(`❌ Lỗi auto-save: ${e.message}`, 'error');
    }
};

/* === KẾT NỐI VỚI PIPELINE CHÍNH ===
   Hàm này gắn kết batch TXT vào hành vi tạo âm thanh sẵn có của bạn
*/
async function runMinimaxRenderPipeline(chunks, baseName) {
    try {
        // Reset trạng thái hệ thống gốc
        window.chunkStatus = [];
        window.chunkBlobs = [];

        addLogEntry(`🚀 Bắt đầu render batch: ${baseName}`, 'info');

        for (let i = 0; i < chunks.length; i++) {
            const textChunk = chunks[i];
            addLogEntry(`🎧 Render chunk ${i+1}/${chunks.length}`, 'info');

            // Hàm gốc tạo audio chunk — bạn đã có sẵn trong pipeline
            const audioBlob = await generateAudioFromText(textChunk);

            window.chunkBlobs.push(audioBlob);
            window.chunkStatus.push('success');

            // Auto-save từng chunk khi xong
            autoDownloadAudio(audioBlob, `${baseName}_chunk_${i+1}`);
        }

        // Ghép file cuối cùng (logic gốc)
        const finalBlob = new Blob(window.chunkBlobs, { type: 'audio/mp3' });
        autoDownloadAudio(finalBlob, `${baseName}_FULL`);

        addLogEntry(`🏁 Hoàn thành toàn bộ: ${baseName}`, 'success');

    } catch (e) {
        addLogEntry(`❌ Lỗi pipeline batch: ${e.message}`, 'error');
    }
}

/* === MULTI-VOICE MODE — UPDATE v3 === */

/*
📌 CHẾ ĐỘ MULTI-VOICE (B)
---------------------------------------
✔ Cho phép 1 file TXT → Render ra N giọng khác nhau
✔ Tự động tải từng bản audio theo từng giọng
✔ Tích hợp thẳng vào pipeline batch hiện tại
✔ Không cần UI mới (theo yêu cầu B + 3B)

CÁCH HOẠT ĐỘNG:
- Người dùng khai báo danh sách giọng nói trong biến multiVoices[]
- Mỗi file TXT → mỗi giọng sẽ render toàn bộ chunk → tạo file FULL riêng
- Tự động đặt tên file:  <tenfile>__<voice>.mp3
*/

// === 1. KHAI BÁO DANH SÁCH GIỌNG MUỐN RENDER ===
// Bạn chỉ cần sửa mảng này để thêm / bớt giọng nói
window.multiVoices = [
    "Vietnamese Female 1",
    "Vietnamese Female 2",
    "Vietnamese Male 1",
    // Thêm giọng tuỳ ý...
];

addLogEntry(`🎤 Multi-Voice Mode kích hoạt: ${multiVoices.length} giọng`, 'info');

// === 2. PIPELINE CHÍNH CHO MULTI-VOICE ===
async function runMinimaxRenderPipeline(chunks, baseName) {
    try {
        addLogEntry(`🚀 MULTI-VOICE: Bắt đầu xử lý ${baseName}`, 'info');

        for (const voice of multiVoices) {
            addLogEntry(`🎙️ Render với giọng: ${voice}`, 'info');

            // Reset kết quả theo từng voice
            window.chunkStatus = [];
            window.chunkBlobs = [];

            for (let i = 0; i < chunks.length; i++) {
                const textChunk = chunks[i];

                addLogEntry(`🔊 [${voice}] Chunk ${i+1}/${chunks.length}`, 'info');

                // Hàm gốc tạo âm thanh từ văn bản, truyền thêm voice
                const audioBlob = await generateAudioFromText(textChunk, voice);

                window.chunkBlobs.push(audioBlob);
                window.chunkStatus.push('success');

                // Auto-save từng chunk riêng theo voice
                autoDownloadAudio(audioBlob, `${baseName}__${voice}__chunk_${i+1}`);
            }

            // Ghép file cuối của từng voice
            const finalBlob = new Blob(window.chunkBlobs, { type: 'audio/mp3' });
            autoDownloadAudio(finalBlob, `${baseName}__${voice}__FULL`);

            addLogEntry(`✅ Hoàn tất giọng ${voice}`, 'success');
        }

        addLogEntry(`🏁 Hoàn thành MULTI-VOICE cho: ${baseName}`, 'success');

    } catch (e) {
        addLogEntry(`❌ Lỗi MULTI-VOICE: ${e.message}`, 'error');
    }
}

/* === KẾT THÚC UPDATE v3 (Multi-Voice) === */

// --- 1. Batch TXT Upload ---
// Cho phép chọn nhiều file TXT cùng lúc và đưa vào hàng chờ render
const batchTxtQueue = [];

function handleBatchTxtUpload(files) {
  for (const file of files) {
    if (file.name.endsWith('.txt')) {
      batchTxtQueue.push({ name: file.name, file, status: 'pending' });
    }
  }
  processBatchTxtQueue();
}

async function processBatchTxtQueue() {
  if (processBatchTxtQueue.running) return;
  processBatchTxtQueue.running = true;

  while (batchTxtQueue.length > 0) {
    const item = batchTxtQueue.shift();
    item.status = 'processing';

    const text = await item.file.text();
    await renderTextToAudio(text, item.name);

    item.status = 'done';
  }

  processBatchTxtQueue.running = false;
}

// Gắn listener cho input file TXT hàng loạt
const batchTxtInput = document.createElement('input');
batchTxtInput.type = 'file';
batchTxtInput.multiple = true;
batchTxtInput.accept = '.txt';
batchTxtInput.style.display = 'none';
batchTxtInput.addEventListener('change', e => handleBatchTxtUpload(e.target.files));
document.body.appendChild(batchTxtInput);

function openBatchTxtUploader() {
  batchTxtInput.click();
}

// --- 2. Auto-save từng file âm thanh sau khi render xong ---
async function renderTextToAudio(text, baseName) {
  const audioBlob = await generateAudioFromText(text); // hàm gốc xử lý render âm thanh
  autoDownloadAudio(audioBlob, baseName);
}

function autoDownloadAudio(blob, baseName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = baseName.replace(/\.txt$/, '') + '.mp3';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- 3. Không thêm UI, xử lý tự động (theo yêu cầu 3B) ---
// Chỉ thêm menu trong Tampermonkey để kích hoạt tải TXT hàng loạt
if (typeof GM_registerMenuCommand !== 'undefined') {
  GM_registerMenuCommand('Tải nhiều TXT để render', openBatchTxtUploader);
}

// Giữ nguyên các chức năng khác của script gốc */ 
