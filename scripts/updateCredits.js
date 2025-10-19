// updateCredits.js
import mongoose from 'mongoose';
import { MONGODB_URI } from '../utils/config.js';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema);

const orderSchema = new mongoose.Schema({}, { strict: false });
const Order = mongoose.model('Order', orderSchema);

async function updateCredits() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const users = await User.find({});
  for (const user of users) {
    const orders = await Order.find({ user: user._id });
    const ticketCount = orders.reduce((sum, order) => sum + (order.tickets ? order.tickets.length : 0), 0);

    await User.updateOne({ _id: user._id }, { $set: { credits: ticketCount } });
    console.log(`User ${user.email || user._id}: credits set to ${ticketCount}`);
  }

  await mongoose.disconnect();
}

updateCredits().catch(console.error);