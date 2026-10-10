// language: JavaScript, file: index.js, runtime: Node.js 18+ (Render)
// Okul MEB Port 443 WSS Koprusu + Aternos 24/7 Nobetci Bot (Anti-AFK / Anti-Ban)
const http = require('http');
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me';
const PORT = process.env.PORT || 8080;

let targetHost = null;
let targetPort = null;
let isBotActive = false;
let reconnectTimer = null;

// 1. UPTIMEROBOT & HTTP SAGLIK KONTROLU (Render'i 7/24 Ayakta Tutar)
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`[KOPRU AKTIF]\nHedef: ${targetHost || 'Aternos Kapali'}:${targetPort || '-'}\nBot Durumu: ${isBotActive ? 'Sunucuda Nobette' : 'Beklemede'}`);
});

// 2. MEB WEBSOCKET TUNELI (Port 443 WSS -> Aternos TCP)
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('[MEB TUNEL] Okuldan baglanti alindi.');

    if (!targetHost || !targetPort) {
        console.log('[MEB TUNEL] Aternos su an kapali, baglanti reddedildi.');
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
        console.log('[MEB TUNEL] Aternos soketine baglandi. Trafik aktariliyor.');
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
        console.log('[MEB TUNEL TCP HATA]:', err.message);
        ws.close();
    });

    tcpSocket.on('close', () => {
        ws.close();
    });

    ws.on('close', () => {
        tcpSocket.destroy();
    });
});

// 3. ATERNOS SRV COZUCU (Dinamik Portu Otomatik Bulur)
function resolveTarget() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            const newHost = addresses[0].name;
            const newPort = addresses[0].port;
            if (targetHost !== newHost || targetPort !== newPort) {
                targetHost = newHost;
                targetPort = newPort;
                console.log(`[HEDEF GUNCELLENDI] Aternos: ${targetHost}:${targetPort}`);
            }
            if (!isBotActive && !reconnectTimer) {
                scheduleBotConnect(5000);
            }
        } else {
            targetHost = null;
            targetPort = null;
        }
    });
}
resolveTarget();
setInterval(resolveTarget, 20000);

// 4. GUCLENDIRILMIS NOBETCI BOT (Anti-Ban, Anti-AFK, Human Simulation)
function scheduleBotConnect(delayMs) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startBot();
    }, delayMs);
}

function startBot() {
    if (isBotActive || !targetHost || !targetPort) return;

    console.log(`[BOT] Aternos'a baglaniliyor: ${targetHost}:${targetPort}...`);
    isBotActive = true;

    let bot = null;
    let afkInterval = null;

    try {
        bot = mineflayer.createBot({
            host: targetHost,
            port: targetPort,
            username: 'NobetciBot',
            version: '1.20.1',
            auth: 'offline',
            checkTimeoutInterval: 60000
        });
    } catch (e) {
        console.log('[BOT BASLATMA HATASI]:', e.message);
        isBotActive = false;
        scheduleBotConnect(30000);
        return;
    }

    bot.once('spawn', () => {
        console.log('[BOT] SUNUCUYA GIRDI! Nobet basladi.');

        // AuthMe Sifresi
        setTimeout(() => {
            if (bot) {
                bot.chat('/register BotSifre123 BotSifre123');
                bot.chat('/login BotSifre123');
            }
        }, 2000);

        // Insan Simülasyonu: 10 saniyede bir etrafa bak, zipla, kol salla
        afkInterval = setInterval(() => {
            if (!bot || !bot.entity) return;

            const randomYaw = (Math.random() * Math.PI * 2) - Math.PI;
            const randomPitch = (Math.random() * 0.8) - 0.4;
            bot.look(randomYaw, randomPitch, true);

            // Zipla
            bot.setControlState('jump', true);
            setTimeout(() => {
                if (bot) bot.setControlState('jump', false);
            }, 300);

            // Kolunu salla
            bot.swingArm('right');
        }, 12000);
    });

    const cleanup = (reason) => {
        console.log(`[BOT AYRILDI]: ${reason}`);
        if (afkInterval) clearInterval(afkInterval);
        isBotActive = false;
        // Asla spam yapma, ban yememek icin sakince 30 saniye bekle
        scheduleBotConnect(30000);
    };

    bot.once('end', (reason) => cleanup(`End: ${reason}`));
    bot.once('kicked', (reason) => cleanup(`Kicked: ${reason}`));
    bot.on('error', (err) => console.log('[BOT HATA]:', err.message));
}

// Portu Dinle
server.listen(PORT, () => {
    console.log(`[RENDER KOPRU] Calisiyor. Port: ${PORT}`);
});
