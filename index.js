// language: JavaScript, file: index.js, runtime: Node.js 18+
// Zero-Packet-Loss Buffer Proxy & SRV Cache
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');
const mineflayer = require('mineflayer');
const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me'; // KENDI ATERNOS ADRESINI YAZ
const PORT = process.env.PORT || 8080;
let cachedHost = null;
let cachedPort = null;
// SRV kaydini surekli taze tut (DNS gecikmesini 0'a indirir)
function refreshDNS() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            cachedHost = addresses[0].name;
            cachedPort = addresses[0].port;
            console.log(`[DNS] Aternos Canli Hedef: ${cachedHost}:${cachedPort}`);
        }
    });
}
refreshDNS();
setInterval(refreshDNS, 20000);
const wss = new WebSocket.Server({ port: PORT });
wss.on('connection', (ws) => {
    console.log('[PROXY] Okuldan baglanti alindi. Paketler kuyruga aliniyor...');
    const connectToBackend = (host, port) => {
        const tcpSocket = net.connect(port, host);
        const bufferQueue = [];
        let isConnected = false;
        // Minecraft'in ilk gonderdigi handshake paketini ASLA kacirma:
        ws.on('message', (data) => {
            if (!isConnected) {
                bufferQueue.push(data);
            } else {
                tcpSocket.write(data);
            }
        });
        tcpSocket.on('connect', () => {
            console.log('[PROXY] Aternos soketi baglandi. Kuyruk bosaltiliyor...');
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
                console.error('[DNS] Aternos kapali veya SRV bulunamadi.');
                ws.close();
                return;
            }
            cachedHost = addresses[0].name;
            cachedPort = addresses[0].port;
            connectToBackend(cachedHost, cachedPort);
        });
    }
});
// AFK Bot (7/24 kilit)
function startBot() {
    if (!cachedHost || !cachedPort) {
        setTimeout(startBot, 10000);
        return;
    }
    const bot = mineflayer.createBot({
        host: cachedHost,
        port: cachedPort,
        username: 'SunucuNobetcisi',
        version: '1.20.1'
    });
    bot.on('spawn', () => {
        console.log('[BOT] Aternos sunucusunda. 7/24 kilit devrede.');
        setTimeout(() => {
            bot.chat('/register BotSifre123 BotSifre123');
            bot.chat('/login BotSifre123');
        }, 2000);
    });
    bot.on('end', () => {
        console.log('[BOT] Koptu, yeniden baglaniyor...');
        setTimeout(startBot, 10000);
    });
    bot.on('error', (err) => {
        console.log('[BOT]:', err.message);
    });
}
setTimeout(startBot, 5000);
console.log(`MEB Buffer Proxy Aktif - Port: ${PORT}`);
