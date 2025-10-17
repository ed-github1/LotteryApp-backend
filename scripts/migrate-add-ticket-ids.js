// Migration script: Add 'id' field to all tickets in all orders
// Usage: node migrate-add-ticket-ids.js

import mongoose from 'mongoose';
import connectToDatabase from '../utils/db.js';
import Order from '../models/order.js';

async function migrate() {
  await connectToDatabase();
  console.log('✅ Connected to MongoDB');

  const orders = await Order.find({});
  let updatedCount = 0;

  for (const order of orders) {
    let changed = false;
    for (let idx = 0; idx < order.tickets.length; idx++) {
      // Always assign a new ObjectId to ticket.id
      order.tickets[idx].id = new mongoose.Types.ObjectId();
      changed = true;
    }
    if (changed) {
      order.markModified('tickets'); // Force Mongoose to treat tickets as modified
      await order.save();
      updatedCount++;
      console.log(`Updated order ${order._id}`);
    }
  }

  console.log(`
✅ Migration complete. Updated ${updatedCount} orders.`);
  process.exit(0);
}

migrate();
