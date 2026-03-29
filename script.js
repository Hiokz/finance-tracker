// State Management
let state = {
    transactions: JSON.parse(localStorage.getItem('fintrack_transactions')) || [],
    trades: JSON.parse(localStorage.getItem('fintrack_trades')) || []
};

// DOM Elements
const elements = {
    // Navigation
    navItems: document.querySelectorAll('.nav-item'),
    sections: document.querySelectorAll('.content-section'),
    pageTitle: document.getElementById('page-title'),
    currentDate: document.getElementById('current-date'),

    // Dashboard
    dashTotalBalance: document.getElementById('dash-total-balance'),
    dashTotalIncome: document.getElementById('dash-total-income'),
    dashTotalExpense: document.getElementById('dash-total-expense'),
    dashTradingPnl: document.getElementById('dash-trading-pnl'),
    dashWinRate: document.getElementById('dash-win-rate'),
    
    // Modals
    transactionModal: document.getElementById('transaction-modal'),
    tradeModal: document.getElementById('trade-modal'),
    btnAddTransaction: document.getElementById('btn-add-transaction'),
    btnAddTrade: document.getElementById('btn-add-trade'),
    closeTransactionModal: document.getElementById('close-transaction-modal'),
    closeTradeModal: document.getElementById('close-trade-modal'),
    
    // Forms
    transactionForm: document.getElementById('transaction-form'),
    tradeForm: document.getElementById('trade-form'),

    // Tables
    transactionsList: document.getElementById('transactions-list'),
    tradesList: document.getElementById('trades-list'),
    noTransactions: document.getElementById('no-transactions'),
    noTrades: document.getElementById('no-trades'),
    
    // Chart
    canvas: document.getElementById('cashflowChart')
};

let cashflowChartInstance = null;

// Initialize Application
function init() {
    setupEventListeners();
    updateDateDisplay();
    renderAll();
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            // Update active nav
            elements.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update title
            elements.pageTitle.textContent = item.querySelector('span').textContent;
            
            // Show target section
            elements.sections.forEach(section => {
                section.classList.remove('active');
                if(section.id === targetId) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Modals
    elements.btnAddTransaction.addEventListener('click', () => openModal(elements.transactionModal));
    elements.btnAddTrade.addEventListener('click', () => openModal(elements.tradeModal));
    elements.closeTransactionModal.addEventListener('click', () => closeModal(elements.transactionModal));
    elements.closeTradeModal.addEventListener('click', () => closeModal(elements.tradeModal));
    
    // Close modal on outside click
    window.addEventListener('click', (e) => {
        if(e.target.classList.contains('modal-overlay')) {
            closeModal(e.target);
        }
    });

    // Forms
    elements.transactionForm.addEventListener('submit', handleTransactionSubmit);
    elements.tradeForm.addEventListener('submit', handleTradeSubmit);
}

function updateDateDisplay() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', options);
}

// Modals Handling
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
    // Reset form inside modal
    const form = modal.querySelector('form');
    if(form) form.reset();
}

// Data Handling - Transactions
function handleTransactionSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('tx-type').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const desc = document.getElementById('tx-desc').value;
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;

    const transaction = {
        id: generateId(),
        type,
        amount,
        desc,
        category: category || 'Uncategorized',
        date
    };

    state.transactions.push(transaction);
    state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort latest first
    
    saveData();
    closeModal(elements.transactionModal);
    renderAll();
}

function deleteTransaction(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveData();
    renderAll();
}

// Data Handling - Trades
function handleTradeSubmit(e) {
    e.preventDefault();
    
    const asset = document.getElementById('td-asset').value;
    const direction = document.getElementById('td-direction').value;
    const date = document.getElementById('td-date').value;
    const entry = parseFloat(document.getElementById('td-entry').value);
    const exit = parseFloat(document.getElementById('td-exit').value);
    const notes = document.getElementById('td-notes').value;

    // Calculate PnL (simplified: Assuming 1 unit of asset for absolute PnL)
    // Normally would include position sizing
    let pnl = 0;
    if (direction === 'long') {
        pnl = exit - entry;
    } else {
        pnl = entry - exit;
    }

    const trade = {
        id: generateId(),
        asset,
        direction,
        date,
        entry,
        exit,
        pnl,
        notes
    };

    state.trades.push(trade);
    state.trades.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort latest first
    
    saveData();
    closeModal(elements.tradeModal);
    renderAll();
}

function deleteTrade(id) {
    state.trades = state.trades.filter(t => t.id !== id);
    saveData();
    renderAll();
}

