#!/usr/bin/env bash
set -euo pipefail

# Strip NODE_ENV from .env (Vite/runtime prefer systemd Environment)
grep -v '^NODE_ENV=' /var/www/arthawks/.env > /tmp/arthawks.env.tmp
mv /tmp/arthawks.env.tmp /var/www/arthawks/.env
chmod 640 /var/www/arthawks/.env

sudo -n cp /home/devuser/arthawks.service /etc/systemd/system/arthawks.service
sudo -n cp /home/devuser/arthawks.conf /etc/apache2/sites-available/arthawks.conf

sudo -n chown -R devuser:www-data /var/www/arthawks
sudo -n chmod 640 /var/www/arthawks/.env
sudo -n chmod -R g+rX /var/www/arthawks

sudo -n a2ensite arthawks.conf
sudo -n apache2ctl configtest
sudo -n systemctl reload apache2

sudo -n systemctl daemon-reload
sudo -n systemctl enable --now arthawks
sleep 2
sudo -n systemctl is-active arthawks
curl -sS -o /dev/null -w "local:%{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "vhost:%{http_code}\n" -H "Host: arthawks.com" http://127.0.0.1/ || true

ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' /var/www/arthawks/.env | head -1 | cut -d= -f2-)
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@arthawks.com}
sudo -n certbot --apache -d arthawks.com -d www.arthawks.com --non-interactive --agree-tos -m "$ADMIN_EMAIL" --redirect
echo CERT_DONE
sudo -n systemctl status arthawks --no-pager -l | head -25
curl -sS -o /dev/null -w "https:%{http_code}\n" https://arthawks.com/ || true
