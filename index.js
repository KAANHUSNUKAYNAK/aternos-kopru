// language: JavaScript, file: index.js, runtime: Node.js 18+ (Render)
// Okul MEB Port 443 WSS Koprusu -> 7/24 OkuldanKacanlar (Playit.gg Tunnel)
const http = require('http');
const net = require('net');
const WebSocket = require('ws');

const TARGET_HOST = process.env.TARGET_HOST || 'fried-cushions.tun.ply.gg';
const TARGET_PORT = parseInt(process.env.TARGET_PORT || '38176', 10);
const PORT = process.env.PORT || 8080;

const liveLogs = [];
function log(msg) {
    const entry = `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`;
    console.log(entry);
    liveLogs.push(entry);
    if (liveLogs.length > 50) liveLogs.shift();
}

// 1. WEB DURUM VE CANLI LOG PANELI
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    let text = `=====================================\n`;
    text += `   OKULDANKACANLAR - MEB KOPRUSU     \n`;
    text += `=====================================\n`;
    text += `Hedef Sunucu: ${TARGET_HOST}:${TARGET_PORT}\n`;
    text += `Durum: 🟢 7/24 KOPRU AKTIF\n\n`;
    text += `--- CANLI LOG AKISI ---\n`;
    text += liveLogs.join('\n') || 'Henuz log yok.';
    res.end(text);
});

// 2. MEB WEBSOCKET TUNELI (Port 443 WSS -> Playit TCP 38176)
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    log('[MEB TUNEL] Okuldan baglanti alindi. Hedefe baglaniliyor...');

    const tcpSocket = net.connect(TARGET_PORT, TARGET_HOST);
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
        log('[MEB TUNEL] Minecraft sunucusuna baglandi. Trafik aktariliyor.');
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

    tcpSocket.on('close', () => {
        log('[MEB TUNEL] Soket kapandi.');
        ws.close();
    });

    ws.on('close', () => {
        log('[MEB TUNEL] Okul istemcisi ayrildi.');
        tcpSocket.destroy();
    });

    ws.on('error', (err) => {
        log(`[MEB TUNEL WS HATA]: ${err.message}`);
        tcpSocket.destroy();
    });
});

// 3. HTTP VE WEBSOCKET DINLEYICISI
server.listen(PORT, () => {
    log(`[RENDER KOPRU] Calisiyor. Port: ${PORT} -> Hedef: ${TARGET_HOST}:${TARGET_PORT}`);
});
