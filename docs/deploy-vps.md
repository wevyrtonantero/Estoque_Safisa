# Deploy na VPS

Assumindo Ubuntu/Debian, Node.js, MySQL e Nginx na mesma VPS.

## 1. Preparar servidor

```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
```

## 2. Clonar projeto

```bash
cd /var/www
git clone https://github.com/wevyrtonantero/Estoque_Safisa.git safisa
cd /var/www/safisa
git checkout develop
npm install
```

## 3. Configurar ambiente

Crie o arquivo `.env` na raiz do projeto:

```bash
cp .env.example .env
nano .env
```

Exemplo:

```env
NODE_ENV=production
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=safisa
DB_USER=safisa_app
DB_PASSWORD=senha-forte-aqui
DB_CHARSET=utf8mb4
DB_CONNECTION_LIMIT=10
DB_QUEUE_LIMIT=0
```

## 4. Criar banco e usuario MySQL

Entre no MySQL:

```bash
mysql -u root -p
```

Execute:

```sql
CREATE DATABASE IF NOT EXISTS safisa CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'safisa_app'@'127.0.0.1' IDENTIFIED BY 'senha-forte-aqui';
GRANT ALL PRIVILEGES ON safisa.* TO 'safisa_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 5. Levar os dados atuais

Se voce quer a VPS exatamente com o banco que esta na sua maquina hoje, o caminho mais seguro e usar dump.

Na maquina atual:

```bash
mysqldump -u root -p --single-transaction --routines --triggers safisa > safisa.sql
```

Envie o arquivo para a VPS e importe:

```bash
scp safisa.sql root@SEU_IP:/root/
ssh root@SEU_IP
mysql -u root -p safisa < /root/safisa.sql
```

Se a VPS for uma instalacao totalmente nova e voce nao quiser usar dump, rode o seed apenas uma vez:

```bash
npm run seed:real
```

Atencao: `seed:real` recria a base. Nao rode isso em banco com dados reais ja carregados.

## 6. Subir aplicacao com PM2

```bash
cd /var/www/safisa
pm2 startup
```

Execute o comando com `sudo` exibido pelo `pm2 startup`. Depois:

```bash
cd /var/www/safisa
pm2 start ecosystem.config.js
pm2 save
```

Teste localmente na VPS:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/pagina-inicial
```

## 7. Publicar com Nginx

Crie o arquivo:

```bash
nano /etc/nginx/sites-available/safisa
```

Conteudo base:

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO_OU_IP;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ative:

```bash
ln -s /etc/nginx/sites-available/safisa /etc/nginx/sites-enabled/safisa
nginx -t
systemctl restart nginx
```

## 8. Atualizar depois

```bash
cd /var/www/safisa
git pull origin develop
npm ci
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
```

## 9. Corrigir erro 502

O Nginx retorna `502 Bad Gateway` quando nao consegue acessar a aplicacao na porta `3000`.
Execute na VPS:

```bash
cd /var/www/safisa
pm2 status
pm2 logs safisa --lines 100
curl -i http://127.0.0.1:3000/health
```

Se o processo estiver parado ou o `curl` falhar:

```bash
cd /var/www/safisa
npm ci
pm2 delete safisa
pm2 start ecosystem.config.js --update-env
pm2 save
curl -i http://127.0.0.1:3000/health
```

Se o healthcheck responder `200`, mas o site continuar com `502`:

```bash
nginx -t
systemctl restart nginx
journalctl -u nginx -n 100 --no-pager
```

Confirme que o `proxy_pass` ativo aponta para a mesma porta definida no `.env`:

```nginx
proxy_pass http://127.0.0.1:3000;
```

## 10. Comandos uteis

```bash
pm2 status
pm2 logs safisa
pm2 restart safisa
systemctl status nginx
systemctl status mysql
```
