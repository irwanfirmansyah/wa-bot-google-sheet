/* =========================
   REQUIRE DULU (WAJIB PALING ATAS)
========================= */
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const puppeteer = require('puppeteer-core');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
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
});

client.on('ready', () => {
  console.log('🤖 Bot siap & online 24 jam');
});

/* =========================
   UTILITAS
========================= */
function detectKategori(text) {
  const t = text.toLowerCase();

  const kategoriRules = {
    PENDAFTARAN: [
      'daftar', 'pendaftaran', 'ppdb', 'masuk pesantren',
      'biaya', 'uang', 'spp', 'bayar',
      'syarat', 'formulir', 'umur', 'kelas',
      'tahun ajaran', 'gelombang'
    ],

    INFORMASI: [
      'alamat', 'lokasi', 'maps', 'dimana',
      'fasilitas', 'asrama', 'ac', 'kamar',
      'kurikulum', 'pelajaran', 'jenjang',
      'mts', 'ma', 'smp', 'sma',
      'jadwal', 'kegiatan', 'program'
    ],

    KUNJUNGAN: [
      'berkunjung', 'survey', 'datang',
      'lihat langsung', 'kunjungan',
      'hari apa bisa datang'
    ],

    KONTAK: [
      'nomor', 'telepon', 'hp',
      'kontak', 'whatsapp admin'
    ]
  };

  let skor = {};

  for (const kategori in kategoriRules) {
    skor[kategori] = 0;

    kategoriRules[kategori].forEach(keyword => {
      if (t.includes(keyword)) {
        skor[kategori]++;
      }
    });
  }

  // Ambil kategori dengan skor tertinggi
  let hasil = 'LAINNYA';
  let maxSkor = 0;

  for (const kategori in skor) {
    if (skor[kategori] > maxSkor) {
      maxSkor = skor[kategori];
      hasil = kategori;
    }
  }

  return hasil;
}


function isJamKerja() {
  const jam = new Date().getHours();
  return jam >= 1 && jam <= 20;
}

/* =========================
   GOOGLE SHEET
========================= */
async function saveToSheet(msg, kategori) {
  await axios.post(GOOGLE_SCRIPT_URL, {
    nama: msg._data.notifyName || 'Tidak diketahui',
    nomor: msg.from.replace('@c.us', ''),
    pesan: msg.body,
    kategori: kategori,
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

📊 Data Sheet:
${SHEET_LINK}`;

  await client.sendMessage(ADMIN_NUMBER, text);
}
client.on('message_create', msg => {
  // jika admin mengirim pesan ke user
  if (msg.from === ADMIN_NUMBER && msg.to) {
    csHandled.add(msg.to);
    console.log('🛑 CS MODE AKTIF untuk:', msg.to);
  }
});

function getAutoReply(kategori) {
  switch (kategori) {

    case 'PENDAFTARAN':
      return `📌 *Informasi Pendaftaran*

Terima kasih telah menghubungi Pondok Pesantren Darurrahmah 🙏
Admin PPDB kami akan segera membalas dengan informasi lengkap:
• Info Biaya : https://www.daarurrahmah.com/info-biaya-pendaftaran-2026-pondok-pesantren-darurrahmah-bogor.html
• Daftar Online : https://tally.so/r/wLRgaj
• Jadwal pendaftaran`;

    case 'INFORMASI':
      return `📍 *Informasi Pesantren*

Pondok Pesantren Darurrahmah
📌 Gunung Putri – Bogor https://maps.app.goo.gl/bJC8HR9qsEiCf4gk7
🏫 Asrama, Masjid, Fasilitas ber-AC

Admin kami akan segera melengkapi informasinya 🙏`;

    case 'KUNJUNGAN':
      return `📅 *Kunjungan Pesantren*

Silakan melakukan kunjungan ke Pondok Pesantren Darurrahmah.
Kami buka setiap hari, pukul 08.00-16.00 🙏`;

    case 'KONTAK':
      return `📞 *Kontak Admin*

Terima kasih, admin PPDB akan segera menghubungi Anda melalui WhatsApp 🙏`;

    default:
      return `Terima kasih atas pesan Anda 🙏
Admin kami akan segera merespons.`;
  }
}
async function sendBrosurPDF(msg) {
  const filePath = path.join(__dirname, 'brosur', 'brosur-ppdb-darurrahmah.pdf');
  const media = MessageMedia.fromFilePath(filePath);

  await client.sendMessage(msg.from, media, {
    caption: `📄 *Brosur Resmi PPDB*
Pondok Pesantren Darurrahmah

Silakan dipelajari, admin siap membantu 🙏`
  });
}

/* =========================
   LISTENER PESAN
========================= */
client.on('message', async msg => {
  if (msg.from.includes('@g.us')) return;

  // USER minta bot aktif lagi
  if (
    csHandled.has(msg.from) &&
    ['menu', 'admin', 'mulai'].includes(msg.body.toLowerCase())
  ) {
    csHandled.delete(msg.from);
    msg.reply('🤖 Bot aktif kembali, silakan kirim pesan 🙏');
    return;
  }

  // jika sedang di-handle admin, bot DIAM
  if (csHandled.has(msg.from)) {
    return;
  }

  // abaikan pesan admin ke bot
  if (msg.from === ADMIN_NUMBER) return;

  if (!isJamKerja()) {
    msg.reply(`⏰ *Di luar jam layanan*

Jam operasional:
🕗 08.00 – 20.00 WIB

Pesan Anda tetap kami simpan dan akan dibalas pada jam kerja 🙏`);
    return;
  }

  const kategori = detectKategori(msg.body);

  try {
    await saveToSheet(msg, kategori);
    await notifyAdmin(msg, kategori);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  msg.reply(getAutoReply(kategori));

  // kirim brosur otomatis (jika aktif)
  if (kategori === 'PENDAFTARAN') {
    await sendBrosurPDF(msg);
  }
});


/* =========================
   START BOT
========================= */
client.initialize();
