// Supabase Initialization
const SUPABASE_URL = 'https://cvzqsgpczhjlgjmundga.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2enFzZ3BjemhqbGdqbXVuZGdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3ODQ4MjAsImV4cCI6MjA5MDM2MDgyMH0.HPqLoJmwdvuqaz4tBJWZsp6qqbFL_oK3m4_QkGwGfgE';

// Clear any legacy persistent tokens from localStorage
try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.includes('-auth-token'))) {
            localStorage.removeItem(k);
        }
    }
} catch (e) {
    // Ignore storage restriction errors
}

// Configure Supabase client to use sessionStorage so closing the tab or opening a new tab requires re-login
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: window.sessionStorage,
        persistSession: true,
        autoRefreshToken: true
    }
});

// State Management
let state = {
    portfolio: [],
    portfolioValueSGD: 0,  // Cached live value
    portfolioHistory: []
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
        { id: 'portfolio-placeholder', url: 'components/portfolio.html' },
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

        calMonthDisplay: document.getElementById('cal-month-display'),
        calGrid: document.getElementById('pnl-calendar-grid'),
        calPrevBtn: document.getElementById('cal-prev-month'),
        calNextBtn: document.getElementById('cal-next-month'),



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
        portfolioTableBody: document.getElementById('portfolio-table-body'),
        btnPortfolioHistory: document.getElementById('btn-portfolio-history'),
        historyModal: document.getElementById('history-modal'),
        closeHistoryModal: document.getElementById('close-history-modal'),
        historyTableBody: document.getElementById('history-table-body')
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

            // Sync with browser URL for refresh persistence without triggering anchor jumps
            const routeHash = item.getAttribute('href') || ('#' + targetId);
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', routeHash);
            } else {
                window.location.hash = routeHash;
            }

            elements.navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            elements.pageTitle.textContent = item.querySelector('span').textContent;

            elements.sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === targetId) {
                    section.classList.add('active');
                }
            });

            // Ensure the top of the newly displayed section is always visible
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTop = 0;
            }
            window.scrollTo(0, 0);
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


    // Portfolio Event Listeners
    if (elements.btnPortfolioHistory) {
        elements.btnPortfolioHistory.addEventListener('click', () => {
            renderHistoryTable();
            openModal(elements.historyModal);
        });
    }
    if (elements.closeHistoryModal) {
        elements.closeHistoryModal.addEventListener('click', () => closeModal(elements.historyModal));
    }
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
        const activeNav = Array.from(elements.navItems).find(n =>
            n.getAttribute('data-target') === hash ||
            n.getAttribute('href') === '#' + hash ||
            n.getAttribute('data-target') === hash + '-section'
        );
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
    const { data: pfData, error: pfError } = await supabaseClient
        .from('portfolio')
        .select('*')
        .order('ticker', { ascending: true });

    if (!pfError && pfData) {
        // Consolidate duplicate tickers if any exist from previous entries
        const consolidated = [];
        const seen = new Map();
        const toDeleteIds = [];
        const toUpdate = [];

        for (const item of pfData) {
            const sym = (item.ticker || '').trim().toUpperCase();
            if (seen.has(sym)) {
                const primary = seen.get(sym);
                primary.shares = Math.round((Number(primary.shares) + Number(item.shares)) * 100000) / 100000;
                toDeleteIds.push(item.id);
                if (!toUpdate.some(u => u.id === primary.id)) {
                    toUpdate.push(primary);
                }
            } else {
                item.shares = Number(item.shares);
                seen.set(sym, item);
                consolidated.push(item);
            }
        }

        // Clean up duplicates in database asynchronously
        for (const primary of toUpdate) {
            supabaseClient.from('portfolio')
                .update({ shares: primary.shares })
                .eq('id', primary.id)
                .then(({ error }) => { if (error) console.error("Error updating consolidated shares", error); });
        }
        for (const delId of toDeleteIds) {
            supabaseClient.from('portfolio')
                .delete()
                .eq('id', delId)
                .then(({ error }) => { if (error) console.error("Error deleting duplicate asset", error); });
        }

        state.portfolio = consolidated;
    }

    const { data: histData, error: histError } = await supabaseClient
        .from('portfolio_history')
        .select('*')
        .order('date', { ascending: false });

    if (!histError && histData) {
        state.portfolioHistory = histData;
    }

    renderAll();
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
    renderPortfolio();
}

