// language: JavaScript, file: index.js, runtime: Node.js 18+
// Zero-Packet-Loss MEB Proxy & 24/7 Single-Instance Bot Guard
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me';
const PORT = process.env.PORT || 8080;

let cachedHost = null;
let cachedPort = null;

// SRV kaydini dinamik takip et
function refreshDNS() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            cachedHost = addresses[0].name;
            cachedPort = addresses[0].port;
            console.log(`[DNS] Canli Aternos: ${cachedHost}:${cachedPort}`);
        }
    });
}
refreshDNS();
setInterval(refreshDNS, 20000);

// MEB WebSocket Koprusu
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[PROXY] Okuldan oyuncu baglandi.');

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

// 24/7 TEKİL NÖBETÇİ BOT MOTORU
let isBotRunning = false;
let botInstance = null;

function spawnAFKBot() {
    if (isBotRunning) return; // Çift bot açılmasını engeller
    if (!cachedHost || !cachedPort) {
        setTimeout(spawnAFKBot, 10000);
        return;
    }

    isBotRunning = true;
    try {
        console.log(`[BOT] Tekil baglanti baslatiliyor: ${cachedHost}:${cachedPort}`);
        botInstance = mineflayer.createBot({
            host: cachedHost,
            port: cachedPort,
            username: 'NobetciBot',
            version: '1.20.1',
            auth: 'offline',
            checkTimeoutInterval: 60000
        });

        botInstance.once('spawn', () => {
            console.log('[BOT] >>> NobetciBot DÜNYAYA GİRDİ! 7/24 KİLİT AKTİF <<<');
            setTimeout(() => {
                botInstance.chat('/register BotSifre123 BotSifre123');
                botInstance.chat('/login BotSifre123');
            }, 1500);

            // Her 45 saniyede bir kol sallama (Anti-AFK)
            setInterval(() => {
                if (botInstance && botInstance.entity) {
                    botInstance.look(botInstance.entity.yaw + 0.1, 0, true);
                    botInstance.swingArm('right');
                }
            }, 45000);
        });

        botInstance.once('end', (reason) => {
            console.log('[BOT] Baglanti sonlandi (' + reason + '), 10s sonra tekil giris yapilacak...');
            isBotRunning = false;
            botInstance = null;
            setTimeout(spawnAFKBot, 10000);
        });

        botInstance.on('error', (err) => {
            console.log('[BOT Hata]:', err.message);
        });
    } catch (e) {
        console.error('[BOT Istisna]:', e.message);
        isBotRunning = false;
        setTimeout(spawnAFKBot, 10000);
    }
}

// Botu baslat
setTimeout(spawnAFKBot, 5000);

console.log(`MEB Bridge & 7/24 Engine Hazir - Port: ${PORT}`);
