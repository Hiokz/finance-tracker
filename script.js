// Supabase Initialization
const SUPABASE_URL = 'https://cvzqsgpczhjlgjmundga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2enFzZ3BjemhqbGdqbXVuZGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODQ4MjAsImV4cCI6MjA5MDM2MDgyMH0.HPqLoJmwdvuqaz4tBJWZsp6qqbFL_oK3m4_QkGwGfgE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let state = {
    transactions: [],
    trades: []
};
let currentUser = null;

// DOM Elements
const elements = {
    // Login
    loginOverlay: document.getElementById('login-overlay'),
    loginForm: document.getElementById('login-form'),
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginError: document.getElementById('login-error'),
    authTitle: document.getElementById('auth-title'),
    authSubtitle: document.getElementById('auth-subtitle'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    btnLogout: document.getElementById('btn-logout'),
    userDisplayEmail: document.getElementById('user-display-email'),
    appWrapper: document.getElementById('app-wrapper'),

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
async function init() {
    setupEventListeners();
    updateDateDisplay();
    
    // Check active Supabase session
    const { data: { session } } = await supabaseClient.auth.getSession();
    handleAuthState(session);

    // Listen for auth changes
    supabaseClient.auth.onAuthStateChange((event, session) => {
        handleAuthState(session);
    });
}

// Auth Handling
async function handleAuthState(session) {
    if (session) {
        currentUser = session.user;
        elements.userDisplayEmail.textContent = currentUser.email.split('@')[0];
        unlockApp();
        await loadData();
    } else {
        currentUser = null;
        lockApp();
    }
}

function unlockApp() {
    elements.loginOverlay.classList.remove('active');
    setTimeout(() => {
        elements.loginOverlay.style.display = 'none';
        elements.appWrapper.style.display = 'flex';
    }, 300);
}

function lockApp() {
    elements.appWrapper.style.display = 'none';
    elements.loginOverlay.style.display = 'flex';
    // Small delay to allow display:flex to apply before opacity transition
    setTimeout(() => {
        elements.loginOverlay.classList.add('active');
    }, 10);
}

// Event Listeners
function setupEventListeners() {
    // Login Submit
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            elements.authSubmitBtn.disabled = true;
            elements.authSubmitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
            elements.loginError.style.display = 'none';
            
            const email = elements.loginEmail.value;
            const password = elements.loginPassword.value;

            const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (signInError) {
                elements.loginError.textContent = signInError.message;
                elements.loginError.className = 'danger-text';
                elements.loginError.style.display = 'block';
            }

            elements.authSubmitBtn.disabled = false;
            elements.authSubmitBtn.textContent = 'Sign In';
        });
    }

    // Logout
    if (elements.btnLogout) {
        elements.btnLogout.addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
        });
    }

    // Navigation
    elements.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = item.getAttribute('data-target');
            
            elements.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            elements.pageTitle.textContent = item.querySelector('span').textContent;
            
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

function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
    const form = modal.querySelector('form');
    if(form) form.reset();
}

// Database Operations
async function loadData() {
    // Fetch Transactions
    const { data: txData, error: txError } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });
        
    if (!txError && txData) {
        state.transactions = txData;
    }

    // Fetch Trades
    const { data: trData, error: trError } = await supabaseClient
        .from('trades')
        .select('*')
        .order('date', { ascending: false });
        
    if (!trError && trData) {
        state.trades = trData;
    }

    renderAll();
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const type = document.getElementById('tx-type').value;
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const description = document.getElementById('tx-desc').value;
    const category = document.getElementById('tx-category').value || 'Uncategorized';
    const date = document.getElementById('tx-date').value;

    const btn = elements.transactionForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([{ user_id: currentUser.id, type, amount, description, category, date }])
        .select();

    if (!error && data) {
        state.transactions.unshift(data[0]); // Add to top
        state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        closeModal(elements.transactionModal);
        renderAll();
    } else {
        console.error("Error inserting transaction:", error);
        alert("Failed to save transaction.");
    }
    
    btn.disabled = false;
}

