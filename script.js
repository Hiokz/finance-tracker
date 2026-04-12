// Supabase Initialization
const SUPABASE_URL = 'https://cvzqsgpczhjlgjmundga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2enFzZ3BjemhqbGdqbXVuZGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODQ4MjAsImV4cCI6MjA5MDM2MDgyMH0.HPqLoJmwdvuqaz4tBJWZsp6qqbFL_oK3m4_QkGwGfgE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let state = {
    transactions: [],


    notes: [],
    portfolio: [],
    portfolioValueSGD: 0  // Cached live value
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


        { id: 'portfolio-placeholder', url: 'components/portfolio.html' },
        { id: 'notes-placeholder', url: 'components/notes.html' },
        { id: 'modals-placeholder', url: 'components/modals.html' }
    ];

    for (const comp of componentsToLoad) {
        try {
            const response = await fetch(`${comp.url}?v=${Date.now()}`);
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

        totalBalanceCard: document.getElementById('total-balance-card'),

        navItems: document.querySelectorAll('.nav-item'),
        sections: document.querySelectorAll('.content-section'),
        pageTitle: document.getElementById('page-title'),
        currentDate: document.getElementById('current-date'),

        dashTotalBalance: document.getElementById('dash-total-balance'),
        dashTotalIncome: document.getElementById('dash-total-income'),
        dashTotalExpense: document.getElementById('dash-total-expense'),


        transactionModal: document.getElementById('transaction-modal'),
        btnAddTransaction: document.getElementById('btn-add-transaction'),
        closeTransactionModal: document.getElementById('close-transaction-modal'),

        transactionForm: document.getElementById('transaction-form'),

        transactionsList: document.getElementById('transactions-list'),
        noTransactions: document.getElementById('no-transactions'),

        calMonthDisplay: document.getElementById('cal-month-display'),
        calGrid: document.getElementById('pnl-calendar-grid'),
        calPrevBtn: document.getElementById('cal-prev-month'),
        calNextBtn: document.getElementById('cal-next-month'),



        // Notes DOM
        noteModal: document.getElementById('note-modal'),
        closeNoteModal: document.getElementById('close-note-modal'),
        btnNewNote: document.getElementById('btn-new-note'),
        noteForm: document.getElementById('note-form'),
        notesGrid: document.getElementById('notes-grid'),
        noteModalTitle: document.getElementById('note-modal-title'),
        noteIdInput: document.getElementById('note-id'),
        noteColorInput: document.getElementById('note-color'),
        noteTitleInput: document.getElementById('note-title'),
        noteContentInput: document.getElementById('note-content'),
        colorSwatches: document.querySelectorAll('.color-swatch'),

        // Portfolio DOM
        portfolioModal: document.getElementById('portfolio-modal'),
        closePortfolioModal: document.getElementById('close-portfolio-modal'),
        btnAddPortfolio: document.getElementById('btn-add-portfolio'),
        portfolioForm: document.getElementById('portfolio-form'),
        portfolioIdInput: document.getElementById('portfolio-id'),
        pfTickerInput: document.getElementById('pf-ticker'),
        pfSharesInput: document.getElementById('pf-shares'),
        pfAvgPriceInput: document.getElementById('pf-avg-price'),
        pfCurrentPriceInput: document.getElementById('pf-current-price'),
        portfolioModalTitle: document.getElementById('portfolio-modal-title'),
        portfolioTotalValue: document.getElementById('portfolio-total-value'),
        portfolioTotalCost: document.getElementById('portfolio-total-cost'),
        portfolioUnrealizedPnl: document.getElementById('portfolio-unrealized-pnl'),
        portfolioRoiTrend: document.getElementById('portfolio-roi-trend'),
        portfolioRoi: document.getElementById('portfolio-roi'),
        portfolioTableBody: document.getElementById('portfolio-table-body')
    };
}

