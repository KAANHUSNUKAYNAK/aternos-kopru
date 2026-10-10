// language: JavaScript, file: index.js, runtime: Node.js 18+ (Render)
// Okul MEB Port 443 WSS Koprusu + Aternos 24/7 Nobetci Bot (Self-Healing / Live Log)
const http = require('http');
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me';
const FALLBACK_PORT = 34187;
const PORT = process.env.PORT || 8080;

let targetHost = ATERNOS_DOMAIN;
let targetPort = FALLBACK_PORT;
let isBotActive = false;
let isBotSpawned = false;
let reconnectTimer = null;
let currentBot = null;

const liveLogs = [];
function log(msg) {
    const entry = `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`;
    console.log(entry);
    liveLogs.push(entry);
    if (liveLogs.length > 40) liveLogs.shift();
}

// 1. TARAYICIDAN CANLI LOG VE DURUM PANELİ
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    let text = `=====================================\n`;
    text += `   OKUL MEB KOPRUSU & NOBETCI BOT    \n`;
    text += `=====================================\n`;
    text += `Hedef: ${targetHost}:${targetPort}\n`;
    text += `Bot Durumu: ${isBotSpawned ? '🟢 SUNUCUDA NOBETTE' : isBotActive ? '🟡 BAGLANIYOR' : '🔴 BEKLEMEDE'}\n\n`;
    text += `--- CANLI LOG AKISI ---\n`;
    text += liveLogs.join('\n') || 'Henuz log yok.';
    res.end(text);
});

// 2. MEB WEBSOCKET TUNELI (Port 443 WSS -> Aternos TCP)
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    log('[MEB TUNEL] Okuldan baglanti alindi.');

    if (!targetHost || !targetPort) {
        log('[MEB TUNEL] Aternos kapali, baglanti reddedildi.');
        ws.close();
        return;
    }

    const tcpSocket = net.connect(targetPort, targetHost);
    const buffer = [];
    let connected = false;

    ws.on('message', (msg) => {
        if (!connected) {
            buffer.push(msg);
        } else {
            tcpSocket.write(msg);
        }
    });

    tcpSocket.on('connect', () => {
        log('[MEB TUNEL] Aternos soketine baglandi. Trafik aktariliyor.');
        connected = true;
        while (buffer.length > 0) {
            tcpSocket.write(buffer.shift());
        }
    });

    tcpSocket.on('data', (data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    tcpSocket.on('error', (err) => {
        log(`[MEB TUNEL TCP HATA]: ${err.message}`);
        ws.close();
    });

    tcpSocket.on('close', () => ws.close());
    ws.on('close', () => tcpSocket.destroy());
});

// 3. ATERNOS DINAMIK PORT COZUCU
function resolveTarget() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            targetHost = addresses[0].name;
            targetPort = addresses[0].port;
        } else {
            targetHost = ATERNOS_DOMAIN;
            targetPort = FALLBACK_PORT;
        }
        if (!isBotActive && !reconnectTimer) {
            scheduleBotConnect(3000);
        }
    });
}
resolveTarget();
setInterval(resolveTarget, 20000);

// 4. KENDINI ONARAN NOBETCI BOT (Anti-Stuck & Auto-Heal)
function scheduleBotConnect(delayMs) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot();
    }, delayMs);
}

function startBot() {
    if (isBotActive || !targetHost || !targetPort) return;

    log(`[BOT] Aternos'a baglanma girisimi: ${targetHost}:${targetPort}`);
    isBotActive = true;
    isBotSpawned = false;

    let afkInterval = null;

    try {
        currentBot = mineflayer.createBot({
            host: targetHost,
            port: targetPort,
            username: 'NobetciBot',
            version: '1.20.1',
            auth: 'offline',
            checkTimeoutInterval: 30000
        });
    } catch (e) {
        log(`[BOT BASLATMA HATASI]: ${e.message}`);
        cleanup('CreateBotError');
        return;
    }

    // 15 saniye baglanti sigortasi (Asılı kalırsa soketi yeniler)
    const connectTimeout = setTimeout(() => {
        if (!isBotSpawned) {
            log('[BOT TIMEOUT] 15 saniyede giris yapilamadi. Yeniden deneniyor...');
            cleanup('ConnectTimeout');
        }
    }, 15000);

    currentBot.on('login', () => log('[BOT] Login eventi tetiklendi. Sunucu kabul etti.'));

    currentBot.once('spawn', () => {
        clearTimeout(connectTimeout);
        isBotSpawned = true;
        log('[BOT] OYUNA GIRDI! Nobet basladi.');

        setTimeout(() => {
            if (currentBot) {
                currentBot.chat('/register BotSifre123 BotSifre123');
                currentBot.chat('/login BotSifre123');
            }
        }, 1500);

        // Insan Taklidi Loop (Zipla, bak, kol salla)
        afkInterval = setInterval(() => {
            if (!currentBot || !currentBot.entity) return;

            const randomYaw = (Math.random() * Math.PI * 2) - Math.PI;
            const randomPitch = (Math.random() * 0.8) - 0.4;
            currentBot.look(randomYaw, randomPitch, true);

            currentBot.setControlState('jump', true);
            setTimeout(() => {
                if (currentBot) currentBot.setControlState('jump', false);
            }, 300);

            currentBot.swingArm('right');
        }, 12000);
    });

    const cleanup = (reason) => {
        clearTimeout(connectTimeout);
        if (afkInterval) clearInterval(afkInterval);
        isBotActive = false;
        isBotSpawned = false;
        log(`[BOT AYRILDI]: ${reason}`);
        try {
            if (currentBot) currentBot.end();
        } catch (e) {}
        currentBot = null;
        scheduleBotConnect(20000);
    };

    currentBot.once('end', (reason) => cleanup(`End: ${reason}`));
    currentBot.once('kicked', (reason) => cleanup(`Kicked: ${JSON.stringify(reason)}`));
    currentBot.on('error', (err) => log(`[BOT HATA]: ${err.message}`));
}

// HTTP Portunu Dinle
server.listen(PORT, () => {
    log(`[RENDER KOPRU] Calisiyor. Port: ${PORT}`);
});
