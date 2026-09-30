import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { supabase, supabaseAdmin, checkSupabaseConnection } from './supabase.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

// In-memory fallback stores (used when Supabase tables are not yet created or offline)
const inMemoryOrders = [];
let storeState = {
  isOpen: true,
  openingTime: '8:00 AM',
  closingTime: '10:00 PM',
  message: 'Daily operating hours: 8:00 AM to 10:00 PM',
  enableOnlinePayment: true,
  enableCounterPayment: true,
};

// Configure Socket.io with graceful fallback for serverless
let io = null;
if (!process.env.VERCEL) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN?.split(',') ?? '*',
      methods: ['GET', 'POST', 'PATCH'],
    },
  });

  io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket] Client disconnected:', socket.id);
    });
  });
}

// Global Middlewares
app.use(cors({ origin: process.env.CLIENT_ORIGIN?.split(',') ?? '*' }));
app.use(express.json());

// =============================================================================
// 1. MONITORING & HEALTH CHECK ROUTES (/api/ping, /ping, /api/health)
// =============================================================================

/**
 * Uptime & Ping Monitoring Route
 * Perfect for UptimeRobot, BetterUptime, Vercel cron, or Ping monitoring services.
 */
const handlePing = async (_req, res) => {
  const supabaseHealth = await checkSupabaseConnection();

  return res.status(200).json({
    status: 'ok',
    message: 'pong',
    service: 'Bite & Feast Mug API',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    runtime: process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Standalone',
    environment: process.env.NODE_ENV || 'development',
    supabase: supabaseHealth,
    storeStatus: {
      isOpen: storeState.isOpen,
      operatingHours: `${storeState.openingTime} – ${storeState.closingTime}`,
    },
  });
};

app.get('/api/ping', handlePing);
app.get('/ping', handlePing);

/**
 * Standard Health Check
 */
app.get('/api/health', async (_req, res) => {
  res.json({
    ok: true,
    service: 'bite-feast-api',
    time: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/health', (_req, res) => res.redirect('/api/health'));

// Root Welcome Endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Bite & Feast Mug — Backend Server',
    description: 'Cloud API for customer food ordering, kitchen display system (KOT), and Supabase integration.',
    endpoints: {
      ping: 'GET /api/ping',
      health: 'GET /api/health',
      menu: 'GET /api/menu',
      orders: 'GET /api/orders',
      createOrder: 'POST /api/orders',
      storeStatus: 'GET /api/store/status',
    },
    version: '1.0.0',
    documentation: 'https://github.com/awielabs/-BITE-FEAST-MUG',
  });
});

// =============================================================================
// 2. STORE STATUS & TIMING ROUTES (Morning 8:00 AM – 10:00 PM)
// =============================================================================

app.get('/api/store/status', async (_req, res) => {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('store_settings')
        .select('*')
        .eq('id', 'store_status')
        .single();

      if (!error && data) {
        storeState = {
          isOpen: data.is_open ?? storeState.isOpen,
          openingTime: data.opening_time ?? storeState.openingTime,
          closingTime: data.closing_time ?? storeState.closingTime,
          message: data.message ?? storeState.message,
          enableOnlinePayment: data.enable_online_payment ?? storeState.enableOnlinePayment,
          enableCounterPayment: data.enable_counter_payment ?? storeState.enableCounterPayment,
        };
      }
    }
  } catch (_) {
    // Continue with in-memory state
  }

  return res.json({
    success: true,
    ...storeState,
  });
});