function renderDashboard() {
    const balance = state.portfolioValueSGD || 0;

    if (elements.dashTotalBalance) {
        elements.dashTotalBalance.textContent = isBalanceHidden ? '****' : formatCurrencySGD(balance);
    }
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

    try {
        const id = elements.portfolioIdInput.value;
        const ticker = elements.pfTickerInput.value.trim().toUpperCase();
        const shares = parseFloat(elements.pfSharesInput.value);

        // 1. Basic Input Validation
        if (!ticker || isNaN(shares) || shares <= 0) {
            alert("Please enter a valid ticker and a positive number of shares.");
            return;
        }

        // 2. Ticker Active Verification
        btn.textContent = "Verifying Ticker...";
        const livePriceCheck = await fetchLivePrice(ticker);
        if (livePriceCheck === 0) {
            alert(`Invalid Ticker: Could not find any live pricing data for ${ticker}!`);
            return;
        }

        btn.textContent = "Saving...";

        const avg_price = 0;
        const current_price = 0;

        if (id) {
            // Edit mode: check if another position already exists with this ticker
            const existingOther = state.portfolio.find(p => p.ticker.toUpperCase() === ticker && p.id !== id);
            if (existingOther) {
                // Merge shares into existingOther and delete this duplicate row
                const combinedShares = Math.round((Number(existingOther.shares) + shares) * 100000) / 100000;
                const { data: updatedData, error: updateError } = await supabaseClient
                    .from('portfolio')
                    .update({ shares: combinedShares })
                    .eq('id', existingOther.id)
                    .select();

                await supabaseClient.from('portfolio').delete().eq('id', id);

                if (!updateError && updatedData) {
                    state.portfolio = state.portfolio.filter(p => p.id !== id);
                    const idx = state.portfolio.findIndex(p => p.id === existingOther.id);
                    if (idx !== -1) state.portfolio[idx] = updatedData[0];
                    closeModal(elements.portfolioModal);
                    renderPortfolio();
                } else {
                    console.error("Error updating portfolio:", updateError);
                    alert("Failed to update asset.");
                }
            } else {
                const payload = { ticker, shares, avg_price, current_price };
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
            }
        } else {
            // Add mode: check if ticker already exists in portfolio
            const existingAsset = state.portfolio.find(p => p.ticker.toUpperCase() === ticker);
            if (existingAsset) {
                // Add shares on top of existing shares
                const newShares = Math.round((Number(existingAsset.shares) + shares) * 100000) / 100000;
                const { data, error } = await supabaseClient
                    .from('portfolio')
                    .update({ shares: newShares })
                    .eq('id', existingAsset.id)
                    .select();

                if (!error && data) {
                    const idx = state.portfolio.findIndex(p => p.id === existingAsset.id);
                    if (idx !== -1) state.portfolio[idx] = data[0];
                    closeModal(elements.portfolioModal);
                    renderPortfolio();
                } else {
                    console.error("Error adding to existing asset:", error);
                    alert("Failed to add shares to existing asset.");
                }
            } else {
                // New position
                const payload = { user_id: currentUser.id, ticker, shares, avg_price, current_price };
                const { data, error } = await supabaseClient
                    .from('portfolio')
                    .insert([payload])
                    .select();

                if (!error && data) {
                    state.portfolio.push(data[0]);
                    state.portfolio.sort((a, b) => a.ticker.localeCompare(b.ticker));
                    closeModal(elements.portfolioModal);
                    renderPortfolio();
                } else {
                    console.error("Error saving portfolio:", error);
                    alert("Failed to save asset.");
                }
            }
        }
    } catch (err) {
        console.error("Portfolio submit error:", err);
        alert("An error occurred while saving the asset.");
    } finally {
        btn.textContent = "Save Portfolio";
        btn.disabled = false;
    }
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
                    <button class="action-btn" onclick="editPortfolio('${escapeHTML(asset.id)}')" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="action-btn delete" onclick="deletePortfolio('${escapeHTML(asset.id)}')" title="Delete">
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

    // --- Portfolio History Snapshot & Daily PnL ---
    if (totalValue > 0 && elements.portfolioDailyPnl && currentUser) {
        let history = state.portfolioHistory;
        const now = new Date();
        const sgtTime = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + (8 * 60 * 60 * 1000));
        const logicalDate = new Date(sgtTime.getTime() - 4 * 60 * 60 * 1000);
        const dateStr = logicalDate.toISOString().split('T')[0];
        const sgtHour = sgtTime.getHours();
        
        let todaySnapshot = history.find(h => h.date === dateStr);
        let shouldUpdate = false;
        let shouldInsert = false;

        if (todaySnapshot) {
            if (sgtHour >= 4 && sgtHour < 20 && todaySnapshot.value !== totalValue) {
                todaySnapshot.value = totalValue;
                shouldUpdate = true;
            }
        } else {
            todaySnapshot = { date: dateStr, value: totalValue, user_id: currentUser.id };
            history.unshift(todaySnapshot);
            shouldInsert = true;
        }

        if (shouldUpdate) {
            supabaseClient.from('portfolio_history')
                .update({ value: totalValue })
                .eq('id', todaySnapshot.id)
                .then(({error}) => { if(error) console.error("History update error", error); });
        } else if (shouldInsert) {
            supabaseClient.from('portfolio_history')
                .insert([{ user_id: currentUser.id, date: dateStr, value: totalValue }])
                .select()
                .then(({data, error}) => {
                    if(!error && data && data.length > 0) {
                        const idx = state.portfolioHistory.findIndex(h => h.date === dateStr);
                        if(idx !== -1) state.portfolioHistory[idx] = data[0];
                    } else {
                        console.error("History insert error", error);
                    }
                });
        }

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

function renderHistoryTable() {
    if (!elements.historyTableBody) return;

    const history = state.portfolioHistory.slice(0, 30);
    
    if (history.length === 0) {
        elements.historyTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">No history recorded yet! Check back tomorrow once your first snapshot is logged.</td></tr>';
        return;
    }

    let html = '';
    
    for (let i = 0; i < history.length; i++) {
        const curr = history[i];
        let growthHtml = '<span class="text-muted">-</span>';
        
        if (i < history.length - 1) {
            const prev = history[i+1];
            const diff = curr.value - prev.value;
            const pct = prev.value > 0 ? (diff / prev.value) * 100 : 0;
            const sign = diff >= 0 ? '+' : '-';
            const colorClass = diff >= 0 ? 'success-text' : 'danger-text';
            growthHtml = `<span class="${colorClass}">${sign}${formatCurrency(Math.abs(diff))} (${sign}${Math.abs(pct).toFixed(2)}%)</span>`;
        }
        
        html += `
            <tr>
                <td>${formatDate(curr.date)}</td>
                <td><strong>${formatCurrency(curr.value)}</strong></td>
                <td>${growthHtml}</td>
            </tr>
        `;
    }
    
    elements.historyTableBody.innerHTML = html;
}

// Run app
init();

// Auto-refresh Stock Portfolio every 1 hour (3600000 ms)
setInterval(() => {
    if (state.portfolio && state.portfolio.length > 0) {
        renderPortfolio();
    }
}, 3600000);
