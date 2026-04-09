-- Supabase Database Setup Script for Finance Tracker & Trading Journal

-- Create the TRANSACTIONS table
CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable Row Level Security (RLS) on transactions
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for transactions (Users can only read/insert/update/delete their OWN data)
CREATE POLICY "Users can select their own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Create the TRADES table
CREATE TABLE trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    asset TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price NUMERIC(18, 5) NOT NULL,
    exit_price NUMERIC(18, 5) NOT NULL,
    lot_size NUMERIC(10, 2) DEFAULT 0.00,
    stop_loss NUMERIC(18, 5) DEFAULT 0,
    take_profit NUMERIC(18, 5) DEFAULT 0,
    pnl NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS on trades
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Create policies for trades
CREATE POLICY "Users can select their own trades" ON trades
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trades" ON trades
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades" ON trades
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own trades" ON trades
    FOR DELETE USING (auth.uid() = user_id);

-- Create the BACKTEST SESSIONS table
CREATE TABLE backtest_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    initial_balance NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS for backtest sessions
ALTER TABLE backtest_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for backtest sessions
CREATE POLICY "Users can select their own backtest sessions" ON backtest_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own backtest sessions" ON backtest_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own backtest sessions" ON backtest_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own backtest sessions" ON backtest_sessions FOR DELETE USING (auth.uid() = user_id);

-- Create the BACKTEST TRADES table
CREATE TABLE backtest_trades (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES backtest_sessions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    asset TEXT DEFAULT 'XAUUSD',
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price NUMERIC(18, 5) NOT NULL,
    exit_price NUMERIC(18, 5) NOT NULL,
    lot_size NUMERIC(10, 2) DEFAULT 0.00,
    stop_loss NUMERIC(18, 5) DEFAULT 0,
    take_profit NUMERIC(18, 5) DEFAULT 0,
    pnl NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS for backtest trades
ALTER TABLE backtest_trades ENABLE ROW LEVEL SECURITY;

-- Policies for backtest trades
CREATE POLICY "Users can select their own backtest trades" ON backtest_trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own backtest trades" ON backtest_trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own backtest trades" ON backtest_trades FOR DELETE USING (auth.uid() = user_id);

-- Create the NOTES table
CREATE TABLE notes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    color TEXT DEFAULT '#1a1f2c',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS for notes
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Policies for notes
CREATE POLICY "Users can select their own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON notes FOR DELETE USING (auth.uid() = user_id);
