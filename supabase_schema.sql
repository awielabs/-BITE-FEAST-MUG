-- =============================================================================
-- BITE & FEAST MUG — COMPLETE SUPABASE DATABASE SCHEMA
-- =============================================================================
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/utabaevwryavresmdnek/sql/new
-- =============================================================================

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. STORE SETTINGS (Store Open/Closed & Operating Hours 8:00 AM – 10:00 PM)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
    id TEXT PRIMARY KEY DEFAULT 'store_status',
    is_open BOOLEAN NOT NULL DEFAULT true,
    opening_time TEXT NOT NULL DEFAULT '8:00 AM',
    closing_time TEXT NOT NULL DEFAULT '10:00 PM',
    message TEXT DEFAULT 'Shop is open and accepting orders',
    enable_online_payment BOOLEAN NOT NULL DEFAULT true,
    enable_counter_payment BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial store status
INSERT INTO public.store_settings (id, is_open, opening_time, closing_time, message, enable_online_payment, enable_counter_payment)
VALUES ('store_status', true, '8:00 AM', '10:00 PM', 'Bite & Feast Mug is open for orders', true, true)
ON CONFLICT (id) DO UPDATE SET
    opening_time = EXCLUDED.opening_time,
    closing_time = EXCLUDED.closing_time,
    enable_online_payment = EXCLUDED.enable_online_payment,
    enable_counter_payment = EXCLUDED.enable_counter_payment;

-- =============================================================================
-- 2. CUSTOMERS TABLE (Sign-ups via Name, Phone, Email & Google OAuth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    provider TEXT DEFAULT 'email_phone',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);

-- =============================================================================
-- 3. MENU ITEMS TABLE (Food & Beverage Catalog with Kitchen Stock & Prices)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT DEFAULT '',
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    image_url TEXT,
    emoji TEXT DEFAULT '🍽️',
    is_veg BOOLEAN DEFAULT true,
    is_bestseller BOOLEAN DEFAULT false,
    is_chef_special BOOLEAN DEFAULT false,
    prep_time_minutes INTEGER DEFAULT 10,
    size_variants JSONB DEFAULT '[]'::jsonb,
    available_addons JSONB DEFAULT '[]'::jsonb,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_available ON public.menu_items(is_available);

-- =============================================================================
-- 4. ORDERS TABLE (Customer Takeaway & Dine-in Orders with KOT Pipeline)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,
    order_token TEXT NOT NULL,
    customer_name TEXT DEFAULT 'Guest Foodie',
    customer_phone TEXT DEFAULT '',
    order_type TEXT NOT NULL DEFAULT 'takeaway',
    table_number TEXT,
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_code TEXT,
    grand_total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cashAtCounter',
    payment_status TEXT NOT NULL DEFAULT 'pending',
    order_status TEXT NOT NULL DEFAULT 'placed',
    kitchen_notes TEXT DEFAULT '',
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orders_order_token ON public.orders(order_token);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON public.orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- =============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow public read access to store settings and menu catalog
CREATE POLICY "Public can view store settings" 
    ON public.store_settings FOR SELECT USING (true);

CREATE POLICY "Public can view menu items" 
    ON public.menu_items FOR SELECT USING (true);

-- Allow public / anon insert for orders & customers
CREATE POLICY "Public can create orders" 
    ON public.orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can read their orders" 
    ON public.orders FOR SELECT USING (true);

CREATE POLICY "Public can register customer profile" 
    ON public.customers FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can view customer profile" 
    ON public.customers FOR SELECT USING (true);

-- Backend Service Role (SUPABASE_SECRET_KEY) has unrestricted access to all tables
CREATE POLICY "Service Role full access on store_settings"
    ON public.store_settings FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role full access on customers"
    ON public.customers FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role full access on menu_items"
    ON public.menu_items FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role full access on orders"
    ON public.orders FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 6. POPULATE INITIAL MENU ITEMS SEED DATA
