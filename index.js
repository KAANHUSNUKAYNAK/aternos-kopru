// language: JavaScript, file: index.js, runtime: Node.js 18+
// Safe-Cooldown MEB Proxy & 24/7 Single Guard
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
    console.log('[PROXY] Okuldan baglanti alindi.');

    const connectToBackend = (host, port) => {
        const tcpSocket = net.connect(port, host);
        const bufferQueue = [];
        let isConnected = false;

        // 10 saniyede Aternos cevap vermezse soketi kitleyip bekletme:
        tcpSocket.setTimeout(10000, () => {
            console.log('[PROXY] Aternos soket zaman asimi.');
            tcpSocket.destroy();
            ws.close();
        });

        ws.on('message', (data) => {
            if (!isConnected) {
                bufferQueue.push(data);
            } else {
                tcpSocket.write(data);
            }
        });

        tcpSocket.on('connect', () => {
            console.log('[PROXY] Aternos soketi baglandi. Kuyruk aktariliyor...');
            isConnected = true;
            tcpSocket.setTimeout(0); // Baglandiktan sonra zaman asimini kaldir
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
        tcpSocket.on('error', (err) => {
            console.error('[TCP Hata]:', err.message);
            ws.close();
        });
        ws.on('error', (err) => {
            console.error('[WS Hata]:', err.message);
            tcpSocket.end();
        });
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

// 24/7 NÖBETÇİ BOT MOTORU (30s Guvenli Bekleme)
let isBotRunning = false;
let botInstance = null;

function spawnAFKBot() {
    if (isBotRunning) return;
    if (!cachedHost || !cachedPort) {
        setTimeout(spawnAFKBot, 15000);
        return;
    }

    isBotRunning = true;
    try {
        console.log(`[BOT] Guvenli baglanti aciliyor: ${cachedHost}:${cachedPort}`);
        botInstance = mineflayer.createBot({
            host: cachedHost,
            port: cachedPort,
            username: 'NobetciBot',
            version: '1.20.1',
            auth: 'offline',
            checkTimeoutInterval: 60000
        });

        botInstance.once('spawn', () => {
            console.log('[BOT] >>> NobetciBot DÜNYADA! 7/24 KİLİT AKTİF <<<');
            setTimeout(() => {
                botInstance.chat('/register BotSifre123 BotSifre123');
                botInstance.chat('/login BotSifre123');
            }, 1500);

            // Her 45 saniyede kol salla (Anti-AFK)
            setInterval(() => {
                if (botInstance && botInstance.entity) {
                    botInstance.look(botInstance.entity.yaw + 0.1, 0, true);
                    botInstance.swingArm('right');
                }
            }, 45000);
        });

        botInstance.once('end', (reason) => {
            console.log('[BOT] Ayrildi (' + reason + '), 30s guvenli soguma...');
            isBotRunning = false;
            botInstance = null;
            setTimeout(spawnAFKBot, 30000); // 30 saniye bekle ki Aternos spam sanmasin
        });

        botInstance.on('error', (err) => {
            console.log('[BOT Hata]:', err.message);
        });
    } catch (e) {
        console.error('[BOT Istisna]:', e.message);
        isBotRunning = false;
        setTimeout(spawnAFKBot, 30000);
    }
}

// Render basladiktan 10 saniye sonra botu sok
setTimeout(spawnAFKBot, 10000);

console.log(`MEB Bridge & Protected Guard Aktif - Port: ${PORT}`);
