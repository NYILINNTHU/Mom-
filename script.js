const firebaseConfig = {
    apiKey: "AIzaSyBn17vNz3gDfWnip5fleXMAvcnjBLtnihI",
    authDomain: "mom-market-ledger.firebaseapp.com",
    databaseURL: "https://mom-market-ledger-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mom-market-ledger",
    storageBucket: "mom-market-ledger.appspot.com",
    messagingSenderId: "506346892681",
    appId: "1:506346892681:web:995ee4a59797430feb8898"
};

let db = null;
let isFirebaseConnected = false;

let defaultTransactions = [
    { id: 1, date: '2026-11-01', desc: 'လစဉ် စျေးသုံးငွေ ရရှိခြင်း', category: 'စျေးဖိုးပေးငွေ/ဝင်ငွေ', dr: 500000, cr: 0, remark: 'အိမ်စရိတ်' },
    { id: 2, date: '2026-11-01', desc: 'ပေါ်ဆန်းမွှေး ဆန် ၁ အိတ်', category: 'ဆန်/ဆီ/အခြေခံစားသောက်ကုန်', dr: 0, cr: 145000, remark: '၁ အိတ်' },
    { id: 3, date: '2026-11-02', desc: 'ဝက်သား၊ ကြက်သား နှင့် ဟင်းသီးဟင်းရွက်', category: 'သားငါး/ဟင်းသီးဟင်းရွက်', dr: 0, cr: 35000, remark: '' }
];

let transactions = JSON.parse(localStorage.getItem('mom_market_ledger')) || defaultTransactions;
let pendingSyncQueue = JSON.parse(localStorage.getItem('mom_market_pending_queue')) || [];

let balanceChartInstance = null;
let categoryChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('txDate').valueAsDate = new Date();
    render();
    initFirebase();
});

function initFirebase() {
    try {
        if (firebaseConfig.apiKey) {
            firebase.initializeApp(firebaseConfig);
            db = firebase.database();

            const connectedRef = db.ref(".info/connected");
            connectedRef.on("value", (snap) => {
                const dot = document.getElementById('syncStatusDot');
                const text = document.getElementById('syncStatusText');
                if (snap.val() === true) {
                    isFirebaseConnected = true;
                    dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block";
                    text.innerText = "Realtime Live Synced 🟢";
                    syncPendingData();
                } else {
                    isFirebaseConnected = false;
                    dot.className = "w-2.5 h-2.5 rounded-full bg-amber-400 inline-block animate-pulse";
                    text.innerText = "Offline Mode (Local)";
                }
            });

            db.ref('market_transactions').on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && pendingSyncQueue.length === 0) {
                    transactions = Array.isArray(data) ? data : Object.values(data);
                    localStorage.setItem('mom_market_ledger', JSON.stringify(transactions));
                    render();
                } else if (!data) {
                    db.ref('market_transactions').set(defaultTransactions);
                }
            });
        }
    } catch (e) {
        console.warn("Firebase fallback to LocalStorage.", e);
    }
}

function saveState() {
    localStorage.setItem('mom_market_ledger', JSON.stringify(transactions));
    localStorage.setItem('mom_market_pending_queue', JSON.stringify(pendingSyncQueue));
    syncPendingData();
}

function syncPendingData() {
    if (navigator.onLine && isFirebaseConnected && db) {
        db.ref('market_transactions').set(transactions)
            .then(() => {
                pendingSyncQueue = [];
                localStorage.setItem('mom_market_pending_queue', JSON.stringify([]));
            })
            .catch(err => console.warn("Sync error:", err));
    }
}

window.addEventListener('online', syncPendingData);

function formatNumber(num) {
    return num.toLocaleString('en-US');
}

