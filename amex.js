const { chromium } = require('playwright');
const { open } = require('node:fs/promises')

async function readVariables(filepath) {
  const file = await open(filepath);
  const vars = {};
  for await (const line of file.readLines()) {
    const [key, val] = line.split('=');
    vars[key] = val;
  }
  return vars;
}


(async () => {
  // read login info and create browser
  const env = await readVariables('.env');
  const browser = await chromium.launch({
    headless: false
  });

  // open browser and log in
  const page = await browser.newPage();
  await page.goto('https://americanexpress.com');
  await page.getByRole('link', {name: 'Log In', 'exact': true}).click();
  await page.waitForLoadState('networkidle');
  await page.locator('#eliloUserID').fill(env['AMEX_LOGIN']);
  await page.locator('#eliloPassword').fill(env['AMEX_PASSWORD']);
  await page.locator('#loginSubmit').click();
  await page.waitForURL(new RegExp(/.+\/dashboard/));

  // search date range for transactions (current month at the moment, maybe custom later)
  const currentDate = new Date();
  const firstDate = '01';
  const todayDate = String(currentDate.getDate()).padStart(2, '0');
  const todayMonth = String(currentDate.getMonth()+1).padStart(2, '0');
  const todayYear = String(currentDate.getFullYear());
  const monthBeginning = `${todayYear}-${todayMonth}-${firstDate}`;
  const today = `${todayYear}-${todayMonth}-${todayDate}`;
  await page.goto(`https://global.americanexpress.com/activity/search?from=${monthBeginning}&to=${today}`);
  await page.getByLabel('Start Date', { exact: true }).fill('03/01/2023', {force: true });
  await page.getByRole('button', {name: 'Search'}).click();
  await page.waitForLoadState('networkidle');
  let rows;
  try {
    await page.getByRole('button', {name: 'Status'}).click();
 		await page.getByRole('button', {name: 'posted'}).click();
  	await page.waitForLoadState('networkidle');
    rows = await page.getByRole('table').filter({ hasText: 'results found'}).locator('tbody').locator('div').all();
	} catch (err) {
    console.log(err);
		console.log('No pending charges');
  	rows = await page.getByRole('table').locator('tbody').locator('div').all();
	}
  for (const row of rows) {
    const res = await row.getAttribute('id');
    if (res !== null && res.includes('transaction')) {
      const transactionNumber = res.split('_')[1];
      let output = `Transaction ${transactionNumber}\n`;
      const transactionDate = await row.locator('label').textContent();
      const transactionAmount = await row.locator('p', {hasText: new RegExp(/\$\d+\.\d{2}/)}).first().textContent();
      let transactionMerchant = await row.locator('a').textContent();
      transactionMerchant = transactionMerchant.split(' ').filter(s => s.length > 0).join(' ');
      output += `Date: ${transactionDate}\n`;
      output += `Amount: ${transactionAmount}\n`;
      output += `Merchant: ${transactionMerchant}\n`;
      console.log(output);
    }
  }
  await browser.close();
})();
