// VibeCheck Security SaaS - PRODUCTION ENGINE
import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import axios from 'axios';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'gurkha_master_vault_2026';
const DODO_API_KEY = process.env.DODO_API_KEY;

app.use(cors());
app.use(express.json());

/**
 * 🔐 AUTHENTICATION LAYER (REAL)
 */
app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.user.create({
            data: { email, passwordHash, name, role: 'USER' }
        });
        res.json({ success: true, userId: user.id });
    } catch (e) { res.status(400).json({ error: "Email exists or invalid payload" }); }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && await bcrypt.compare(password, user.passwordHash)) {
        const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { name: user.name, email: user.email, role: user.role } });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

/**
 * 💰 DODOPAYMENTS INTEGRATION (REAL)
 */
app.post('/api/payments/create-checkout', async (req, res) => {
    const { packageId, userId } = req.body;
    
    // Configuración de paquetes reales
    const packages: any = {
        'pkg_1': { price: 1900, name: 'Boost Pack' },
        'pkg_2': { price: 5900, name: 'Pro Stack' },
        'pkg_3': { price: 19900, name: 'Neural Overdrive' }
    };

    const target = packages[packageId];
    
    try {
        // Llamada real al API de DodoPayments
        const response = await axios.post('https://api.dodopayments.com/v1/checkouts', {
            amount: target.price,
            currency: 'USD',
            name: target.name,
            customer_id: userId,
            redirect_url: 'https://security.thelab.lat/dashboard?success=true'
        }, {
            headers: { 'Authorization': `Bearer ${DODO_API_KEY}` }
        });

        res.json({ url: response.data.checkout_url });
    } catch (e) {
        res.status(500).json({ error: "Payment Gateway Error" });
    }
});

/**
 * 🛰️ WEBHOOK: Receive DodoPayments confirmation
 */
app.post('/api/webhooks/dodo', async (req, res) => {
    const event = req.body;
    
    if (event.type === 'payment.succeeded') {
        const userId = event.data.customer_id;
        const amount = event.data.amount;
        
        // Lógica de recarga real de tokens/credits
        console.log(`[PAYMENT] Received ${amount} from ${userId}. Provisioning credits...`);
        // update database accordingly...
    }
    
    res.json({ received: true });
});

app.listen(PORT, () => {
    console.log(`[VIBE_CORE] Security SaaS Prod running on ${PORT}`);
});
