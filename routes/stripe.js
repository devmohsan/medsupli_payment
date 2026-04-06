const express = require('express')
const router = express.Router();
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const Stripe = require('stripe');

const db = admin.firestore();

router.get('/success', async (req, res) => {
   const { restaurant_id, session_id} = req.query;
   try {

            // let stripeKey = process.env.STRIPE_LIVE_SECRET_KEY     
           let stripeKey= process.env.STRIPE_SECRET_TEST_KEY
      
      
            // let testMode= false
            // if(is_test == 'true'){

            //    stripeKey= process.env.STRIPE_SECRET_TEST_KEY
            //    testMode= true         
            // }
      

            const stripe = new Stripe( stripeKey)

      const session = await stripe.checkout.sessions.retrieve(session_id);
  const subscriptionId = session.subscription;

      const orderRef = db.collection('restaurants').doc(restaurant_id);
      await orderRef.update({ subscription_paid: true,
        subscription_id: subscriptionId,
       });
      return res.render('success');
   } catch (err) {
      console.error('Error updating order status:', err);
      res.status(500).json({ error: err.message });
   }
});


router.get('/get-one', async (req, res) => {
   const { order_id } = req.query;
   try {
      const orderRef = db.collection('orders').doc(order_id);
      const orderSnap = await orderRef.get();
      if (orderSnap.exists) {
         const orderData = orderSnap.data();
         return res.status(200).json(orderData);
      } else {
         return res.status(404).json({ error: 'Order not found!' });
      }
   } catch (err) {
      return res.status(500).json({ error: err.message });
   }
});

// Show Stripe payment page
router.get('/', (req, res) => {
  try {
    const { amount, userId, bookingId } = req.query;

   //  if (!amount || !userId || !bookingId) {
   //    return res.status(400).send('Missing payment parameters');
   //  }

    res.render('stripe', {
      amount,
      userId,
      bookingId,
      publishableKey: process.env.STRIPE_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('Stripe page error:', err);
    res.status(500).send('Unable to load payment page');
  }
});

module.exports = router