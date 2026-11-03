const DEFAULT_PRODUCTS = [
    { id: "1", barcode: "7891000100101", name: "Arroz Tipo 1 5kg", category: "Mercearia", priceRetail: 28.90, priceWholesale: 26.50, stock: 45 },
    { id: "2", barcode: "7891000200202", name: "Feijão Preto 1kg", category: "Mercearia", priceRetail: 8.50, priceWholesale: 7.90, stock: 60 },
    { id: "3", barcode: "7891000300303", name: "Óleo de Soja 900ml", category: "Mercearia", priceRetail: 6.80, priceWholesale: 6.20, stock: 80 },
    { id: "4", barcode: "7891000400404", name: "Leite Integral 1L", category: "Laticínios", priceRetail: 4.99, priceWholesale: 4.50, stock: 120 },
    { id: "5", barcode: "7891000500505", name: "Café Torrado e Moído 500g", category: "Mercearia", priceRetail: 16.90, priceWholesale: 15.20, stock: 35 }
];

let products = [];
let salesHistory = [];
let currentCart = [];
let cashMovements = [];
let activeDiscount = { type: 'fixed', value: 0 };
let audioCtx = null;

window.onload = function() {
    loadInitialData();
    setupEventListeners();
    setupStorageSyncListener(); // Escuta os disparos do leitor mobile em tempo real
    renderCartUI();

    const searchInput = document.getElementById('pdv-search-input');
    if(searchInput) searchInput.focus();
};

function loadInitialData() {
    const savedSales = localStorage.getItem('isabel_sales');
    salesHistory = savedSales ? JSON.parse(savedSales) : [];

    const savedCash = localStorage.getItem('isabel_cash');
    cashMovements = savedCash ? JSON.parse(savedCash) : [
        { id: Date.now(), time: new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}), type: 'suprimento', amount: 150.00, note: 'Abertura de caixa' }
    ];

    const savedDiscount = localStorage.getItem('isabel_discount');
    activeDiscount = savedDiscount ? JSON.parse(savedDiscount) : { type: 'fixed', value: 0 };

    const savedCart = localStorage.getItem('isabel_current_cart');
    currentCart = savedCart ? JSON.parse(savedCart) : [];

    const savedProducts = localStorage.getItem('isabel_products');
    products = savedProducts ? JSON.parse(savedProducts) : DEFAULT_PRODUCTS;
}

/* ========================================================
   LISTENER QUE CAPTURA O CÓDIGO ENVIADO PELO LEITOR MOBILE
   ======================================================== */
function setupStorageSyncListener() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'ultimo_codigo_bipado' && event.newValue) {
            try {
                const data = JSON.parse(event.newValue);
                const barcode = data.barcode;
                
                if (barcode) {
                    const product = products.find(p => p.barcode === barcode || (p.name && p.name.toLowerCase() === barcode.toLowerCase()));
                    
                    if (product) {
                        addProductToCart(product);
                        showNotification(`Produto "${product.name}" adicionado via Leitor Mobile!`, 'success');
                    } else {
                        showNotification(`Produto com código "${barcode}" não cadastrado no estoque!`, 'error');
                    }
                }
            } catch (e) {
                console.error("Erro ao processar código do leitor:", e);
            }
        }
    });
}

function updateCloudCart() {
    localStorage.setItem('isabel_current_cart', JSON.stringify(currentCart));
}

function playLaserBeepSound() {
    try {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) audioCtx = new AudioContextClass();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1900, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.08);
    } catch (e) {
        console.log("Erro áudio PDV:", e);
    }
}

function setupEventListeners() {
    const pdvInput = document.getElementById('pdv-search-input');
    if(pdvInput) {
        pdvInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleManualAddProduct();
            }
        });
    }
}

function handleManualAddProduct() {
    const input = document.getElementById('pdv-search-input');
    const query = input.value.trim();
    if(!query) return;

    const product = products.find(p => p.barcode === query || p.name.toLowerCase() === query.toLowerCase());
    if(product) {
        addProductToCart(product);
        input.value = '';
    } else {
        showNotification('Produto não encontrado!', 'error');
    }
}

function addProductToCart(product, qty = 1) {
    playLaserBeepSound();
    if(product.stock <= 0) {
        showNotification(`Atenção: "${product.name}" sem estoque!`, 'error');
    }

    const existingIndex = currentCart.findIndex(item => item.product.id === product.id);

    if(existingIndex > -1) {
        currentCart[existingIndex].qty += qty;
        currentCart[existingIndex].total = currentCart[existingIndex].qty * currentCart[existingIndex].price;
    } else {
        currentCart.push({
            product: product,
            qty: qty,
            price: product.priceRetail || product.price || 0,
            total: qty * (product.priceRetail || product.price || 0)
        });
    }

    updateCloudCart();
    renderCartUI();
}

function renderCartUI() {
    const tbody = document.getElementById('cart-items-tbody');
    const emptyState = document.getElementById('cart-empty-state');
    const itemCountEl = document.getElementById('cart-item-count');
    const finishBtn = document.getElementById('btn-finish-sale');

    if(!tbody) return;
    if(itemCountEl) itemCountEl.textContent = `${currentCart.length} item(s)`;

    if(currentCart.length === 0) {
        tbody.innerHTML = '';
        if(emptyState) emptyState.classList.remove('hidden');
        if(finishBtn) finishBtn.disabled = true;
        updateTotalsSummary(0);
        return;
    }

    if(emptyState) emptyState.classList.add('hidden');
    if(finishBtn) finishBtn.disabled = false;

    let subtotal = 0;
    tbody.innerHTML = currentCart.map((item, idx) => {
        subtotal += item.total;
        return `
            <tr class="hover:bg-slate-800/50 transition">
                <td class="py-2.5 px-2 font-mono text-slate-400">${idx + 1}</td>
                <td class="py-2.5 px-2 font-mono text-slate-400 text-xs">${item.product.barcode}</td>
                <td class="py-2.5 px-2 font-semibold text-slate-100">${item.product.name}</td>
                <td class="py-2.5 px-2 text-right font-mono">${item.qty}</td>
                <td class="py-2.5 px-2 text-right font-mono text-slate-300">R$ ${item.price.toFixed(2)}</td>
                <td class="py-2.5 px-2 text-right font-mono font-bold text-brand-400">R$ ${item.total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    updateTotalsSummary(subtotal);
}

function updateTotalsSummary(subtotal) {
    let discountValue = activeDiscount.type === 'fixed' ? activeDiscount.value : subtotal * (activeDiscount.value / 100);
    if(discountValue > subtotal) discountValue = subtotal;
    const grandTotal = Math.max(0, subtotal - discountValue);

    const subEl = document.getElementById('summary-subtotal');
    const discEl = document.getElementById('summary-discount');
    const totEl = document.getElementById('summary-total');

    if(subEl) subEl.textContent = `R$ ${subtotal.toFixed(2)}`;
    if(discEl) discEl.textContent = `- R$ ${discountValue.toFixed(2)}`;
    if(totEl) totEl.textContent = `R$ ${grandTotal.toFixed(2)}`;
}

function showNotification(message, type = 'success') {
    const existingToast = document.getElementById('system-toast');
    if(existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'system-toast';
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold text-white flex items-center gap-2 transition-all duration-300 ${
        type === 'success' ? 'bg-emerald-600 border border-emerald-500' : 'bg-rose-600 border border-rose-500'
    }`;
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-sm"></i> <span>${message}</span>`;
    
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}