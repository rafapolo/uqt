# Nginx Reverse Proxy Setup for Hetzner S3 Bucket

Serve MP3s from Hetzner bucket via instance in same zone to avoid egress fees.

## Overview

Route requests from instance → bucket (free within zone) instead of paying egress to external service. Users connect to instance, no data duplication needed.

## Prerequisites

- [ ] Hetzner instance running in same zone as bucket
- [ ] Bucket name and region (e.g., `my-bucket.fsn1.storage.hetzner.cloud`)
- [ ] SSH access to instance
- [ ] Bucket is accessible from instance (verify connectivity)

## Steps

### 1. Connect to Hetzner Instance
```bash
ssh root@your-instance-ip
```

### 2. Install Nginx
```bash
apt update && apt install -y nginx
```

### 3. Configure Nginx Reverse Proxy

Edit `/etc/nginx/sites-available/default` or create `/etc/nginx/sites-available/uqt`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    # Reverse proxy for S3 bucket
    location /uqt/ {
        proxy_pass https://your-bucket-name.fsn1.storage.hetzner.cloud/uqt/;
        proxy_set_header Host your-bucket-name.fsn1.storage.hetzner.cloud;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Performance tuning for large files
        proxy_buffering off;
        proxy_request_buffering off;
        proxy_http_version 1.1;
        
        # Caching (optional - cache MP3s for 30 days)
        proxy_cache_valid 200 30d;
        proxy_cache_key "$scheme$request_method$host$request_uri";
        add_header X-Cache-Status $upstream_cache_status;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

**Replace:**
- `your-bucket-name` → Your actual bucket name
- `fsn1` → Your region (fsn1, nbg1, hel1, etc.)

### 4. Enable and Test Nginx
```bash
# Enable if using sites-available
ln -s /etc/nginx/sites-available/uqt /etc/nginx/sites-enabled/uqt

# Test config
nginx -t

# Start/restart
systemctl restart nginx
```

### 5. Verify Connectivity
```bash
# Test from instance (should work)
curl -I http://localhost/uqt/path-to-mp3

# Test from external (should return 200 or 206)
curl -I http://your-instance-ip/uqt/path-to-mp3
```

### 6. Update Frontend Code

Edit `js/uqt.js`, line 10:

**Old:**
```javascript
audio.src = "https://subzku.net/uqt" + encodeURI(track[0].file);
```

**New:**
```javascript
audio.src = "http://your-instance-ip/uqt" + encodeURI(track[0].file);
```

Or use domain if you set one up:
```javascript
audio.src = "http://your-domain.com/uqt" + encodeURI(track[0].file);
```

### 7. Optional: Enable HTTPS
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

Then update frontend to use `https://`.

## Testing Checklist

- [ ] Nginx starts without errors (`systemctl status nginx`)
- [ ] Health check works: `curl http://instance-ip/health`
- [ ] MP3 file streams: `curl -I http://instance-ip/uqt/song.mp3` (status 200/206)
- [ ] Frontend can play tracks
- [ ] Audio plays without interruption
- [ ] No egress charges on bucket (verify in Hetzner console)

## Troubleshooting

**502 Bad Gateway:**
- Check bucket endpoint is correct
- Verify instance has network access to bucket (`curl https://bucket-endpoint` from instance)
- Check Nginx error log: `tail -f /var/log/nginx/error.log`

**Slow playback:**
- Ensure `proxy_buffering off` is set
- Check instance network performance: `speedtest-cli`
- Monitor instance CPU/bandwidth during playback

**Bucket not accessible:**
- Verify bucket region matches instance region
- Check Hetzner firewall rules
- Ensure bucket credentials/auth (if private)

## Performance Notes

- **Cache headers**: Files cached for 30 days by default (edit `proxy_cache_valid`)
- **Bandwidth**: Instance upload speed = MP3 stream speed to users
- **Concurrent streams**: Depends on instance size; upgrade if needed

## Cost Analysis

**Before:** GB of egress × €0.20/GB  
**After:** Instance cost (~€3-5/month) + 0 egress = Massive savings

