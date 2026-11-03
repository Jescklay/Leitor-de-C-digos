let html5QrCode = null;
let audioCtx = null;
let isProcessing = false;

// Lista padrão de fallback caso o localStorage ainda não tenha produtos cadastrados
const DEFAULT_PRODUCTS = [
    { id: "1", barcode: "7891000100101", name: "Arroz Tipo 1 5kg", priceRetail: 28.90 },
    { id: "2", barcode: "7891000200202", name: "Feijão Preto 1kg", priceRetail: 8.50 },
    { id: "3", barcode: "7891000300303", name: "Óleo de Soja 900ml", priceRetail: 6.80 },
    { id: "4", barcode: "7891000400404", name: "Leite Integral 1L", priceRetail: 4.99 },
    { id: "5", barcode: "7891000500505", name: "Café Torrado e Moído 500g", priceRetail: 16.90 }
];

window.onload = function() {
    initAudioContext();
    startCameraWithPermissionHandling();

    // Desbloqueia o contexto de áudio do navegador no primeiro toque do usuário
    document.addEventListener('click', initAudioContext, { once: true });
    document.addEventListener('touchstart', initAudioContext, { once: true });
};

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Emite bip sonoro agudo estilo pistola a laser
function playLaserBeep() {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1900, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
        console.log("Áudio bloqueado:", e);
    }
}

// Inicializa a câmera tratando explicitamente permissões e erros de hardware
function startCameraWithPermissionHandling() {
    const statusEl = document.getElementById('scanner-status');
    const errorBox = document.getElementById('scanner-error-container');
    const errorTitle = document.getElementById('error-title');
    const errorMessage = document.getElementById('error-message');

    html5QrCode = new Html5Qrcode("reader");

    const qrCodeSuccessCallback = (decodedText) => {
        if (isProcessing || !decodedText) return;
        isProcessing = true;

        playLaserBeep();
        processScannedCode(decodedText.trim());

        // Pausa breve de 1.2s para evitar leituras duplas do mesmo código
        setTimeout(() => {
            isProcessing = false;
        }, 1200);
    };

    const config = { 
        fps: 20, 
        qrbox: { width: 260, height: 140 },
        aspectRatio: 1.0
    };

    // Solicita a câmera traseira ('environment')
    html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback
    ).then(() => {
        statusEl.textContent = 'Câmera Ativa';
    }).catch(err => {
        console.error("Erro detalhado ao acessar câmera:", err);
        statusEl.textContent = 'Erro na câmera';
        
        errorBox.classList.remove('hidden');
        
        let errStr = String(err).toLowerCase();
        if (errStr.includes('permission') || errStr.includes('notallowed') || errStr.includes('denied')) {
            errorTitle.textContent = "Permissão Negada";
            errorMessage.textContent = "O acesso à câmera foi bloqueado. Por favor, permita o uso da câmera nas configurações do seu navegador para continuar.";
        } else if (errStr.includes('notfound') || errStr.includes('devicesnotfound')) {
            errorTitle.textContent = "Câmera Não Encontrada";
            errorMessage.textContent = "Nenhuma câmera traseira foi detectada neste dispositivo.";
        } else {
            errorTitle.textContent = "Erro ao Iniciar Câmera";
            errorMessage.textContent = "Não foi possível iniciar o visor da câmera. Verifique se outra aba ou aplicativo está usando a câmera.";
        }
    });
}

function processScannedCode(code) {
    const statusEl = document.getElementById('scanner-status');
    
    // Recupera os produtos do localStorage sincronizados com o PDV
    let products = JSON.parse(localStorage.getItem('isabel_products') || JSON.stringify(DEFAULT_PRODUCTS));
    let product = products.find(p => p.barcode === code || (p.name && p.name.toLowerCase() === code.toLowerCase()));

    if (product) {
        // Recupera o carrinho atual
        let currentCart = JSON.parse(localStorage.getItem('isabel_current_cart') || '[]');
        const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

        if (existingIndex > -1) {
            currentCart[existingIndex].qty += 1;
            currentCart[existingIndex].total = currentCart[existingIndex].qty * currentCart[existingIndex].price;
        } else {
            currentCart.push({
                product: product,
                qty: 1,
                price: product.priceRetail || product.price || 0,
                total: product.priceRetail || product.price || 0
            });
        }

        // Salva no localStorage (dispara instantaneamente o evento 'storage' no PDV do computador)
        localStorage.setItem('isabel_current_cart', JSON.stringify(currentCart));

        // Exibe feedback visual
        showFeedbackCard(product);
        statusEl.textContent = `Bipado: ${product.name}`;
        
        setTimeout(() => {
            statusEl.textContent = 'Câmera Ativa';
        }, 1500);
    } else {
        statusEl.textContent = `Não cadastrado: ${code}`;
        setTimeout(() => {
            statusEl.textContent = 'Câmera Ativa';
        }, 2000);
    }
}

function showFeedbackCard(product) {
    const card = document.getElementById('feedback-card');
    document.getElementById('fb-product-name').textContent = product.name;
    document.getElementById('fb-product-code').textContent = `EAN: ${product.barcode}`;
    document.getElementById('fb-product-price').textContent = `R$ ${(product.priceRetail || product.price || 0).toFixed(2)}`;

    card.classList.add('show');

    // Remove o card após 2.5 segundos
    if (window.feedbackTimeout) clearTimeout(window.feedbackTimeout);
    window.feedbackTimeout = setTimeout(() => {
        card.classList.remove('show');
    }, 2500);
}