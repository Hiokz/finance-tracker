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
let currentCalDate = new Date();

// DOM Elements Container
let elements = {};

// Inject HTML Components
async function loadComponents() {
    const componentsToLoad = [
        { id: 'login-placeholder', url: 'components/login.html' },
        { id: 'sidebar-placeholder', url: 'components/sidebar.html' },
        { id: 'dashboard-placeholder', url: 'components/dashboard.html' },
        { id: 'transactions-placeholder', url: 'components/transactions.html' },
        { id: 'journal-placeholder', url: 'components/journal.html' },
        { id: 'modals-placeholder', url: 'components/modals.html' }
    ];

    for (const comp of componentsToLoad) {
        try {
            const response = await fetch(comp.url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            const html = await response.text();
            document.getElementById(comp.id).outerHTML = html;
        } catch (error) {
            console.error(`Failed to load component ${comp.url}:`, error);
        }
    }
}

// Map DOM Elements after Injection
function initDOM() {
    elements = {
        loginOverlay: document.getElementById('login-overlay'),
        loginForm: document.getElementById('login-form'),
        loginUsername: document.getElementById('login-username'),
        loginPassword: document.getElementById('login-password'),
        loginError: document.getElementById('login-error'),
        authTitle: document.getElementById('auth-title'),
        authSubtitle: document.getElementById('auth-subtitle'),
        authSubmitBtn: document.getElementById('auth-submit-btn'),
        btnLogout: document.getElementById('btn-logout'),
        userDisplayEmail: document.getElementById('user-display-email'),
        appWrapper: document.getElementById('app-wrapper'),

        navItems: document.querySelectorAll('.nav-item'),
        sections: document.querySelectorAll('.content-section'),
        pageTitle: document.getElementById('page-title'),
        currentDate: document.getElementById('current-date'),

        dashTotalBalance: document.getElementById('dash-total-balance'),
        dashTotalIncome: document.getElementById('dash-total-income'),
        dashTotalExpense: document.getElementById('dash-total-expense'),
        dashTradingPnl: document.getElementById('dash-trading-pnl'),
        dashWinRate: document.getElementById('dash-win-rate'),

        transactionModal: document.getElementById('transaction-modal'),
        tradeModal: document.getElementById('trade-modal'),
        btnAddTransaction: document.getElementById('btn-add-transaction'),
        btnAddTrade: document.getElementById('btn-add-trade'),
        closeTransactionModal: document.getElementById('close-transaction-modal'),
        closeTradeModal: document.getElementById('close-trade-modal'),

        transactionForm: document.getElementById('transaction-form'),
        tradeForm: document.getElementById('trade-form'),

        transactionsList: document.getElementById('transactions-list'),
        tradesList: document.getElementById('trades-list'),
        noTransactions: document.getElementById('no-transactions'),
        noTrades: document.getElementById('no-trades'),

        calMonthDisplay: document.getElementById('cal-month-display'),
        calGrid: document.getElementById('pnl-calendar-grid'),
        calPrevBtn: document.getElementById('cal-prev-month'),
        calNextBtn: document.getElementById('cal-next-month')
    };
}

// Initialize Application
async function init() {
    await loadComponents(); // Must run first to build the page

    initDOM(); // Now that HTML is loaded, find elements
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

            const rawUsername = elements.loginUsername.value.trim().toLowerCase();
            const email = `${rawUsername}@fintrack.local`;
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
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Calendar Navigation
    if (elements.calPrevBtn) {
        elements.calPrevBtn.addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() - 1);
            renderPnlCalendar();
        });
        elements.calNextBtn.addEventListener('click', () => {
            currentCalDate.setMonth(currentCalDate.getMonth() + 1);
            renderPnlCalendar();
        });
    }

    // Toggle Buttons (Income/Expense, Long/Short)
    document.querySelectorAll('.toggle-group').forEach(group => {
        group.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                // Sync the hidden input
                const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
                if (hiddenInput) hiddenInput.value = btn.dataset.value;
            });
        });
    });

    // Modals
    elements.btnAddTransaction.addEventListener('click', () => openModal(elements.transactionModal));
    elements.btnAddTrade.addEventListener('click', () => openModal(elements.tradeModal));
    elements.closeTransactionModal.addEventListener('click', () => closeModal(elements.transactionModal));
    elements.closeTradeModal.addEventListener('click', () => closeModal(elements.tradeModal));

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
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
    // Pre-fill date inputs with today's date
    const dateInput = modal.querySelector('input[type="date"]');
    if (dateInput) {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        dateInput.value = `${year}-${month}-${day}`;
    }
}