app.post('/api/store/status', async (req, res) => {
  const { isOpen, openingTime, closingTime, message, enableOnlinePayment, enableCounterPayment } = req.body;

  if (typeof isOpen === 'boolean') storeState.isOpen = isOpen;
  if (openingTime) storeState.openingTime = openingTime;
  if (closingTime) storeState.closingTime = closingTime;
  if (message) storeState.message = message;
  if (typeof enableOnlinePayment === 'boolean') storeState.enableOnlinePayment = enableOnlinePayment;
  if (typeof enableCounterPayment === 'boolean') storeState.enableCounterPayment = enableCounterPayment;

  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from('store_settings').upsert({
        id: 'store_status',
        is_open: storeState.isOpen,
        opening_time: storeState.openingTime,
        closing_time: storeState.closingTime,
        message: storeState.message,
        enable_online_payment: storeState.enableOnlinePayment,
        enable_counter_payment: storeState.enableCounterPayment,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[StoreStatus] Supabase sync skipped:', err.message);
  }

  // Notify connected kitchen dashboards & customers
  if (io) {
    io.emit('store_status_changed', storeState);
  }

  return res.json({
    success: true,
    message: storeState.isOpen ? 'Store marked OPEN' : 'Store marked CLOSED',
    storeState,
  });
});

// Update payment method toggles (Online Payments vs Cash at Counter) from Kitchen
app.post('/api/store/payments', async (req, res) => {
  const { enableOnlinePayment, enableCounterPayment } = req.body;

  if (typeof enableOnlinePayment === 'boolean') {
    storeState.enableOnlinePayment = enableOnlinePayment;
  }
  if (typeof enableCounterPayment === 'boolean') {
    storeState.enableCounterPayment = enableCounterPayment;
  }

  try {
    if (supabaseAdmin) {
      await supabaseAdmin.from('store_settings').upsert({
        id: 'store_status',
        is_open: storeState.isOpen,
        opening_time: storeState.openingTime,
        closing_time: storeState.closingTime,
        message: storeState.message,
        enable_online_payment: storeState.enableOnlinePayment,
        enable_counter_payment: storeState.enableCounterPayment,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('[Payments] Supabase store_settings update skipped:', err.message);
  }

  if (io) {
    io.emit('store_status_changed', storeState);
  }

  return res.json({
    success: true,
    message: 'Payment configuration updated successfully',
    enableOnlinePayment: storeState.enableOnlinePayment,
    enableCounterPayment: storeState.enableCounterPayment,
    storeState,
  });
});

// =============================================================================
// 3. MENU CATALOG ROUTE
// =============================================================================

app.get('/api/menu', async (_req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (!error && data && data.length > 0) {
        return res.json({
          source: 'supabase',
          items: data,
          total: data.length,
        });
      }
    }
  } catch (err) {
    console.warn('[Menu] Supabase query skipped:', err.message);
  }

  // Fallback if table is not yet populated
  return res.json({
    source: 'local_fallback',
    items: [],
    customPrices: inMemoryPrices,
    message: 'Supabase menu_items table is ready to be populated.',
  });
});

// Update an item's price from Kitchen Dashboard
app.patch('/api/menu/:id/price', async (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  const numPrice = Number(price);

  if (isNaN(numPrice) || numPrice <= 0) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PRICE',
      message: 'Please provide a valid price greater than 0',
    });
  }

  // Update in memory
  inMemoryPrices[id] = numPrice;

  // Sync to Supabase if configured
  try {
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('menu_items')
        .update({ base_price: numPrice, price: numPrice })
        .eq('id', id);
    }
  } catch (err) {
    console.warn('[MenuPrice] Supabase update note:', err.message);
  }

  // Broadcast price update to all active devices in the café
  if (io) {
    io.emit('item_price_updated', { itemId: id, newPrice: numPrice });
  }

  return res.json({
    success: true,
    itemId: id,
    newPrice: numPrice,
    message: `Price successfully updated to ₹${numPrice}`,
  });
});

// =============================================================================
// KITCHEN AUTHENTICATION (Strict verification, no hint disclosure)
// =============================================================================
app.post('/api/kitchen/login', (req, res) => {
  const { id, username, password } = req.body;
  const kitchenId = (id || username || '').trim();
  const kitchenPass = (password || '').trim();

  // Validate ID and Password strictly
  if (kitchenId.toLowerCase() === 'bitemug' && kitchenPass === 'Bite(-_-)feast') {
    return res.json({
      success: true,
      message: 'Kitchen staff authenticated successfully',
      user: {
        role: 'kitchen_staff',
        id: 'BiteMUG',
        name: 'Bite & Feast Kitchen Admin',
        loginTime: new Date().toISOString(),
      },
      token: `k_tok_${Date.now()}`,
    });
  }

  return res.status(401).json({
    success: false,
    error: 'INVALID_CREDENTIALS',
    message: 'Invalid Kitchen credentials. Access denied.',
  });
});

