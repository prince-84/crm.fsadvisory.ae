const localtunnel = require('localtunnel');

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: 8000, subdomain: 'metal-ghosts-care' });
    console.log('3CX Webhook Tunnel is ACTIVE at:', tunnel.url);

    tunnel.on('close', () => {
      console.log('Tunnel closed. Reconnecting in 3 seconds...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err.message);
      setTimeout(startTunnel, 3000);
    });
  } catch (err) {
    console.error('Failed to connect tunnel:', err.message);
    setTimeout(startTunnel, 3000);
  }
}

startTunnel();