function closeModal(modal) {
    modal.classList.remove('active');
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        // Also physically reset our custom toggle UI to match the hidden input's default value
        const toggleGroups = form.querySelectorAll('.toggle-group');
        toggleGroups.forEach(group => {
            const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                const defaultVal = hiddenInput.defaultValue;
                group.querySelectorAll('.toggle-btn').forEach(btn => {
                    if (btn.dataset.value === defaultVal) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        });
    }
}

// Database Operations
async function loadData() {
    const { data: txData, error: txError } = await supabaseClient
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

    if (!txError && txData) {
        state.transactions = txData;
    }

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
    const date = document.getElementById('tx-date').value;

    const btn = elements.transactionForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    // The category column has been successfully removed from the database, so we insert without it
    const { data, error } = await supabaseClient
        .from('transactions')
        .insert([{ user_id: currentUser.id, type, amount, description, date }])
        .select();

    if (!error && data) {
        state.transactions.unshift(data[0]);
        state.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        closeModal(elements.transactionModal);
        renderAll();
    } else {
        console.error("Error inserting transaction:", error);
        alert("Failed to save transaction.");
    }

    btn.disabled = false;
}

window.deleteTransaction = async function (id) {
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

window.deleteTrade = async function (id) {
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
    renderPnlCalendar();
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

function renderPnlCalendar() {
    if (!elements.calGrid) return;

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    elements.calMonthDisplay.textContent = `${monthNames[currentCalDate.getMonth()]} ${currentCalDate.getFullYear()}`;

    const year = currentCalDate.getFullYear();
    const month = currentCalDate.getMonth();

    // Group trades by date for this month
    const dailyPnl = {};
    state.trades.forEach(t => {
        const [tYear, tMonth] = t.date.split('-');
        if (Number(tYear) === year && Number(tMonth) - 1 === month) {
            if (!dailyPnl[t.date]) dailyPnl[t.date] = 0;
            dailyPnl[t.date] += Number(t.pnl);
        }
    });

    let html = `
        <div class="cal-header-cell">Mon</div>
        <div class="cal-header-cell">Tue</div>
        <div class="cal-header-cell">Wed</div>
        <div class="cal-header-cell">Thu</div>
        <div class="cal-header-cell">Fri</div>
    `;

    // Collect only weekdays (Mon-Fri) for the current month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weekdayCells = [];

    for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay();
        if (dow >= 1 && dow <= 5) { // Mon=1 to Fri=5
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            weekdayCells.push({ day: d, dateStr, isCurrentMonth: true });
        }
    }

    // Pad the FIRST row: if the month doesn't start on Monday, leave empty cells
    if (weekdayCells.length > 0) {
        const firstDow = new Date(year, month, weekdayCells[0].day).getDay(); // 1=Mon ... 5=Fri
        const padStart = firstDow - 1; // Mon needs 0 pads, Tue needs 1, etc.
        for (let i = 0; i < padStart; i++) {
            html += `<div class="cal-cell empty"><div class="cal-date"></div></div>`;
        }
    }

    // Render each weekday cell
    weekdayCells.forEach(cell => {
        let cellClass = 'cal-cell';
        let pnlHtml = '';

        if (dailyPnl[cell.dateStr] !== undefined) {
            const pnl = dailyPnl[cell.dateStr];
            if (pnl > 0) {
                cellClass += ' profit';
                pnlHtml = `<div class="cal-pnl success-text">+${formatCurrency(pnl)}</div>`;
            } else if (pnl < 0) {
                cellClass += ' loss';
                pnlHtml = `<div class="cal-pnl danger-text">${formatCurrency(pnl)}</div>`;
            } else {
                pnlHtml = `<div class="cal-pnl" style="color: #94a3b8;">$0.00</div>`;
            }
        }

        html += `
            <div class="${cellClass}">
                <div class="cal-date">${cell.day}</div>
                ${pnlHtml}
            </div>
        `;
    });

    // Pad the LAST row with next month's days to fill remaining cells
    if (weekdayCells.length > 0) {
        const lastDay = weekdayCells[weekdayCells.length - 1].day;
        const lastDow = new Date(year, month, lastDay).getDay(); // 1=Mon ... 5=Fri
        const padEnd = 5 - lastDow;
        let nextDay = 1;
        for (let i = 0; i < padEnd; i++) {
            html += `<div class="cal-cell empty"><div class="cal-date">${nextDay++}</div></div>`;
        }
    }

    elements.calGrid.innerHTML = html;
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