-- =============================================================================
INSERT INTO public.menu_items (id, name, category, description, base_price, price, emoji, is_veg, is_bestseller)
VALUES
    ('fresh-mosambi', 'Mosambi Juice', 'Fresh Juices', 'Freshly squeezed sweet lime juice packed with natural Vitamin C', 50.00, 50.00, '🍊', true, false),
    ('fresh-watermelon', 'Watermelon Juice', 'Fresh Juices', 'Cooling, pure cold-pressed ruby watermelon juice, ultra refreshing', 50.00, 50.00, '🍉', true, true),
    ('fresh-muskmelon', 'Muskmelon Juice', 'Fresh Juices', 'Aromatic, honey-sweet fresh cantaloupe melon nectar', 50.00, 50.00, '🍈', true, false),
    ('fresh-pomegranate', 'Pomegranate Juice', 'Fresh Juices', 'Pure antioxidant-dense juice pressed from plump ruby red anar seeds', 60.00, 60.00, '🥤', true, true),
    ('fresh-grapes', 'Grapes Juice', 'Fresh Juices', 'Sweet and tangy crushed fresh grape juice served chilled', 60.00, 60.00, '🍇', true, false),
    ('fresh-apple', 'Apple Juice', 'Fresh Juices', 'Crisp, naturally sweet juice freshly extracted from crunchy apples', 60.00, 60.00, '🍎', true, false),
    ('fresh-pineapple', 'Pineapple Juice', 'Fresh Juices', 'Zesty golden tropical pineapple juice with a sweet-sour punch', 50.00, 50.00, '🍍', true, false),
    ('fresh-sapota', 'Sapota Juice', 'Fresh Juices', 'Deliciously rich, malty, caramel-toned fresh chikoo juice', 60.00, 60.00, '🥤', true, false),
    ('fresh-carrot', 'Carrot Juice', 'Fresh Juices', 'Fresh farm carrots pressed into a vibrant, vitamin-loaded healthy drink', 60.00, 60.00, '🥕', true, false),
    ('fresh-beetroot', 'Beetroot Juice', 'Fresh Juices', 'Earthy, deep crimson beetroot juice rich in nitrates & iron', 60.00, 60.00, '🥤', true, false),
    ('fresh-abc', 'ABC Juice (Apple + Beetroot + Carrot)', 'Fresh Juices', 'The miracle detox blend: crisp Apple, vibrant Beetroot & sweet Carrot', 80.00, 80.00, '🍹', true, true),
    ('fresh-lemon-juice', 'Lemon Juice — Sweet/Salt', 'Fresh Juices', 'Classic handcrafted nimbu paani made sweet, salted, or mixed to order', 25.00, 25.00, '🍋', true, false),
    ('fresh-lemon-soda', 'Lemon Soda — Sweet/Salt', 'Fresh Juices', 'Bubbly effervescent soda with fresh lemon and your favorite seasoning', 35.00, 35.00, '🥤', true, true),
    ('fresh-lemon-mint-juice', 'Lemon Mint Juice', 'Fresh Juices', 'Refreshing citrus cooler blended with handpicked fresh garden mint', 30.00, 30.00, '🍋', true, false),
    ('fresh-lemon-mint-soda', 'Lemon Mint Soda', 'Fresh Juices', 'Chilled sparkling soda with muddled mint leaves and zesty lemon juice', 40.00, 40.00, '🍹', true, false),
    ('fruit-shake-apple', 'Apple Milkshake', 'Fruit Milkshakes', 'Wholesome fresh apple pulp churned with rich cold milk & honey', 70.00, 70.00, '🍎', true, false),
    ('fruit-shake-avocado', 'Avocado / Butter Fruit Milkshake', 'Fruit Milkshakes', 'Creamy, rich and velvety superfood milkshake made with ripe avocados', 90.00, 90.00, '🥑', true, true),
    ('fruit-shake-red-banana', 'Red Banana Milkshake', 'Fruit Milkshakes', 'Distinctive sweet and creamy shake crafted with South Indian red bananas', 80.00, 80.00, '🍌', true, true),
    ('fruit-shake-aththi-fig', 'Aththi (Fig) Milkshake', 'Fruit Milkshakes', 'Wholesome nourishing fig milkshake steeped with dates & milk', 80.00, 80.00, '🥤', true, false),
    ('fruit-shake-guava', 'Guava Milkshake', 'Fruit Milkshakes', 'Exotic tropical shake bursting with fragrant pink guava sweetness', 80.00, 80.00, '🥤', true, false),
    ('fruit-shake-mango', 'Mango Milkshake', 'Fruit Milkshakes', 'Luscious Alphonso mango pulp blended smooth with chilled milk and cream', 70.00, 70.00, '🥭', true, true),
    ('ice-shake-chocolate', 'Belgian Chocolate Milkshake', 'Ice Cream Milkshakes', 'Dense Belgian dark chocolate churned with chocolate gelato and fudge', 80.00, 80.00, '🍫', true, true),
    ('ice-shake-strawberry', 'Strawberry Milkshake', 'Ice Cream Milkshakes', 'Pretty in pink milkshake made with strawberry cream and berry syrup', 70.00, 70.00, '🍓', true, false),
    ('ice-shake-butterscotch', 'Butterscotch Milkshake', 'Ice Cream Milkshakes', 'Rich caramel-butterscotch milkshake with crunchy praline bits', 70.00, 70.00, '🥤', true, false),
    ('ice-shake-oreo', 'Oreo Milkshake', 'Ice Cream Milkshakes', 'Chunky Oreo cookie crumble blended thick with sweet cream and chocolate', 80.00, 80.00, '🍪', true, true),
    ('ice-shake-kitkat', 'KitKat Milkshake', 'Ice Cream Milkshakes', 'Crunchy KitKat wafer bars crushed into velvety chocolate milkshake', 80.00, 80.00, '🍫', true, false),
    ('ice-shake-brownie', 'Brownie Cake Shake', 'Ice Cream Milkshakes', 'Warm fudge brownie blended into thick chocolate ice cream shake', 85.00, 85.00, '🍰', true, true),
    ('ice-shake-rose', 'Rose Milk', 'Ice Cream Milkshakes', 'Traditional cooling fragrant rose syrup stirred with chilled whole milk', 45.00, 45.00, '🥛', true, true),
    ('ice-shake-cold-badam', 'Cold Badam Milk', 'Ice Cream Milkshakes', 'Aromatic almond milk enriched with saffron, cardamom and crunchy nut slivers', 45.00, 45.00, '🥛', true, false),
    ('mojito-virgin', 'Virgin Mojito', 'Mojitos', 'Muddled fresh spearmint leaves, green lime wedges, simple syrup & soda', 50.00, 50.00, '🍹', true, true),
    ('mojito-lemon-mint', 'Lemon & Mint Mojito', 'Mojitos', 'Double citrus burst with extra pressed lime and fresh aromatic mint', 60.00, 60.00, '🍹', true, false),
    ('mojito-blue-curacao', 'Blue Curacao Mojito', 'Mojitos', 'Vibrant electric blue citrus cooler with mint, lime and sparkling fizz', 60.00, 60.00, '🍸', true, true),
    ('mojito-watermelon', 'Watermelon Mojito', 'Mojitos', 'Juicy fresh watermelon chunks muddled with cool mint and bubbly soda', 60.00, 60.00, '🍉', true, false),
    ('mojito-green-apple', 'Green Apple Mojito', 'Mojitos', 'Tart and crisp green apple syrup blended with lime and carbonated soda', 60.00, 60.00, '🍏', true, false),
    ('mojito-strawberry', 'Strawberry Mojito', 'Mojitos', 'Sweet berry crush muddled together with fresh mint and tangy lemon', 60.00, 60.00, '🍓', true, false),
    ('mojito-black-currant', 'Black Currant Mojito', 'Mojitos', 'Rich dark berry essence, crushed ice, fresh mint and effervescent soda', 60.00, 60.00, '🍇', true, false),
    ('cold-coffee', 'Cold Coffee', 'Tea & Hot Drinks', 'Thick creamy iced blended coffee with rich espresso aroma', 55.00, 55.00, '☕', true, true),
    ('tea-regular', 'Signature Kulhad Chai', 'Tea & Hot Drinks', 'Slow-brewed Assam tea with crushed ginger & cardamom in an earthen pot', 25.00, 25.00, '☕', true, true),
    ('coffee-filter', 'South Indian Filter Coffee', 'Tea & Hot Drinks', 'Frothy, freshly decanted chicory-infused blend served hot and creamy', 45.00, 45.00, '☕', true, true)
ON CONFLICT (id) DO UPDATE SET
    base_price = EXCLUDED.base_price,
    price = EXCLUDED.price,
    description = EXCLUDED.description;