window.deleteTransaction = async function(id) {
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (!error) {
        state.transactions = state.transactions.filter(t => t.id !== id);
        renderAll();
    }
}

async function handleTradeSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;
    
    const asset = document.getElementById('td-asset').value;
    const direction = document.getElementById('td-direction').value;
    const date = document.getElementById('td-date').value;
    const entry_price = parseFloat(document.getElementById('td-entry').value);
    const exit_price = parseFloat(document.getElementById('td-exit').value);
    const notes = document.getElementById('td-notes').value;

    let pnl = direction === 'long' ? (exit_price - entry_price) : (entry_price - exit_price);

    const btn = elements.tradeForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const { data, error } = await supabaseClient
        .from('trades')
        .insert([{ user_id: currentUser.id, asset, direction, date, entry_price, exit_price, pnl, notes }])
        .select();

    if (!error && data) {
        state.trades.unshift(data[0]);
        state.trades.sort((a, b) => new Date(b.date) - new Date(a.date));
        closeModal(elements.tradeModal);
        renderAll();
    } else {
        console.error("Error inserting trade:", error);
        alert("Failed to log trade.");
    }

    btn.disabled = false;
}

window.deleteTrade = async function(id) {
    const { error } = await supabaseClient.from('trades').delete().eq('id', id);
    if (!error) {
        state.trades = state.trades.filter(t => t.id !== id);
        renderAll();
    }
}

// Core Rendering
function renderAll() {
    renderDashboard();
    renderTransactionsTable();
    renderTradesTable();
    updateChart();
}

function renderDashboard() {
    const income = state.transactions
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);
        
    const expense = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const balance = income - expense;

    const totalPnl = state.trades.reduce((acc, curr) => acc + Number(curr.pnl), 0);
    const winningTrades = state.trades.filter(t => Number(t.pnl) > 0).length;
    const winRate = state.trades.length > 0 
        ? ((winningTrades / state.trades.length) * 100).toFixed(1) 
        : 0;

    elements.dashTotalBalance.textContent = formatCurrency(balance);
    elements.dashTotalIncome.textContent = `+${formatCurrency(income)}`;
    elements.dashTotalExpense.textContent = `-${formatCurrency(expense)}`;
    
    elements.dashTradingPnl.textContent = formatCurrency(totalPnl);
    elements.dashTradingPnl.className = totalPnl >= 0 ? 'success-text' : 'danger-text';
    elements.dashWinRate.textContent = `${winRate}%`;
}

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
            <td><strong>${t.description}</strong></td>
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
        const pnl = Number(t.pnl);
        const pnlClass = pnl >= 0 ? 'success-text' : 'danger-text';
        const pnlPrefix = pnl >= 0 ? '+' : '';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDate(t.date)}</td>
            <td><strong>${t.asset}</strong></td>
            <td><span class="badge ${badgeClass}">${t.direction}</span></td>
            <td>${Number(t.entry_price).toFixed(5)}</td>
            <td>${Number(t.exit_price).toFixed(5)}</td>
            <td class="${pnlClass}">${pnlPrefix}${formatCurrency(pnl)}</td>
            <td>
                <button class="action-btn delete" onclick="deleteTrade('${t.id}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        elements.tradesList.appendChild(tr);
    });
}

function updateChart() {
    const ctx = elements.canvas.getContext('2d');
    
    if (cashflowChartInstance) {
        cashflowChartInstance.destroy();
    }
    
    const dateMap = {};
    const sortedTx = [...state.transactions].reverse();
    
    sortedTx.forEach(t => {
        if(!dateMap[t.date]) {
            dateMap[t.date] = { income: 0, expense: 0 };
        }
        if(t.type === 'income') dateMap[t.date].income += Number(t.amount);
        if(t.type === 'expense') dateMap[t.date].expense += Number(t.amount);
    });

    const labels = Object.keys(dateMap).slice(-7);
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
