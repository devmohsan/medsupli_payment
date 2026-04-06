const express = require('express')
const router = express.Router();
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const Stripe = require('stripe');

const db = admin.firestore();

router.get('/products', async (req, res) => {
   try {
      const stripeKey = process.env.STRIPE_SECRET_TEST_KEY
      const stripe = new Stripe(stripeKey)
      const products = await stripe.products.list({
  active: true, // Only fetch active products
});


      const filtered = products.data.map((product) => ({
         id: product.id,
         name: product.name,
         description: product.description,
         active: product.active,
         default_price: product.default_price,
         created: product.created,
         updated: product.updated,
         type: product.type
      }));
      const batch = db.batch();
      filtered.forEach((product) => {
         const docRef = db.collection('subscriptions').doc(product.id); // using Stripe product ID as document ID
         batch.set(docRef, product);
      });
      await batch.commit();
      res.status(200).json({ message: 'Products saved to Firestore!', count: filtered.length });
   } catch (err) {
      console.error('Error:', err.message);
      res.status(500).json({ error: err.message });
   }
});


router.post('/add-customer', async (req, res) => {
   try {
      const { email, name,} = req.body;

      // let stripeKey = process.env.STRIPE_LIVE_SECRET_KEY

          let  stripeKey= process.env.STRIPE_SECRET_TEST_KEY

      // let testMode= false
      // if(is_test == true){
         
      //    testMode= true         
      // }

      const stripe = new Stripe( stripeKey)

      const userRef = db.collection('restaurants').where('restaurantEmail', '==', email);
      const userSnap = await userRef.get();
      if (userSnap.empty) {
         return res.status(404).json({ error: 'User not found!' });
      }

      const userDoc = userSnap.docs[0];
      const customer = await stripe.customers.create({ email, name });
      await userDoc.ref.update({ stripe_cid: customer.id });


      return res.status(200).json({ customer});
   } catch (err) {
      return res.status(500).json({ error: err.message });
   }
});

router.post('/add-subscription', async (req, res) => {
   try {
      const { customer_id, price_id, is_test } = req.body;

      let stripeKey = process.env.STRIPE_LIVE_SECRET_KEY



      let testMode= false
      if(is_test == true){
         stripeKey= process.env.STRIPE_SECRET_TEST_KEY
         testMode= true         
      }

      const stripe = new Stripe( stripeKey)

      const subscription = await stripe.subscriptions.create({
         customer: customer_id,
         items: [{ price: price_id }],
         payment_behavior: 'default_incomplete',
         payment_settings: {
            payment_method_types: ['card']
         },
         expand: ['latest_invoice.payment_intent'], // this is required
      });

      const latestInvoice = subscription.latest_invoice;
      const paymentIntent = latestInvoice?.payment_intent;

      return res.status(200).json({
         subscription_id: subscription,
         mode: testMode
      });

   } catch (err) {
      return res.status(500).json({ error: err.message });
   }
});


router.post('/create-checkout-session', async (req, res) => {
   try {
      const { customer_id, price_id, course_id, restaurant_id } = req.body;

      
      // let stripeKey = process.env.STRIPE_LIVE_SECRET_KEY

      let stripeKey= process.env.STRIPE_SECRET_TEST_KEY


      // let testMode= false
      // if(is_test == true){
         
      //    testMode= true         
      // }

      const stripe = new Stripe( stripeKey)

      // const existingOrderSnapshot = await db.collection('orders')
      //    .where('user_id', '==', user_id)
      //    .where('course_id', '==', course_id)
      //    .where('status', '==', 'PAID') // make sure to only fetch orders with status as 'PAID'
      //    .get();

      // if (!existingOrderSnapshot.empty) {
      //    return res.status(200).json({ error: 'You are already subscribed to this course.' });
      // }

      // 1. Get the price details from Stripe
      // const priceObj = await stripe.prices.retrieve(price_id);
      // const interval = priceObj.recurring?.interval;
      // const unitAmount = priceObj.unit_amount / 100;

      // // 2. Calculate expiry
      // let daysToAdd = 30;
      // if (interval === 'year') daysToAdd = 365;
      // else if (interval === 'week') daysToAdd = 7;

      // const expiryDate = Timestamp.fromDate(new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000));
      // const createdAt = Timestamp.fromDate(new Date());

      // // 3. Generate Firestore document with custom ID
      // const orderDocRef = db.collection('orders').doc();
      // const orderId = orderDocRef.id;

      // await orderDocRef.set({
      //    id: orderId,
      //    course_id,
      //    price: `${unitAmount}`,
      //    expiry: expiryDate,
      //    status: 'pending',
      //    user_id,
      //    created_at: createdAt,
      //    card_id: '',
      //    subscription_id: '',

      // });

      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // 4. Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
         mode: 'subscription',
         customer: customer_id,
         line_items: [
            {
               price: price_id,
               quantity: 1,
            },
         ],
         success_url: `${baseUrl}/success?restaurant_id=${restaurant_id}&session_id={CHECKOUT_SESSION_ID}`,
         cancel_url: `${baseUrl}/cancel`,
         expand: ['subscription'], // <-- Expand subscription object
      });



      res.status(200).json({
         url: session.url,
         // order_id: orderId,
      });

   } catch (err) {
      console.error('Error creating checkout session:', err);
      res.status(500).json({ error: err.message });
   }
});


router.get('/get-order', async (req, res) => {
  try {
    const { subscription_id, is_test } = req.query;

          
      let stripeKey = process.env.STRIPE_LIVE_SECRET_KEY



      let testMode= false
      if(is_test == 'true'){
         stripeKey= process.env.STRIPE_SECRET_TEST_KEY
         testMode= true         
      }

      const stripe = new Stripe( stripeKey)
    if (!subscription_id) {
      return res.status(400).json({ error: 'subscription_id is required' });
    }

    // Fetch subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(subscription_id);

    // Check if it's active
    const isActive = subscription.status === 'active';

    res.status(200).json({
      status: isActive,
      subscription_status: subscription.status
    });
  } catch (err) {
    console.error('Error fetching subscription from Stripe:', err);
    res.status(500).json({ error: err.message });
  }
});

// --------------------------


router.post('/createCharges', async (req, res) => {
  try {
    const { stripeToken, amount, userId, bookingId } = req.body;

    if (!stripeToken || !amount || !userId || !bookingId) {
      return res.status(400).json({ success: false, message: 'Missing payment data' });
    }

    const stripeKey = process.env.STRIPE_SECRET_TEST_KEY;
    const stripe = new Stripe(stripeKey);

    // Create charge
    const charge = await stripe.charges.create({
      amount: parseInt(amount * 100), // cents
      currency: 'usd',
      source: stripeToken,
      description: `Payment for booking ${bookingId} by user ${userId}`,
    });


    if(charge.status == 'succeeded'){
          await db.collection('bookings').doc(bookingId).update({
      paymentStatus: 'paid',
      stripeChargeId: charge.id,
    });

    }
    // Update Firestore booking
   //  await db.collection('bookings').doc(bookingId).update({
   //    status: 'paid',
   //    stripeChargeId: charge.id,
   //    paidAt: admin.firestore.Timestamp.now(),
   //  });

    return res.status(200).json({ success: true, message: 'Payment successful!' });

  } catch (err) {
    console.error('Error processing payment:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});





module.exports = router