function render() {
    const tbody = document.getElementById('txTableBody');
    tbody.innerHTML = '';

    let currentBal = 0;
    let totalIn = 0;
    let totalOut = 0;
    let catTotals = {
        'သားငါး/ဟင်းသီးဟင်းရွက်': 0,
        'ဆန်/ဆီ/အခြေခံစားသောက်ကုန်': 0,
        'အိမ်သုံး/မီးဖိုချောင်သုံး': 0,
        'မီးဖိုး/ရေဖိုး/အထွေထွေ': 0,
        'ပေးကမ်း/လှူဒါန်း/ကျန်းမာရေး': 0,
        'စျေးဖိုးပေးငွေ/ဝင်ငွေ': 0
    };

    transactions.forEach((tx, index) => {
        const dr = Number(tx.dr) || 0;
        const cr = Number(tx.cr) || 0;
        const cat = tx.category || 'အထွေထွေ';

        if (index === 0) {
            currentBal = dr;
        } else {
            currentBal = currentBal + dr - cr;
        }

        totalIn += dr;
        totalOut += cr;
        if (cr > 0 && catTotals[cat] !== undefined) {
            catTotals[cat] += cr;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-100 transition";
        tr.innerHTML = `
            <td class="p-3 text-center text-slate-800 font-bold">${index + 1}</td>
            <td class="p-3 text-slate-900 font-semibold">${tx.date}</td>
            <td class="p-3 font-bold text-slate-900">${tx.desc}</td>
            <td class="p-3"><span class="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded text-xs font-bold border border-emerald-300">${cat}</span></td>
            <td class="p-3 text-right text-emerald-700 font-bold text-sm">${dr > 0 ? formatNumber(dr) : ''}</td>
            <td class="p-3 text-right text-rose-700 font-bold text-sm">${cr > 0 ? formatNumber(cr) : ''}</td>
            <td class="p-3 text-right font-bold text-indigo-800 text-sm">${formatNumber(currentBal)}</td>
            <td class="p-3 text-slate-800 font-medium text-xs">${tx.remark || ''}</td>
            <td class="p-3 text-center">
                <button onclick="deleteTx(${index})" class="text-rose-700 hover:text-rose-900 font-bold text-xs bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded transition border border-rose-300">ဖျက်ရန်</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('totalInflow').innerText = formatNumber(totalIn) + ' MMK';
    document.getElementById('totalOutflow').innerText = formatNumber(totalOut) + ' MMK';
    document.getElementById('currentBalance').innerText = formatNumber(currentBal) + ' MMK';
    document.getElementById('txCount').innerText = transactions.length + ' ခု';

    renderCharts(catTotals);
}

function addTransaction(e) {
    e.preventDefault();
    const newTx = {
        id: Date.now(),
        date: document.getElementById('txDate').value,
        desc: document.getElementById('txDesc').value,
        category: document.getElementById('txCategory').value,
        dr: parseFloat(document.getElementById('txDr').value) || 0,
        cr: parseFloat(document.getElementById('txCr').value) || 0,
        remark: document.getElementById('txRemark').value
    };

    transactions.push(newTx);
    pendingSyncQueue.push(newTx);

    document.getElementById('txForm').reset();
    document.getElementById('txDate').valueAsDate = new Date();
    document.getElementById('txDr').value = 0;
    document.getElementById('txCr').value = 0;
    
    saveState();
    render();
}

function deleteTx(index) {
    if (confirm('ဤစာရင်းကို ဖျက်ရန် သေချာပါသလား?')) {
        const deleted = transactions.splice(index, 1);
        pendingSyncQueue.push({ action: 'delete', tx: deleted });
        saveState();
        render();
    }
}

function resetData() {
    if (confirm('မူလ စာရင်းများသို့ ပြန်လည် သတ်မှတ်ရန် သေချာပါသလား?')) {
        transactions = [...defaultTransactions];
        pendingSyncQueue = [];
        saveState();
        render();
    }
}

function calculateUnitCost() {
    const price = parseFloat(document.getElementById('calcUnitPrice').value) || 0;
    const qty = parseFloat(document.getElementById('calcQty').value) || 0;
    const unitType = document.getElementById('calcUnitType').value;

    let total = 0;
    if (unitType === 'kyat') {
        total = (price / 100) * qty;
    } else if (unitType === 'gram') {
        total = (price / 1000) * qty;
    } else if (unitType === 'viss') {
        total = price * qty;
    }

    document.getElementById('calcResult').innerText = formatNumber(Math.round(total)) + ' MMK';
}

function renderCharts(catTotals) {
    let runningBal = 0;
    const labels = [];
    const dataPoints = [];

    transactions.forEach((tx, index) => {
        const dr = Number(tx.dr) || 0;
        const cr = Number(tx.cr) || 0;
        if (index === 0) runningBal = dr;
        else runningBal = runningBal + dr - cr;

        labels.push(`${index+1}. ${tx.desc.substring(0, 8)}`);
        dataPoints.push(runningBal);
    });

    const ctxLine = document.getElementById('balanceChart').getContext('2d');
    if (balanceChartInstance) balanceChartInstance.destroy();

    balanceChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Balance',
                data: dataPoints,
                borderColor: '#047857',
                backgroundColor: 'rgba(4, 120, 87, 0.08)',
                borderWidth: 2.5,
                fill: true,
                tension: 0.2,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: false, grid: { color: '#e2e8f0' }, ticks: { font: { size: 10, weight: 'bold' }, color: '#1e293b' } },
                x: { grid: { display: false }, ticks: { font: { size: 9, weight: 'bold' }, color: '#1e293b' } }
            }
        }
    });

    const catLabels = [];
    const catValues = [];
    for (const [key, val] of Object.entries(catTotals)) {
        if (key !== 'စျေးဖိုးပေးငွေ/ဝင်ငွေ' && val > 0) {
            catLabels.push(key);
            catValues.push(val);
        }
    }

    const ctxDoughnut = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();

    categoryChartInstance = new Chart(ctxDoughnut, {
        type: 'doughnut',
        data: {
            labels: catLabels.length ? catLabels : ['မရှိသေးပါ'],
            datasets: [{
                data: catValues.length ? catValues : [1],
                backgroundColor: [
                    '#e11d48',
                    '#d97706',
                    '#0284c7',
                    '#7c3aed',
                    '#059669'
                ],
                borderWidth: 1.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: 'bold' }, color: '#1e293b' } }
            }
        }
    });
}

function exportCSV() {
    let csv = 'No,Date,Description,Category,Dr,Cr,Balance,Remark\n';
    let bal = 0;
    transactions.forEach((tx, i) => {
        const dr = Number(tx.dr) || 0;
        const cr = Number(tx.cr) || 0;
        if (i === 0) bal = dr;
        else bal = bal + dr - cr;
        csv += `${i+1},${tx.date},"${tx.desc}","${tx.category || ''}",${dr},${cr},${bal},"${tx.remark || ''}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Mom_Market_Ledger.csv';
    link.click();
}