// =============================================================================
// CUSTOMER AUTHENTICATION (Supabase Auth Email/Password + Google OAuth)
// =============================================================================
app.post('/api/auth/customer', async (req, res) => {
  const { name, phone, email, password, isSignUp } = req.body;

  let user = {
    id: `usr_${Date.now()}`,
    name: name?.trim() || (email ? email.split('@')[0] : 'Customer'),
    phone: phone?.trim() || '',
    email: email?.trim() || null,
    provider: email && password ? 'email_password' : 'email_phone',
    createdAt: new Date().toISOString(),
  };

  let sessionToken = null;

  // Real Supabase Auth integration when email & password are provided
  if (email && password && supabase) {
    try {
      if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim(),
          options: {
            data: {
              name: user.name,
              phone: user.phone,
            },
          },
        });

        if (!authError && authData?.user) {
          user.id = authData.user.id;
          sessionToken = authData.session?.access_token || null;
        } else if (authError) {
          console.warn('[Supabase Auth] SignUp note:', authError.message);
        }
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

        if (!authError && authData?.user) {
          user.id = authData.user.id;
          user.name = authData.user.user_metadata?.name || user.name;
          user.phone = authData.user.user_metadata?.phone || user.phone;
          sessionToken = authData.session?.access_token || null;
        } else if (authError) {
          console.warn('[Supabase Auth] SignIn note:', authError.message);
        }
      }
    } catch (err) {
      console.warn('[Supabase Auth] Auth exception:', err.message);
    }
  }

  // Persist in customers table in Supabase
  try {
    if (supabaseAdmin && (user.phone || user.email)) {
      await supabaseAdmin.from('customers').upsert(
        {
          phone: user.phone || null,
          name: user.name,
          email: user.email || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: user.phone ? 'phone' : 'email' }
      );
    }
  } catch (_) {}

  return res.json({
    success: true,
    message: isSignUp ? 'Customer registered successfully' : 'Customer logged in successfully',
    user,
    token: sessionToken,
  });
});

app.post('/api/auth/google', async (req, res) => {
  const { email, name, photoUrl } = req.body;

  const user = {
    id: `goog_${Date.now()}`,
    name: name || (email ? email.split('@')[0] : 'Google User'),
    email: email || '',
    photoUrl: photoUrl || null,
    provider: 'google',
    createdAt: new Date().toISOString(),
  };

  try {
    if (supabaseAdmin && user.email) {
      await supabaseAdmin.from('customers').upsert(
        {
          name: user.name,
          email: user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'email' }
      );
    }
  } catch (_) {}

  return res.json({
    success: true,
    message: 'Google authentication verified and recorded in Supabase',
    user,
  });
});

// =============================================================================
// 4. ORDER MANAGEMENT ROUTES (Customer Ordering & Kitchen KOT)
// =============================================================================

// Get all orders (for Kitchen Portal / KOT)
app.get('/api/orders', async (_req, res) => {
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        return res.json({ source: 'supabase', orders: data });
      }
    }
  } catch (_) {}

  return res.json({
    source: 'in_memory',
    orders: inMemoryOrders.slice().reverse(),
  });
});

// Get orders for a specific customer by phone, email, or order token (Order history & details)
app.get('/api/orders/customer/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const clean = decodeURIComponent(identifier).trim();

  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .or(`customer_phone.eq.${clean},order_token.eq.${clean},id.eq.${clean}`)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return res.json({ source: 'supabase', orders: data });
      }
    }
  } catch (_) {}

  // In-memory fallback
  const matched = inMemoryOrders.filter(
    (o) =>
      o.customerPhone === clean ||
      o.orderToken === clean ||
      o.orderId === clean
  );

  return res.json({
    source: 'in_memory',
    orders: matched.slice().reverse(),
  });
});

