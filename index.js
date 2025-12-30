/* =========================
   REQUIRE
========================= */
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const path = require('path');

const csHandled = new Set();

/* =========================
   CLIENT
========================= */
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }
});

/* =========================
   KONFIGURASI
========================= */
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_ClFH0wm83S17Exq0AUkhA4DsMcu6-9qVs1OWVzwWE_SnOU8FVoUXeuK30-DrzTXMzQ/exec';
const SHEET_LINK = 'https://docs.google.com/spreadsheets/d/1AbCxxxxxxx';
const ADMIN_NUMBER = '6281234567890@c.us';

/* =========================
   QR & READY
========================= */
client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
  console.log('📲 QR RECEIVED');
});

client.on('ready', () => {
  console.log('🤖 Bot siap & online');
});

/* =========================
   UTILITAS
========================= */
function detectKategori(text) {
  const t = text.toLowerCase();

  const kategoriRules = {
    PENDAFTARAN: [
      'daftar','pendaftaran','ppdb','biaya','spp',
      'syarat','formulir','umur','gelombang'
    ],
    INFORMASI: [
      'alamat','lokasi','maps','fasilitas','asrama',
      'kurikulum','mts','ma','smp','sma'
    ],
    KUNJUNGAN: [
      'kunjungan','survey','datang','lihat langsung'
    ],
    KONTAK: [
      'nomor','telepon','kontak','admin'
    ]
  };

  let hasil = 'LAINNYA';
  let max = 0;

  for (const k in kategoriRules) {
    const score = kategoriRules[k].filter(w => t.includes(w)).length;
    if (score > max) {
      max = score;
      hasil = k;
    }
  }

  return hasil;
}

function isJamKerja() {
  const jam = new Date().getHours();
  return jam >= 8 && jam <= 20;
}

/* =========================
   GOOGLE SHEET
========================= */
async function saveToSheet(msg, kategori) {
  await axios.post(GOOGLE_SCRIPT_URL, {
    nama: msg._data.notifyName || 'Tidak diketahui',
    nomor: msg.from.replace('@c.us', ''),
    pesan: msg.body,
    kategori,
    waktu: new Date().toLocaleString('id-ID')
  });
}

/* =========================
   NOTIF ADMIN
========================= */
async function notifyAdmin(msg, kategori) {
  const text = `📩 *CHAT BARU*

👤 Nama: ${msg._data.notifyName || '-'}
📱 Nomor: ${msg.from.replace('@c.us','')}
🏷️ Kategori: ${kategori}

💬 Pesan:
${msg.body}

📊 Sheet:
${SHEET_LINK}`;

  await client.sendMessage(ADMIN_NUMBER, text);
}

/* =========================
   AUTO REPLY
========================= */
function getAutoReply(kategori) {
  switch (kategori) {
    case 'PENDAFTARAN':
      return `📌 *Informasi Pendaftaran*

Admin PPDB kami akan segera membalas 🙏
• Info Biaya
• Pendaftaran Online
• Jadwal & Gelombang`;

    case 'INFORMASI':
      return `📍 *Informasi Pesantren*

Pondok Pesantren Darurrahmah
📌 Gunung Putri – Bogor`;

    case 'KUNJUNGAN':
      return `📅 *Kunjungan Pesantren*

Kami buka setiap hari
🕗 08.00 – 16.00 WIB`;

    case 'KONTAK':
      return `📞 *Kontak Admin*

Admin PPDB akan segera menghubungi Anda 🙏`;

    default:
      return `Terima kasih atas pesan Anda 🙏
Admin kami akan segera merespons.`;
  }
}

/* =========================
   KIRIM BROSUR
========================= */
async function sendBrosurPDF(msg) {
  const filePath = path.join(__dirname, 'brosur', 'brosur-ppdb-darurrahmah.pdf');
  const media = MessageMedia.fromFilePath(filePath);

  await client.sendMessage(msg.from, media, {
    caption: `📄 *Brosur Resmi PPDB*
Silakan dipelajari 🙏`
  });
}

/* =========================
   CS MODE (ADMIN)
========================= */
client.on('message_create', msg => {
  if (msg.from === ADMIN_NUMBER && msg.to) {
    csHandled.add(msg.to);
    console.log('🛑 CS MODE AKTIF:', msg.to);
  }
});

/* =========================
   LISTENER PESAN
========================= */
client.on('message', async msg => {
  if (msg.from.includes('@g.us')) return;

  // aktifkan bot lagi
  if (
    csHandled.has(msg.from) &&
    ['menu','admin','mulai'].includes(msg.body.toLowerCase())
  ) {
    csHandled.delete(msg.from);
    return msg.reply('🤖 Bot aktif kembali, silakan kirim pesan 🙏');
  }

  if (csHandled.has(msg.from)) return;
  if (msg.from === ADMIN_NUMBER) return;

  if (!isJamKerja()) {
    return msg.reply(`⏰ *Di luar jam layanan*
08.00 – 20.00 WIB`);
  }

  const kategori = detectKategori(msg.body);

  try {
    await saveToSheet(msg, kategori);
    await notifyAdmin(msg, kategori);
  } catch (e) {
    console.error('Sheet/Admin Error:', e.message);
  }

  await msg.reply(getAutoReply(kategori));

  if (kategori === 'PENDAFTARAN') {
    await sendBrosurPDF(msg);
  }
});

/* =========================
   START BOT (HANYA SEKALI)
========================= */
client.initialize();