// Global UI State
let isBalanceHidden = localStorage.getItem('isBalanceHidden') !== 'false';

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
        const rawName = currentUser.email.split('@')[0];
        const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        elements.userDisplayEmail.textContent = `Welcome! ${displayName}`;
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
            const email = `${rawUsername}@fintracks.local`;
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
            if (e && e.preventDefault) e.preventDefault();
            const targetId = item.getAttribute('data-target');

            // Sync with browser URL for refresh persistence
            window.location.hash = targetId;

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


    if (elements.totalBalanceCard) {
        elements.totalBalanceCard.addEventListener('click', () => {
            isBalanceHidden = !isBalanceHidden;
            localStorage.setItem('isBalanceHidden', isBalanceHidden);
            renderDashboard();
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
                if (hiddenInput) {
                    hiddenInput.value = btn.dataset.value;
                }
            });
        });
    });


    // Modals
    elements.btnAddTransaction.addEventListener('click', () => {
        window.selectedTradeDate = null;
        openModal(elements.transactionModal);
    });
    elements.closeTransactionModal.addEventListener('click', () => closeModal(elements.transactionModal));



    // Notes Event Listeners
    if (elements.btnNewNote) {
        elements.btnNewNote.addEventListener('click', () => {
            elements.noteModalTitle.textContent = 'Take a note';
            elements.noteIdInput.value = '';
            elements.noteTitleInput.value = '';
            elements.noteContentInput.value = '';

            // Reset color to default #1e222d
            elements.noteColorInput.value = '#1e222d';
            elements.colorSwatches.forEach(s => s.classList.remove('active'));
            if (elements.colorSwatches.length > 0) elements.colorSwatches[0].classList.add('active'); // First one is default

            openModal(elements.noteModal);
        });
    }
    if (elements.closeNoteModal) {
        elements.closeNoteModal.addEventListener('click', () => closeModal(elements.noteModal));
    }
    if (elements.noteForm) {
        elements.noteForm.addEventListener('submit', handleNoteSubmit);
    }

    // Color Picker Swatches
    if (elements.colorSwatches) {
        elements.colorSwatches.forEach(swatch => {
            swatch.addEventListener('click', () => {
                elements.colorSwatches.forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                elements.noteColorInput.value = swatch.dataset.color || '#1e222d';
            });
        });
    }

    // Portfolio Event Listeners
    if (elements.btnAddPortfolio) {
        elements.btnAddPortfolio.addEventListener('click', () => {
            elements.portfolioModalTitle.textContent = 'Add Asset';
            elements.portfolioIdInput.value = '';
            elements.portfolioForm.reset();
            openModal(elements.portfolioModal);
        });
    }
    if (elements.closePortfolioModal) {
        elements.closePortfolioModal.addEventListener('click', () => closeModal(elements.portfolioModal));
    }
    if (elements.portfolioForm) {
        elements.portfolioForm.addEventListener('submit', handlePortfolioSubmit);
    }

    // Restore routing from URL hash on load
    if (window.location.hash) {
        const hash = window.location.hash.substring(1);
        const activeNav = Array.from(elements.navItems).find(n => n.getAttribute('data-target') === hash);
        if (activeNav) activeNav.click();
    }
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


    const { data: notesData, error: notesError } = await supabaseClient
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false });

    if (!notesError && notesData) {
        state.notes = notesData;
    }

    const { data: pfData, error: pfError } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('ticker', { ascending: true });

    if (!pfError && pfData) {
        state.portfolio = pfData;
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


// Backtest Submit Handlers
async function handleNewBacktestSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const btn = elements.newBacktestForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const name = document.getElementById('bt-session-name').value;
    const balance = parseFloat(document.getElementById('bt-session-balance').value);

    const { data, error } = await supabaseClient
        .from('backtest_sessions')
        .insert([{ user_id: currentUser.id, name: name, initial_balance: balance }])
        .select();

    if (!error && data) {
        state.backtests.unshift(data[0]);
        closeModal(elements.newBacktestModal);
        renderAll();
    } else {
        console.error("Backtest creation error:", error);
        alert("Failed to create session.");
    }
    btn.disabled = false;
}

