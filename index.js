import processAmex from './amex.js';

const amexTransactions = await processAmex();
amexTransactions.forEach((x) => console.log(x));