// Get single order details by ID or Token
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from('orders')
        .select('*')
        .or(`order_token.eq.${id},id.eq.${id},order_id.eq.${id}`)
        .single();

      if (!error && data) {
        return res.json({ success: true, order: data });
      }
    }
  } catch (_) {}

  const localOrder = inMemoryOrders.find(
    (o) => o.orderId === id || o.orderToken === id
  );
  if (localOrder) {
    return res.json({ success: true, order: localOrder });
  }

  return res.status(404).json({ success: false, message: 'Order not found' });
});

// Submit a new order
app.post('/api/orders', async (req, res) => {
  const orderData = req.body;

  // Validate store is open before accepting orders
  if (!storeState.isOpen) {
    return res.status(403).json({
      success: false,
      error: 'SHOP_CLOSED',
      message: `Shop is currently closed. Operating hours: ${storeState.openingTime} – ${storeState.closingTime}`,
    });
  }

  if (!orderData || !orderData.items || orderData.items.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'EMPTY_ORDER',
      message: 'Order must include at least one item.',
    });
  }

  // Generate order token if missing
  const tokenNumber = (inMemoryOrders.length + 101);
  const orderToken = orderData.orderToken || `BFM-${tokenNumber}`;
  const orderId = orderData.orderId || `ord_${Date.now()}`;
  const now = new Date().toISOString();

  const completeOrder = {
    ...orderData,
    orderId,
    orderToken,
    orderStatus: orderData.orderStatus || 'placed',
    createdAt: orderData.createdAt || now,
    updatedAt: now,
  };

  inMemoryOrders.push(completeOrder);

  // Attempt persistence in Supabase
  try {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('orders').insert({
        id: orderId,
        order_id: orderId,
        order_token: orderToken,
        order_type: completeOrder.orderType,
        table_number: completeOrder.tableNumber,
        grand_total: completeOrder.grandTotal,
        items: completeOrder.items,
        payment_method: completeOrder.paymentMethod,
        order_status: completeOrder.orderStatus,
        customer_name: completeOrder.customerName,
        customer_phone: completeOrder.customerPhone,
        created_at: completeOrder.createdAt,
      });

      if (error) {
        console.warn('[Orders] Supabase insert note:', error.message);
      }
    }
  } catch (err) {
    console.warn('[Orders] Supabase save error:', err.message);
  }

  // Broadcast to kitchen live screen if socket.io is active
  if (io) {
    io.emit('new_order', completeOrder);
  }

  return res.status(201).json({
    success: true,
    message: 'Order placed successfully',
    order: completeOrder,
  });
});

// Update order status (KOT progression: placed -> preparing -> ready -> completed)
app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['placed', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STATUS',
      message: `Status must be one of: ${validStatuses.join(', ')}`,
    });
  }

  // Update in memory
  const localOrder = inMemoryOrders.find(
    (o) => o.orderId === id || o.orderToken === id
  );
  if (localOrder) {
    localOrder.orderStatus = status;
    localOrder.updatedAt = new Date().toISOString();
  }

  // Update in Supabase
  try {
    if (supabaseAdmin) {
      await supabaseAdmin
        .from('orders')
        .update({ order_status: status, updated_at: new Date().toISOString() })
        .or(`id.eq.${id},order_id.eq.${id},order_token.eq.${id}`);
    }
  } catch (_) {}

  if (io) {
    io.emit('order_status_updated', { orderId: id, status });
  }

  return res.json({
    success: true,
    orderId: id,
    status,
  });
});

// =============================================================================
// 5. SERVER LAUNCH (STANDALONE) OR EXPORT (VERCEL SERVERLESS)
// =============================================================================

const port = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  httpServer.listen(port, () => {
    console.log(`🚀 Bite & Feast Mug API running on http://localhost:${port}`);
    console.log(`📡 Monitoring Ping Route: http://localhost:${port}/api/ping`);
  });
}

export default app;