window.deleteBacktest = async function (id) {
    const { error } = await supabaseClient.from('backtest_sessions').delete().eq('id', id);
    if (!error) {
        state.backtests = state.backtests.filter(t => t.id !== id);
        // Cascade removes child trades
        state.backtestTrades = state.backtestTrades.filter(t => t.session_id !== id);
        renderAll();
    }
}

async function handleBacktestTradeSubmit(e) {
    e.preventDefault();
    if (!currentUser || !window.selectedBacktestId) return;

    const btn = elements.backtestTradeForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const asset = document.getElementById('bt-td-asset').value;
    const direction = document.getElementById('bt-td-direction').value;
    const lots = parseFloat(document.getElementById('bt-td-lots').value);
    const entry = parseFloat(document.getElementById('bt-td-entry').value);
    const exit = parseFloat(document.getElementById('bt-td-exit').value);
    const date = document.getElementById('bt-td-date').value;
    const notes = document.getElementById('bt-td-notes').value;

    const slRaw = document.getElementById('bt-td-sl').value;
    const tpRaw = document.getElementById('bt-td-tp').value;
    const stop_loss = slRaw ? parseFloat(slRaw) : 0;
    const take_profit = tpRaw ? parseFloat(tpRaw) : 0;

    let pnl = 0;
    if (direction === 'long') {
        pnl = (exit - entry) * lots * 100;
    } else {
        pnl = (entry - exit) * lots * 100;
    }

    const payload = {
        session_id: window.selectedBacktestId,
        user_id: currentUser.id,
        asset: asset,
        direction: direction,
        entry_price: entry,
        exit_price: exit,
        lot_size: lots,
        stop_loss: stop_loss,
        take_profit: take_profit,
        pnl: pnl,
        notes: notes,
        date: date
    };

    const { data, error } = await supabaseClient
        .from('backtest_trades')
        .insert([payload])
        .select();

    if (!error && data) {
        state.backtestTrades.unshift(data[0]);
        state.backtestTrades.sort((a, b) => new Date(b.date) - new Date(a.date));
        closeModal(elements.backtestTradeModal);

        // Form resetting handled automatically by closeModal
        document.getElementById('bt-td-pnl-preview').value = '';

        renderActiveBacktest();
    } else {
        console.error("Backtest trade saving error:", error);
        alert("Failed to log backtest trade.");
    }
    btn.disabled = false;
}


// Core Rendering
function renderAll() {
    renderDashboard();
    renderTransactionsTable();
    renderNotes();
    renderPortfolio();
}

function renderDashboard() {
    const income = state.transactions
        .filter(t => t.type === 'income')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const expense = state.transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, curr) => acc + Number(curr.amount), 0);

    const balance = income - expense + (state.portfolioValueSGD || 0);

    elements.dashTotalBalance.textContent = isBalanceHidden ? '****' : formatCurrencySGD(balance);
    elements.dashTotalIncome.textContent = `+${formatCurrencySGD(income)}`;
    elements.dashTotalExpense.textContent = `-${formatCurrencySGD(expense)}`;
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
            <td><strong>${escapeHTML(t.description)}</strong></td>
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


// Notes logic
window.editNote = function (id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    elements.noteModalTitle.textContent = 'Edit note';
    elements.noteIdInput.value = note.id;
    elements.noteTitleInput.value = note.title;
    elements.noteContentInput.value = note.content || '';
    elements.noteColorInput.value = note.color;

    elements.colorSwatches.forEach(s => {
        if (s.dataset.color === note.color) s.classList.add('active');
        else s.classList.remove('active');
    });

    openModal(elements.noteModal);
};

window.deleteNote = async function (id, event) {
    if (event) event.stopPropagation(); // prevent opening edit modal
    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
    if (!error) {
        state.notes = state.notes.filter(n => n.id !== id);
        renderNotes();
    }
};

