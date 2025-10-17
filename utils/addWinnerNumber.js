// scripts/addWinnerNumber.js
import mongoose from 'mongoose';
import WinnerNumber from '../models/winnerNumber.js';
import { MONGODB_URI } from './config.js';

async function addWinnerNumber() {
  await mongoose.connect(MONGODB_URI); // update with your DB name

  const winner = new WinnerNumber({
    drawDate: new Date('2025-10-02T12:00:00.000Z'), // any time on 2025-10-02
    winnerNumbers: {
      CA: 38,
      IT: 53,
      MX: 55,
      NZ: 21,
      KR: 20,
      IE: 37,
      UK: 13
      // add more as needed
    }
  });

  await winner.save();
  console.log('WinnerNumber added!');
  await mongoose.disconnect();
}

addWinnerNumber();