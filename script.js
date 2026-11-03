/* ========================================================
   CONFIGURAÇÃO DO FIREBASE (INSIRA SUAS CREDENCIAIS AQUI)
   ======================================================== */
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    databaseURL: "https://seu-projeto-default-rtdb.firebaseio.com",
    projectId: "seu-projeto"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();
const cartRef = db.ref('isabelvariedades/carrinhoAtual');
const productsRef = db.ref('isabelvariedades/produtos');

let codeReader = null;
let selectedDeviceId = null;
let audioCtx = null;
let isFrozen = false;
let cloudProducts = [];

const DEFAULT_PRODUCTS = [
    { id: "1", barcode: "7891000100101", name: "Arroz Tipo 1 5kg", priceRetail: 28.90 },
    { id: "2", barcode: "7891000200202", name: "Feijão Preto 1kg", priceRetail: 8.50 },
    { id: "3", barcode: "7891000300303", name: "Óleo de Soja 900ml", priceRetail: 6.80 },
    { id: "4", barcode: "7891000400404", name: "Leite Integral 1L", priceRetail: 4.99 },
    { id: "5", barcode: "7891000500505", name: "Café Torrado e Moído 500g", priceRetail: 16.90 }
];

window.addEventListener('DOMContentLoaded', () => {
    initAudioContext();
    loadCloudProducts();
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

function loadCloudProducts() {
    productsRef.once('value').then(snapshot => {
        const data = snapshot.val();
        cloudProducts = (Array.isArray(data) && data.length > 0) ? data : DEFAULT_PRODUCTS;
    }).catch(err => {
        console.log("Usando produtos padrão (offline):", err);
        cloudProducts = DEFAULT_PRODUCTS;
    });
}

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
        console.log("Áudio bloqueado:", e);
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
            if (videoInputDevices.length === 0) throw new Error("Nenhuma câmera encontrada.");

            selectedDeviceId = videoInputDevices[0].deviceId;
            for (const device of videoInputDevices) {
                if (/back|rear|traseira|environment/i.test(device.label)) {
                    selectedDeviceId = device.deviceId;
                    break;
                }
            }

            statusEl.textContent = 'Câmera Ativa';

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
            errorMsg.textContent = "Não foi possível acessar a câmera do dispositivo.";
        });
}

function handleSuccessfulScan(barcodeText) {
    if (isFrozen) return;
    isFrozen = true;

    playSuccessBeep();
    
    if (codeReader) {
        codeReader.reset();
    }

    let product = cloudProducts.find(p => p.barcode === barcodeText || (p.name && p.name.toLowerCase() === barcodeText.toLowerCase()));
    
    if (!product) {
        product = {
            id: String(Date.now()),
            barcode: barcodeText,
            name: `Produto (${barcodeText})`,
            priceRetail: 10.00,
            stock: 99
        };
    }

    document.getElementById('scanned-code-display').textContent = barcodeText;
    document.getElementById('scanned-product-info').textContent = product.name;
    document.getElementById('result-card').classList.remove('hidden');
    document.getElementById('scanner-status').textContent = 'Item Enviado';

    // Envia o item para o carrinho compartilhado na nuvem (Firebase)
    cartRef.once('value').then(snapshot => {
        let currentCart = snapshot.val();
        currentCart = Array.isArray(currentCart) ? currentCart : [];

        const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

        if (existingIndex > -1) {
            currentCart[existingIndex].qty += 1;
            currentCart[existingIndex].total = currentCart[existingIndex].qty * currentCart[existingIndex].priceRetail;
        } else {
            currentCart.push({
                product: product,
                qty: 1,
                price: product.priceRetail || 0,
                total: product.priceRetail || 0
            });
        }

        cartRef.set(currentCart).catch(err => console.error("Erro ao sincronizar com Firebase:", err));
    });
}

function restartScanner() {
    document.getElementById('result-card').classList.add('hidden');
    startZXingScanner();
}