async function handleNoteSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const btn = elements.noteForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const id = elements.noteIdInput.value;
    const title = elements.noteTitleInput.value;
    const content = elements.noteContentInput.value;
    const color = elements.noteColorInput.value;

    if (id) {
        // Update
        const { data, error } = await supabaseClient
            .from('notes')
            .update({ title, content, color })
            .eq('id', id)
            .select();

        if (!error && data) {
            const idx = state.notes.findIndex(n => n.id === id);
            if (idx !== -1) state.notes[idx] = data[0];
            closeModal(elements.noteModal);
            renderNotes();
        } else {
            console.error("Error updating note:", error);
            alert("Failed to update note.");
        }
    } else {
        // Insert
        const { data, error } = await supabaseClient
            .from('notes')
            .insert([{ user_id: currentUser.id, title, content, color }])
            .select();

        if (!error && data) {
            state.notes.unshift(data[0]);
            closeModal(elements.noteModal);
            renderNotes();
        } else {
            console.error("Error saving note:", error);
            alert("Failed to save note.");
        }
    }

    btn.disabled = false;
}

function renderNotes() {
    if (!elements.notesGrid) return;

    if (state.notes.length === 0) {
        elements.notesGrid.innerHTML = '<div style="color: var(--text-muted); padding: 20px; grid-column: 1/-1;">No notes yet. Add one!</div>';
        return;
    }

    elements.notesGrid.innerHTML = state.notes.map(note => `
        <div class="note-card" style="background-color: ${note.color};" onclick="editNote('${note.id}')">
            <button class="note-delete-btn" onclick="deleteNote('${note.id}', event)" title="Delete Note">
                <i class="fa-solid fa-trash"></i>
            </button>
            <h4>${escapeHTML(note.title)}</h4>
            <p>${escapeHTML(note.content)}</p>
            <span class="note-date">${formatDate(note.created_at)}</span>
        </div>
    `).join('');
}

// Portfolio logic
window.editPortfolio = function (id) {
    const asset = state.portfolio.find(p => p.id === id);
    if (!asset) return;

    elements.portfolioModalTitle.textContent = 'Edit Asset';
    elements.portfolioIdInput.value = asset.id;
    elements.pfTickerInput.value = asset.ticker;
    elements.pfSharesInput.value = asset.shares;

    openModal(elements.portfolioModal);
};

window.deletePortfolio = async function (id) {
    const { error } = await supabaseClient.from('portfolio').delete().eq('id', id);
    if (!error) {
        state.portfolio = state.portfolio.filter(p => p.id !== id);
        renderPortfolio();
    }
};

async function handlePortfolioSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const btn = elements.portfolioForm.querySelector('button[type="submit"]');
    btn.disabled = true;

    const id = elements.portfolioIdInput.value;
    const ticker = elements.pfTickerInput.value.trim().toUpperCase();
    const shares = parseFloat(elements.pfSharesInput.value);

    // 1. Basic Input Validation
    if (!ticker || isNaN(shares) || shares <= 0) {
        alert("Please enter a valid ticker and a positive number of shares.");
        btn.disabled = false;
        return;
    }

    // 2. Ticker Active Verification
    btn.textContent = "Verifying Ticker...";
    const livePriceCheck = await fetchLivePrice(ticker);
    if (livePriceCheck === 0) {
        alert(`Invalid Ticker: Could not find any live pricing data for ${ticker}!`);
        btn.textContent = "Save Portfolio";
        btn.disabled = false;
        return;
    }

    btn.textContent = "Saving...";

    const avg_price = 0;
    const current_price = 0;

    const payload = { ticker, shares, avg_price, current_price };

    if (id) {
        // Update
        const { data, error } = await supabaseClient
            .from('portfolio')
            .update(payload)
            .eq('id', id)
            .select();

        if (!error && data) {
            const idx = state.portfolio.findIndex(p => p.id === id);
            if (idx !== -1) state.portfolio[idx] = data[0];
            closeModal(elements.portfolioModal);
            renderPortfolio();
        } else {
            console.error("Error updating portfolio:", error);
            alert("Failed to update asset.");
        }
    } else {
        // Insert
        payload.user_id = currentUser.id;
        const { data, error } = await supabaseClient
            .from('portfolio')
            .insert([payload])
            .select();

        if (!error && data) {
            state.portfolio.push(data[0]);
            // sort by ticker
            state.portfolio.sort((a, b) => a.ticker.localeCompare(b.ticker));
            closeModal(elements.portfolioModal);
            renderPortfolio();
        } else {
            console.error("Error saving portfolio:", error);
            alert("Failed to save asset.");
        }
    }

    btn.disabled = false;
}

