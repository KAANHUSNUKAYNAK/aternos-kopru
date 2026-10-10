// language: JavaScript, file: index.js, runtime: Node.js 18+
// Zero-Packet-Loss Buffer Proxy & Robust AFK Bot
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me'; // KENDI ATERNOS ADRESIN
const PORT = process.env.PORT || 8080;

let cachedHost = null;
let cachedPort = null;

// SRV kaydını sürekli canlı tut
function refreshDNS() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            cachedHost = addresses[0].name;
            cachedPort = addresses[0].port;
            console.log(`[DNS] Aternos Hedef: ${cachedHost}:${cachedPort}`);
        }
    });
}
refreshDNS();
setInterval(refreshDNS, 20000);

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[PROXY] Oyuncu baglandi.');

    const connectToBackend = (host, port) => {
        const tcpSocket = net.connect(port, host);
        const bufferQueue = [];
        let isConnected = false;

        ws.on('message', (data) => {
            if (!isConnected) {
                bufferQueue.push(data);
            } else {
                tcpSocket.write(data);
            }
        });

        tcpSocket.on('connect', () => {
            isConnected = true;
            while (bufferQueue.length > 0) {
                tcpSocket.write(bufferQueue.shift());
            }
        });

        tcpSocket.on('data', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        tcpSocket.on('close', () => ws.close());
        ws.on('close', () => tcpSocket.end());
        tcpSocket.on('error', () => ws.close());
        ws.on('error', () => tcpSocket.end());
    };

    if (cachedHost && cachedPort) {
        connectToBackend(cachedHost, cachedPort);
    } else {
        dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                ws.close();
                return;
            }
            cachedHost = addresses[0].name;
            cachedPort = addresses[0].port;
            connectToBackend(cachedHost, cachedPort);
        });
    }
});

// AFK BOT (Ingilizce saf karakter: AFK_Guard)
let botInstance = null;

function spawnAFKBot() {
    if (!cachedHost || !cachedPort) {
        console.log('[BOT] Aternos adresi bekleniyor...');
        setTimeout(spawnAFKBot, 10000);
        return;
    }

    try {
        console.log(`[BOT] ${cachedHost}:${cachedPort} adresine baglaniyor...`);
        botInstance = mineflayer.createBot({
            host: cachedHost,
            port: cachedPort,
            username: 'AFK_Guard', // Turkce karaktersiz saf isim
            version: '1.20.1'
        });

        botInstance.on('spawn', () => {
            console.log('[BOT] >>> AFK_Guard SUNUCUDA! 7/24 KILIT AKTIF <<<');
            setTimeout(() => {
                botInstance.chat('/register BotSifre123 BotSifre123');
                botInstance.chat('/login BotSifre123');
            }, 2000);
        });

        botInstance.on('end', (reason) => {
            console.log('[BOT] Ayrildi (' + reason + '), 10 saniye sonra yeniden girecek...');
            setTimeout(spawnAFKBot, 10000);
        });

        botInstance.on('error', (err) => {
            console.log('[BOT Hata]:', err.message);
            setTimeout(spawnAFKBot, 10000);
        });

        botInstance.on('kicked', (reason) => {
            console.log('[BOT Atildi]:', reason);
            setTimeout(spawnAFKBot, 10000);
        });
    } catch (e) {
        console.error('[BOT Istisna]:', e.message);
        setTimeout(spawnAFKBot, 10000);
    }
}

// 5 saniye sonra botu atese ver
setTimeout(spawnAFKBot, 5000);

console.log(`MEB Buffer Proxy & AFK Engine Aktif - Port: ${PORT}`);
