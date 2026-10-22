# Deploying to a Hostinger VPS

One server runs everything with Docker: PostgreSQL, the web app, the background worker, and Caddy for HTTPS.
Plan on about 30 minutes the first time.

**You need:** a Hostinger VPS (KVM 2 or bigger, Ubuntu 24.04), a domain name, and SSH access.
**Optional:** an AWS account for S3 uploads (otherwise uploads stay on the VPS disk).

## 1. Point the domain at the VPS

In your domain's DNS, add an **A record**: `opengrowth.yourdomain.com` → the VPS IP (shown in Hostinger hPanel → VPS).
Wait until `ping opengrowth.yourdomain.com` answers with that IP.

## 2. Prepare the server

```sh
ssh root@YOUR_VPS_IP

# Docker
curl -fsSL https://get.docker.com | sh

# Firewall: SSH and web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 3. Put the code on the server

```sh
mkdir -p /opt/opengrowth && cd /opt/opengrowth
# Either clone your repository:
git clone YOUR_REPO_URL .
# …or copy it from your computer (run this on your computer, not the VPS):
#   rsync -av --exclude node_modules --exclude .next --exclude storage --exclude .env ./ root@YOUR_VPS_IP:/opt/opengrowth/
```

## 4. Settings

```sh
cp .env.production.example .env
openssl rand -base64 32        # use the output as POSTGRES_PASSWORD
nano .env                      # fill DOMAIN, APP_URL, POSTGRES_PASSWORD (and S3 later)
chmod 600 .env
```

## 5. Start it

```sh
docker compose up -d --build
docker compose ps              # app should become "healthy" within a minute
```

The app applies database migrations every time it starts. Caddy fetches the HTTPS certificate on first visit.
Open `https://opengrowth.yourdomain.com`: you should see the How it works page.

## 6. Create the first accounts

The demo seed is refused in production. Create real staff instead (each prints a one-time password):

```sh
docker compose exec app npm run create-staff -- --role admin --email you@yourdomain.com --phone "555-123-4567" --name "Owner" --code AD
docker compose exec app npm run create-staff -- --role ops --email ops@yourdomain.com --phone "555-123-4568" --name "Ops Manager" --code OP
docker compose exec app npm run create-staff -- --role employee --email a1@yourdomain.com --phone "555-123-0001" --name "Desk A1" --code A1 --team "Team A"
```

Then log in as admin → **Settings** and check the rate, minimum payout, ID threshold, badges, prizes and group chat link.
Affiliates sign up themselves at `/join` (ops approves them) or ops registers them on **Affiliates and players**.

## 7. Nightly backups

```sh
crontab -e
# add:
15 3 * * * /opt/opengrowth/deploy/backup.sh >> /var/log/opengrowth-backup.log 2>&1
```

Backups land in `/var/backups/opengrowth` (30 days kept). Keep a copy off the server: set `BACKUP_S3_URI`
(and install the AWS CLI), or download them regularly. **Restore** a backup:

```sh
gunzip -c /var/backups/opengrowth/opengrowth-2026-10-19-0315.sql.gz | docker compose exec -T db psql -U opengrowth -d opengrowth
```

## 8. Switch uploads to S3 (when the bucket is ready)

1. AWS console → S3 → **Create bucket** (e.g. `opengrowth-uploads`), same region as in `.env`. Keep **Block all public access** ON.
2. IAM → Users → create `opengrowth-app` with this inline policy (replace the bucket name), then create an access key:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject"], "Resource": "arn:aws:s3:::opengrowth-uploads/*" }
     ]
   }
   ```
3. Put `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` in `.env`, then `docker compose up -d`.

New uploads go to S3 from then on. Files uploaded before the switch stay on the VPS volume; copy them once with
`docker compose cp app:/app/storage ./storage-export && aws s3 sync ./storage-export s3://opengrowth-uploads/`.

## Everyday operations

| Task | Command (in `/opt/opengrowth`) |
| --- | --- |
| Update to a new version | `git pull && docker compose up -d --build` |
| See logs | `docker compose logs -f app` / `docker compose logs -f worker` |
| Restart | `docker compose restart app worker` |
| Is it healthy? | `curl https://opengrowth.yourdomain.com/api/health` |
| Database shell | `docker compose exec db psql -U opengrowth -d opengrowth` |

The worker closes each week after Sunday 23:59 New York time and settles each month's Top 3 race. If it was down,
ops can press **Close week now** on the payout run page.

## Using a PostgreSQL you installed yourself

If Postgres runs directly on the VPS instead of in Docker: delete the `db` service and its `depends_on` entries from
`docker-compose.yml`, and set `DATABASE_URL` in `.env` to `postgresql://USER:PASSWORD@host.docker.internal:5432/DBNAME`
(add `extra_hosts: ["host.docker.internal:host-gateway"]` to `app` and `worker`). Point `backup.sh` at it with `pg_dump` directly.
