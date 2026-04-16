# UQT Proxy Setup Guide

## Overview
This proxy forwards audio streaming requests to your Hetzner S3 bucket with **zero egress costs** (both instance and bucket in HEL1 zone).

## Quick Start

### On Your Server (ssh finland)

```bash
# 1. Download proxy script
cd ~
curl -O https://raw.githubusercontent.com/rafapolo/uqt/master/proxy.js

# 2. Install Node.js (if not already installed)
# On most systems:
which node || (curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs)

# 3. Start the proxy (run as background service)
nohup node ~/proxy.js > ~/proxy.log 2>&1 &

# 4. Verify it's running
ps aux | grep proxy.js
tail -f ~/proxy.log

# 5. Test locally
curl -I http://localhost:9001/uqt/
```

### Set Up as System Service (Recommended)

For the proxy to survive restarts and run as a proper service:

```bash
# Create systemd service file
sudo tee /etc/systemd/system/uqt-proxy.service > /dev/null <<EOF
[Unit]
Description=UQT Hetzner Proxy
After=network.target

[Service]
Type=simple
User=polux
WorkingDirectory=/home/polux
ExecStart=/usr/bin/node /home/polux/proxy.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/home/polux/proxy.log
StandardError=append:/home/polux/proxy.log

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
sudo systemctl enable uqt-proxy
sudo systemctl start uqt-proxy
sudo systemctl status uqt-proxy

# View logs
sudo journalctl -u uqt-proxy -f
```

### Expose to Public (Port Forwarding)

The proxy listens on `http://localhost:9001` but needs to be accessible as `http://xn--2dk.xyz:9001` from the web.

**Option 1: Direct Port Binding (if port 9001 is free publicly)**
```bash
# Modify proxy.js to listen on all interfaces:
# Change: server.listen(PORT)
# To: server.listen(PORT, '0.0.0.0')

# Make sure firewall allows port 9001:
sudo ufw allow 9001/tcp
```

**Option 2: Reverse Proxy (if haloyd is running)**
If you have haloyd or another reverse proxy, configure it to route `xn--2dk.xyz:9001` → `localhost:9001`

**Option 3: Port Forwarding**
If the server is behind NAT, set up port forwarding from your router's 9001 to the server's 9001.

### Verify Public Accessibility

Once deployed:

```bash
# From your local machine:
curl -I http://xn--2dk.xyz:9001/uqt/

# Should return 404 (because files haven't synced yet) but with proper proxy headers:
# HTTP/1.1 404 Not Found
# Access-Control-Allow-Origin: *
# Cache-Control: public, max-age=31536000
```

## Monitoring

### Check proxy status
```bash
sudo systemctl status uqt-proxy

# View recent requests
tail -100 ~/proxy.log

# Check memory usage
ps aux | grep proxy.js
```

### Common Issues

**Proxy won't start:**
- Check Node.js is installed: `which node`
- Check syntax: `node -c proxy.js`
- Check logs: `cat ~/proxy.log`

**Port already in use:**
```bash
# Find what's using port 9001
lsof -i :9001

# Or choose a different port (update proxy.js PORT constant)
```

**Not accessible from web:**
- Verify DNS: `dig xn--2dk.xyz`
- Check firewall: `sudo ufw status`
- Check port is listening publicly: `netstat -an | grep 9001`

## Performance Notes

- Proxy adds minimal latency (~10ms)
- Zero egress fees (both in HEL1 zone)
- CORS headers enabled for cross-origin requests
- Cache headers set to 1 year (CDN-friendly)
- Streaming supports Range requests (seek within audio)

## Next Steps

1. Deploy proxy on server
2. Confirm public accessibility at `http://xn--2dk.xyz:9001/health`
3. Verify `js/uqt.js` has `BASE_URL = 'http://xn--2dk.xyz:9001/uqt'`
4. Sync album covers to bucket: `./sync-to-bucket.sh`
5. Check GitHub Pages for album covers loading correctly

---

**Note:** The proxy script is included in this repo. You can also inspect it to customize the port, bucket URL, or cache headers.
