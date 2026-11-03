let currentCart = [];

window.onload = function() {
    loadCartFromStorage();
    setupStorageSyncListener();
    renderCart();
};

function loadCartFromStorage() {
    const saved = localStorage.getItem('isabel_current_cart');
    currentCart = saved ? JSON.parse(saved) : [];
}

// Ouve automaticamente quando o leitor mobile atualiza o localStorage na mesma máquina/rede
function setupStorageSyncListener() {
    window.addEventListener('storage', (event) => {
        if (event.key === 'isabel_current_cart') {
            currentCart = event.newValue ? JSON.parse(event.newValue) : [];
            renderCart();
            playBeepNotification();
        }
    });
}

function renderCart() {
    const tbody = document.getElementById('cart-items-tbody');
    const emptyState = document.getElementById('cart-empty');
    const totalEl = document.getElementById('summary-total');

    if (!tbody) return;

    if (currentCart.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        if (totalEl) totalEl.textContent = 'R$ 0,00';
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    let totalGeneral = 0;
    tbody.innerHTML = currentCart.map(item => {
        totalGeneral += item.total;
        return `
            <tr class="hover:bg-slate-800/40">
                <td class="py-2.5 font-semibold text-slate-100">${item.product.name}</td>
                <td class="py-2.5 text-right font-mono-num">${item.qty}</td>
                <td class="py-2.5 text-right font-mono-num text-slate-400">R$ ${item.price.toFixed(2)}</td>
                <td class="py-2.5 text-right font-mono-num font-bold text-brand-400">R$ ${item.total.toFixed(2)}</td>
            </tr>
        `;
    }).join('');

    if (totalEl) totalEl.textContent = `R$ ${totalGeneral.toFixed(2)}`;
}

function playBeepNotification() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
}