// language: JavaScript, file: index.js, runtime: Node.js 18+
// Rock-Solid Pure MEB Proxy
const net = require('net');
const dns = require('dns');
const WebSocket = require('ws');

const ATERNOS_DOMAIN = 'okuldankacanlar.aternos.me';
const PORT = process.env.PORT || 8080;

let targetHost = null;
let targetPort = null;

function resolveTarget() {
    dns.resolveSrv(`_minecraft._tcp.${ATERNOS_DOMAIN}`, (err, addresses) => {
        if (!err && addresses && addresses.length > 0) {
            targetHost = addresses[0].name;
            targetPort = addresses[0].port;
            console.log(`[HEDEF] ${targetHost}:${targetPort}`);
        }
    });
}
resolveTarget();
setInterval(resolveTarget, 15000);

const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
    console.log('[PROXY] Okuldan baglanti geldi.');

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
            console.log('[PROXY] Aternos ile baglanti kuruldu. Paketler aktariliyor...');
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
            console.error('[TCP Hata]:', err.message);
            ws.close();
        });
        ws.on('error', (err) => {
            console.error('[WS Hata]:', err.message);
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

console.log(`MEB Koprusu Aktif - Port: ${PORT}`);
