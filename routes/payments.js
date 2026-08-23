// routes/payments.js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/order');

router.post('/create-payment-intent', async (req, res) => {
  try {

    const { orderId } = req.body;

    if (!orderId) return res.status(400).json({ message: 'Order ID is required.' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Order already paid.' });
    }

    const amountInCents = Math.round(order.total * 100);

    let paymentIntent;
    if (order.stripePaymentIntentId) {
      paymentIntent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId);
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: { orderId: order._id.toString() }
      });
      order.stripePaymentIntentId = paymentIntent.id;
      await order.save();
    }

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not initialize payment.' });
  }
});

// raw body needed for signature verification
router.post('/webhook',   express.raw({ type: 'application/json' }),async (req, res) => {
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
  const pi = event.data.object;

  console.log(`PaymentIntent for order ${pi.metadata.orderId} succeeded.`);
  await Order.findOneAndUpdate(
    { stripePaymentIntentId: pi.id },
    { paymentStatus: 'paid' , status: 'Order Placed' }
  );

  // TODO: clear cart, send confirmation email, etc.
}

else if (event.type === 'payment_intent.payment_failed') {
  const pi = event.data.object;


  await Order.findOneAndUpdate(
    { stripePaymentIntentId: pi.id },
    { paymentStatus: 'failed' }
  );
}

  res.json({ received: true });
});

module.exports = router;