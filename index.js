const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me'; // KENDI ATERNOS ADRESINI YAZ
const PORT = process.env.PORT || 8080;
// 1. MEB'I ASAN WEBSOCKET KOPRUSU
const wss = new WebSocket.Server({ port: PORT });
function resolveAternos(callback) {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (err || !addresses || addresses.length === 0) return callback(null, null);
        callback(addresses[0].name, addresses[0].port);
    });
}
wss.on('connection', (ws) => {
    resolveAternos((host, port) => {
        if (!host || !port) { ws.close(); return; }
        const tcpSocket = net.connect(port, host);
        ws.on('message', (data) => tcpSocket.write(data));
        tcpSocket.on('data', (data) => ws.send(data));
        tcpSocket.on('close', () => ws.close());
        ws.on('close', () => tcpSocket.end());
        tcpSocket.on('error', () => ws.close());
    });
});
// 2. ATERNOS'U 7/24 ACIK TUTAN AFK BOTU
function startBot() {
    resolveAternos((host, port) => {
        if (!host || !port) {
            setTimeout(startBot, 15000);
            return;
        }
        const bot = mineflayer.createBot({
            host: host,
            port: port,
            username: 'SunucuNöbetçisi',
            version: '1.20.1'
        });
        bot.on('spawn', () => {
            console.log('[BOT] Aternos sunucusuna girildi. 7/24 kilit aktif.');
            // AuthMe varsa bota otomatik kayit/giris yaptir
            setTimeout(() => {
                bot.chat('/register BotSifre123 BotSifre123');
                bot.chat('/login BotSifre123');
            }, 2000);
        });
        bot.on('end', () => {
            console.log('[BOT] Baglanti dustu, 10 saniye sonra tekrar baglaniliyor...');
            setTimeout(startBot, 10000);
        });
        bot.on('error', (err) => {
            console.log('[BOT] Hata, yeniden deneniyor:', err.message);
        });
    });
}
// Botu baslat
setTimeout(startBot, 5000);
console.log(`MEB Bridge & AFK Bot Hazir - Port: ${PORT}`);
