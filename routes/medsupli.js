const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const admin = require('firebase-admin');
const db = admin.firestore();
const stripeKey = process.env.STRIPE_SECRET_TEST_KEY;
const stripe = new Stripe(stripeKey);

// GET /medsupli?userId=...&plan_id=...
router.get('/', async (req, res) => {
    try {
        const { userId, plan_id } = req.query;

        if (!userId || !plan_id) {
            return res.status(400).send('Missing userId or plan_id');
        }

        // Fetch plan from 'plans' collection
        const planDoc = await db.collection('plans').doc(plan_id).get();

        if (!planDoc.exists) {
            return res.status(404).send('Plan not found!');
        }

        const planData = planDoc.data();
        // console.log('--- Plan Data Fetched ---', planData);

        res.render('medsupli', {
            userId,
            plan_id,
            planName: planData.title || 'Plan',
            planPrice: planData.price || '0.00',
            planType: planData.type || 'Recurring',
            publishableKey: process.env.STRIPE_PUBLIC_KEY
        });
    } catch (err) {
        console.error('Error loading medsupli page:', err);
        res.status(500).send('Internal Server Error');
    }
});

// POST /medsupli/pay
router.post('/pay', async (req, res) => {
    try {
        const { stripeToken, userId, plan_id } = req.body;

        if (!stripeToken || !userId || !plan_id) {
            return res.status(400).json({ success: false, message: 'Missing payment data' });
        }

        // 1. Fetch plan again to get price and type
        const planDoc = await db.collection('plans').doc(plan_id).get();
        if (!planDoc.exists) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        const planData = planDoc.data();

        console.log('--- Plan Data Fetched ---', planData);

        // 2. Create Stripe Charge
        const charge = await stripe.charges.create({
            amount: Math.round(parseFloat(planData.price) * 100), // in cents
            currency: 'usd',
            source: stripeToken,
            description: `Payment for plan ${planData.title} by user ${userId}`,
        });

        if (charge.status === 'succeeded') {
            // 3. Calculate Expiry Date
            let daysToAdd = 30; // default for monthly
            if (planData.type && planData.type.toLowerCase() === 'yearly') {
                daysToAdd = 365;
            }

            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + daysToAdd);

            // 4. Update 'product_vendors' collection
            const vendorRef = db.collection('product_vendors').doc(userId);
            await vendorRef.set({
                subscriptionType: planData.type,
                paymentStatus: 'paid',
                expiryDate: admin.firestore.Timestamp.fromDate(expiryDate),
                plan_id: plan_id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            }, { merge: true });

            return res.status(200).json({ success: true, message: 'Payment successful!' });
        } else {
            return res.status(400).json({ success: false, message: 'Payment failed with status: ' + charge.status });
        }

    } catch (err) {
        console.error('Payment processing error:', err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
