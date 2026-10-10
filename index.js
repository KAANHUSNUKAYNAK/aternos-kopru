// language: JavaScript, file: index.js, runtime: Node.js 18+
// Bulletproof MEB Proxy & 24/7 Anti-Ban Cloud Bot
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me';
const PORT = process.env.PORT || 8080;

let targetHost = null;
let targetPort = null;

// SRV kaydını 20 saniyede bir kontrol et
function resolveTarget() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            targetHost = addresses[0].name;
            targetPort = addresses[0].port;
            console.log(`[HEDEF] Aternos: ${targetHost}:${targetPort}`);
        }
    });
}
resolveTarget();
setInterval(resolveTarget, 20000);

// 1. MEB WEBSOCKET KOPRUSU (KUSURSUZ AKTARICI)
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[PROXY] Okuldan baglanti alindi.');

    const connect = (host, port) => {
        const tcpSocket = net.connect(port, host);
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
            console.log('[PROXY] Aternos soketi baglandi. Kuyruk aktariliyor...');
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

        tcpSocket.on('close', () => ws.close());
        ws.on('close', () => tcpSocket.end());
        tcpSocket.on('error', (err) => {
            console.error('[TCP HATA]:', err.message);
            ws.close();
        });
        ws.on('error', (err) => {
            console.error('[WS HATA]:', err.message);
            tcpSocket.end();
        });
    };

    if (targetHost && targetPort) {
        connect(targetHost, targetPort);
    } else {
        dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
            if (!err && addresses && addresses.length > 0) {
                targetHost = addresses[0].name;
                targetPort = addresses[0].port;
                connect(targetHost, targetPort);
            } else {
                ws.close();
            }
        });
    }
});

// 2. 7/24 ZIRHLI NOBETCI MOTORU (ASLA BANLANMAZ)
let botRunning = false;
let botInstance = null;

function runGuardBot() {
    if (botRunning) return; // Cift bot girisini engelle
    if (!targetHost || !targetPort) {
        setTimeout(runGuardBot, 15000);
        return;
    }

    botRunning = true;
    console.log(`[BOT] Guvenli baglanti baslatiliyor: ${targetHost}:${targetPort}`);

    try {
        botInstance = mineflayer.createBot({
            host: targetHost,
            port: targetPort,
            username: 'NobetciBot',
            version: '1.20.1',
            auth: 'offline',
            checkTimeoutInterval: 60000
        });

        botInstance.once('spawn', () => {
            console.log('[BOT] >>> NobetciBot DÜNYAYA GİRDİ! 7/24 KİLİT AKTİF <<<');
            
            // AuthMe girisi
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

        // SADECE 'end' OLAYI YENIDEN BAGLAR (TEKIL YONETIM)
        botInstance.once('end', (reason) => {
            console.log(`[BOT] Ayrildi (${reason}). Güvenlik için 60 saniye soğuma bekleniyor...`);
            botRunning = false;
            botInstance = null;
            setTimeout(runGuardBot, 60000); // 60 saniye bekler, Aternos asla banlayamaz
        });

        botInstance.on('error', (err) => {
            console.log('[BOT Hata]:', err.message);
        });

    } catch (e) {
        console.error('[BOT Istisna]:', e.message);
        botRunning = false;
        setTimeout(runGuardBot, 60000);
    }
}

// Render acildiktan 10 saniye sonra botu atese ver
setTimeout(runGuardBot, 10000);

console.log(`MEB Bridge & Safe-Guard Ready - Port: ${PORT}`);