// Core Rendering
function renderAll() {
    renderDashboard();
    renderTransactionsTable();
    renderTradesTable();
    updateChart();
}

// Calculations & Dashboard Render
function renderDashboard() {
    // Financials
    const income = state.transactions
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + curr.amount, 0);
        
    const expense = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => acc + curr.amount, 0);

    const balance = income - expense;

    // Trading stats
    const totalPnl = state.trades.reduce((acc, curr) => acc + curr.pnl, 0);
    const winningTrades = state.trades.filter(t => t.pnl > 0).length;
    const winRate = state.trades.length > 0 
        ? ((winningTrades / state.trades.length) * 100).toFixed(1) 
        : 0;

    // Update DOM
    elements.dashTotalBalance.textContent = formatCurrency(balance);
    elements.dashTotalIncome.textContent = `+${formatCurrency(income)}`;
    elements.dashTotalExpense.textContent = `-${formatCurrency(expense)}`;
    
    elements.dashTradingPnl.textContent = formatCurrency(totalPnl);
    elements.dashTradingPnl.className = totalPnl >= 0 ? 'success-text' : 'danger-text';
    elements.dashWinRate.textContent = `${winRate}%`;
}

// Render Transactions List
function renderTransactionsTable() {
    elements.transactionsList.innerHTML = '';
    
    if (state.transactions.length === 0) {
        elements.noTransactions.style.display = 'flex';
        document.getElementById('transactions-table').style.display = 'none';
        return;
    }
    
    elements.noTransactions.style.display = 'none';
    document.getElementById('transactions-table').style.display = 'table';

    state.transactions.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td><strong>${t.desc}</strong></td>
            <td>${t.category}</td>
            <td><span class="badge ${t.type}">${t.type}</span></td>
            <td class="${t.type === 'income' ? 'success-text' : 'danger-text'}">
                ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
            </td>
            <td>
                <button class="action-btn delete" onclick="deleteTransaction('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        elements.transactionsList.appendChild(tr);
    });
}

// Render Trades List
function renderTradesTable() {
    elements.tradesList.innerHTML = '';
    
    if (state.trades.length === 0) {
        elements.noTrades.style.display = 'flex';
        document.getElementById('trades-table').style.display = 'none';
        return;
    }
    
    elements.noTrades.style.display = 'none';
    document.getElementById('trades-table').style.display = 'table';

    state.trades.forEach(t => {
        const badgeClass = t.direction;
        const pnlClass = t.pnl >= 0 ? 'success-text' : 'danger-text';
        const pnlPrefix = t.pnl >= 0 ? '+' : '';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td><strong>${t.asset}</strong></td>
            <td><span class="badge ${badgeClass}">${t.direction}</span></td>
            <td>${t.entry.toFixed(5)}</td>
            <td>${t.exit.toFixed(5)}</td>
            <td class="${pnlClass}">${pnlPrefix}${formatCurrency(t.pnl)}</td>
            <td>
                <button class="action-btn delete" onclick="deleteTrade('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        elements.tradesList.appendChild(tr);
    });
}

// Charting
function updateChart() {
    const ctx = elements.canvas.getContext('2d');
    
    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
    }
    
    // Group transactions by Date (last 7 active days)
    // For simplicity, we aggregate by date
    const dateMap = {};
    
    // Reverse to process chronologically if we want line chart left-to-right, 
    // but state is sorted newest first, so we reverse a copy
    const sortedTx = [...state.transactions].reverse();
    
    sortedTx.forEach(t => {
        if(!dateMap[t.date]) {
            dateMap[t.date] = { income: 0, expense: 0 };
        }
        if(t.type === 'income') dateMap[t.date].income += t.amount;
        if(t.type === 'expense') dateMap[t.date].expense += t.amount;
    });

    const labels = Object.keys(dateMap).slice(-7); // Last 7 days with activity
    const incomeData = labels.map(date => dateMap[date].income);
    const expenseData = labels.map(date => dateMap[date].expense);

    cashflowChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.map(d => formatDate(d)),
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: 'rgba(0, 230, 118, 0.8)',
                    borderRadius: 4
                },
                {
                    label: 'Expense',
                    data: expenseData,
                    backgroundColor: 'rgba(255, 51, 102, 0.8)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#f0f2f5' }
                }
            },
            scales: {
                y: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Helpers
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function saveData() {
    localStorage.setItem('fintrack_transactions', JSON.stringify(state.transactions));
    localStorage.setItem('fintrack_trades', JSON.stringify(state.trades));
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Run app
init();