// Live API configuration using Supabase Edge Function connecting to Yahoo Finance
async function fetchLivePrice(ticker) {
    try {
        const { data, error } = await supabaseClient.functions.invoke('yahoo-finance', {
            body: { ticker: ticker }
        });

        if (error) {
            console.error("Edge function error:", error);
            return 0;
        }

        return data?.price || 0;
    } catch (e) {
        console.error("Failed to invoke Edge Function for", ticker, e);
    }
    return 0;
}

async function renderPortfolio() {
    if (!elements.portfolioTableBody) return;

    elements.portfolioTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading live prices... <i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    if (state.portfolio.length === 0) {
        elements.portfolioTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No assets found. Add an asset to start tracking!</td></tr>';

        elements.portfolioTotalValue.textContent = formatCurrency(0);
        if (document.getElementById('portfolio-total-value-sgd')) document.getElementById('portfolio-total-value-sgd').textContent = formatCurrencySGD(0) + ' SGD';
        if (document.getElementById('portfolio-active-positions')) document.getElementById('portfolio-active-positions').textContent = '0';
        if (document.getElementById('portfolio-top-asset')) document.getElementById('portfolio-top-asset').textContent = '-';

        // Reset and Sync Grand Total to Dashboard natively
        state.portfolioValueSGD = 0;
        renderDashboard();

        return;
    }

    let totalValue = 0;
    let totalShares = 0;
    let html = '';

    // Fetch all prices in parallel (Append FX Request implicitly)
    const pricePromises = state.portfolio.map(asset => fetchLivePrice(asset.ticker));
    pricePromises.push(fetchLivePrice('SGD=X'));

    const livePrices = await Promise.all(pricePromises);
    const rawSgdRate = livePrices.pop() || 1.35; // Default fallback to 1.35 if heavily rate limited

    // Apply a mathematical offset exactly mimicking Webull's institutional conversion spread
    const sgdRate = rawSgdRate * 0.99705;

    state.portfolio.forEach((asset, index) => {
        const s = Number(asset.shares);
        const curr = livePrices[index];
        const mktValue = s * curr;

        totalValue += mktValue;
        totalShares += s;

        html += `
            <tr>
                <td><strong>${escapeHTML(asset.ticker)}</strong></td>
                <td>${s.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}</td>
                <td>${formatCurrency(curr)}</td>
                <td><strong class="primary-text">${formatCurrency(mktValue)}</strong></td>
                <td>
                    <button class="action-btn" onclick="editPortfolio('${asset.id}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn delete" onclick="deletePortfolio('${asset.id}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    elements.portfolioTableBody.innerHTML = html;

    const totalPortfolioSgd = totalValue * sgdRate;

    elements.portfolioTotalValue.textContent = formatCurrency(totalValue);
    if (document.getElementById('portfolio-total-value-sgd')) {
        document.getElementById('portfolio-total-value-sgd').textContent = formatCurrencySGD(totalPortfolioSgd) + ' SGD';
    }

    if (document.getElementById('portfolio-active-positions')) document.getElementById('portfolio-active-positions').textContent = state.portfolio.length;
    if (document.getElementById('portfolio-top-asset')) document.getElementById('portfolio-top-asset').textContent = totalShares.toLocaleString(undefined, { maximumFractionDigits: 5 });

    // Cache live value securely in state and route updates through the main dashboard engine
    state.portfolioValueSGD = totalPortfolioSgd;
    renderDashboard();
}

// Helpers
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatCurrencySGD(amount) {
    return new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency: 'SGD'
    }).format(amount);
}

function formatDate(dateString) {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

// Run app
init();

// Auto-refresh Stock Portfolio every 1 hour (3600000 ms)
setInterval(() => {
    if (state.portfolio && state.portfolio.length > 0) {
        renderPortfolio();
    }
}, 3600000);
