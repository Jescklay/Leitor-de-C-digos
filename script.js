let codeReader = null;
let selectedDeviceId = null;
let audioCtx = null;
let isFrozen = false;

const DEFAULT_PRODUCTS = [
    { id: "1", barcode: "7891000100101", name: "Arroz Tipo 1 5kg", priceRetail: 28.90 },
    { id: "2", barcode: "7891000200202", name: "Feijão Preto 1kg", priceRetail: 8.50 },
    { id: "3", barcode: "7891000300303", name: "Óleo de Soja 900ml", priceRetail: 6.80 },
    { id: "4", barcode: "7891000400404", name: "Leite Integral 1L", priceRetail: 4.99 },
    { id: "5", barcode: "7891000500505", name: "Café Torrado e Moído 500g", priceRetail: 16.90 }
];

window.addEventListener('DOMContentLoaded', () => {
    initAudioContext();
    startZXingScanner();

    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
});

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Emite bip sonoro agudo de confirmação
function playSuccessBeep() {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1900, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.09);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.09);
    } catch (e) {
        console.log("Áudio bloqueado pelo navegador:", e);
    }
}

function startZXingScanner() {
    const statusEl = document.getElementById('scanner-status');
    const errorCard = document.getElementById('error-card');
    const errorMsg = document.getElementById('error-msg');
    const resultCard = document.getElementById('result-card');

    resultCard.classList.add('hidden');
    isFrozen = false;

    codeReader = new ZXing.BrowserBarcodeReader();

    codeReader.listVideoInputDevices()
        .then(videoInputDevices => {
            if (videoInputDevices.length === 0) {
                throw new Error("Nenhuma câmera encontrada no dispositivo.");
            }

            // Prioriza a câmera traseira (environment)
            selectedDeviceId = videoInputDevices[0].deviceId;
            for (const device of videoInputDevices) {
                if (/back|rear|traseira|environment/i.test(device.label)) {
                    selectedDeviceId = device.deviceId;
                    break;
                }
            }

            statusEl.textContent = 'Câmera Ativa';

            // Inicia a decodificação contínua
            codeReader.decodeFromVideoDevice(selectedDeviceId, 'video-preview', (result, err) => {
                if (result && !isFrozen) {
                    handleSuccessfulScan(result.text);
                }
            });
        })
        .catch(err => {
            console.error("Erro ZXing:", err);
            statusEl.textContent = 'Erro na câmera';
            errorCard.classList.remove('hidden');
            errorMsg.textContent = "Não foi possível acessar a câmera. Verifique as permissões do navegador.";
        });
}

function handleSuccessfulScan(barcodeText) {
    if (isFrozen) return;
    isFrozen = true;

    // 1. Congela a leitura e emite o bip
    playSuccessBeep();
    
    // Para temporariamente o leitor da câmera
    if (codeReader) {
        codeReader.reset();
    }

    // 2. Busca o produto localmente para exibir nome e preço no card
    let products = JSON.parse(localStorage.getItem('isabel_products') || JSON.stringify(DEFAULT_PRODUCTS));
    let product = products.find(p => p.barcode === barcodeText || (p.name && p.name.toLowerCase() === barcodeText.toLowerCase()));

    const productName = product ? product.name : "Produto Cadastrado";
    
    // Exibe o card de resultado congelado
    document.getElementById('scanned-code-display').textContent = barcodeText;
    document.getElementById('scanned-product-info').textContent = productName;
    document.getElementById('result-card').classList.remove('hidden');
    document.getElementById('scanner-status').textContent = 'Item Capturado';

    // 3. Sincroniza imediatamente com o PDV principal via localStorage
    const payload = {
        barcode: barcodeText,
        timestamp: Date.now()
    };
    localStorage.setItem('ultimo_codigo_bipado', JSON.stringify(payload));
}

function restartScanner() {
    document.getElementById('result-card').classList.add('hidden');
    startZXingScanner();
}