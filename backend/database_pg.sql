-- PostgreSQL Database Schema for Shastika WhatsApp AI Auto-Reply Bot

-- Updated_at Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Employees Table (Authentication & BDE Assignment)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('Admin', 'BDE')),
    status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'On Leave')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 2. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    country VARCHAR(100),
    language VARCHAR(50),
    lastMessage TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Handover', 'Blocked')),
    assigned_bde_id INT REFERENCES employees(id) ON DELETE SET NULL,
    intent VARCHAR(100),
    is_important BOOLEAN DEFAULT FALSE,
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 3. Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    price DECIMAL(10, 2),
    moq INT,
    availability VARCHAR(20) DEFAULT 'In Stock' CHECK (availability IN ('In Stock', 'Out of Stock', 'Made to Order')),
    shippingInfo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 4. Conversations Table (Multi-Number Aware)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'handover')),
    requires_admin_attention BOOLEAN DEFAULT FALSE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(100) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(50),
    sender VARCHAR(20) NOT NULL CHECK (sender IN ('customer', 'ai', 'human')),
    content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'delivered',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast conversation history lookup
CREATE INDEX IF NOT EXISTS idx_messages_customer_timestamp ON messages (customer_id, timestamp ASC);

-- 6. Auto Reply Rules Table
CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id SERIAL PRIMARY KEY,
    keyword VARCHAR(255) NOT NULL,
    reply_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. WhatsApp Connections Table (Multi-Number Management)
CREATE TABLE IF NOT EXISTS whatsapp_connections (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    whatsapp_phone_number VARCHAR(50) NOT NULL,
    phone_number_id VARCHAR(50) NOT NULL UNIQUE,
    meta_app_id VARCHAR(100),
    access_token TEXT NOT NULL,
    bot_enabled BOOLEAN DEFAULT TRUE,
    connection_status VARCHAR(50) DEFAULT 'Unverified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_whatsapp_connections_updated_at ON whatsapp_connections;
CREATE TRIGGER update_whatsapp_connections_updated_at
    BEFORE UPDATE ON whatsapp_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Bot Settings Table
CREATE TABLE IF NOT EXISTS bot_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON bot_settings;
CREATE TRIGGER update_bot_settings_updated_at
    BEFORE UPDATE ON bot_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed Default Bot Settings
INSERT INTO bot_settings (setting_key, setting_value, description) VALUES 
('auto_reply_enabled', 'true', 'Enable or disable bot auto replies globally'),
('ai_model', 'gemini-3.5-flash-lite', 'Gemini AI model for auto-replies'),
('ai_response_style', 'Professional', 'Tone and style of AI responses'),
('ai_system_prompt', 'You are a helpful and polite WhatsApp customer support AI for Shastika Global Impex. Your goal is to answer customer questions accurately based ONLY on the provided context below.', 'Base system prompt for AI'),
('welcome_message', '👋 Welcome to Shastika Global Impex! Thank you for reaching out. How may we assist you today?', 'Default welcome message'),
('first_time_greeting', '👋 Hello! Welcome to Shastika Global Impex. We''re delighted to connect with you. How may we assist you?', 'Greeting for new contacts'),
('outside_hours_reply', 'Thank you for contacting us. Our team is currently unavailable, but we’ve received your message and will respond during business hours.', 'Outside business hours auto reply'),
('holiday_reply', 'Thank you for reaching out! Our office is currently closed for a holiday. We’ll get back to you as soon as our team resumes work.', 'Holiday auto reply')
ON CONFLICT (setting_key) DO NOTHING;
