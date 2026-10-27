# Deploying to a Hostinger VPS

One server runs everything with Docker: PostgreSQL, the web app, the background worker, and Caddy for HTTPS.
Plan on about 30 minutes the first time.

**You need:** a Hostinger VPS (KVM 2 or bigger, Ubuntu 24.04), a domain name, and SSH access.
**Optional:** an AWS account for S3 uploads (otherwise uploads stay on the VPS disk).

## 1. Point the subdomain at the VPS

The app lives at **`affiliate.opengrowthofficial.com`**, a subdomain of the main site. The main site keeps running where it is.

In the DNS of `opengrowthofficial.com` (Hostinger hPanel → **Domains** → opengrowthofficial.com → **DNS / Nameservers**), add one record:

| Type | Name | Points to | TTL |
| --- | --- | --- | --- |
| A | `affiliate` | the VPS IP (hPanel → VPS) | 3600 |

Don't change the existing `@` and `www` records: those are the main site. Wait until `ping affiliate.opengrowthofficial.com`
answers with the VPS IP. Login cookies are set for the subdomain only, so the app and the main site never share them.

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
Open `https://affiliate.opengrowthofficial.com`: you should see the How it works page.

### HTTPS: nginx already on the VPS, or not?

`docker compose up` starts the database, the app and the worker. The app listens on `127.0.0.1:3100`, reachable only from the
server itself, and something in front of it serves HTTPS:

- **The VPS already runs nginx** (it does on ours: it serves `ladder.opengrowthofficial.com`). Add one site for the app:
  ```sh
  sudo cp /opt/opengrowth/deploy/nginx-affiliate.conf /etc/nginx/sites-available/affiliate.opengrowthofficial.com
  sudo ln -s /etc/nginx/sites-available/affiliate.opengrowthofficial.com /etc/nginx/sites-enabled/
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot --nginx -d affiliate.opengrowthofficial.com      # HTTPS certificate, renewed automatically
  ```
  Never stop nginx: the other sites on the VPS go down with it.
- **Nothing else on ports 80/443**: add `COMPOSE_PROFILES=caddy` to `.env` and run `docker compose up -d`. Caddy then serves
  HTTPS and gets its own certificate.

If port 3100 is taken on the VPS (`ss -ltn | grep 3100`), set `APP_HOST_PORT` in `.env` to a free port and use it in the nginx file.

## 6. Create the first accounts

The demo seed is refused in production. Create the first admin from the command line (it prints a one-time password):

```sh
docker compose exec app npm run create-staff -- --role admin --email you@opengrowthofficial.com --phone "555-123-4567" --name "Owner" --code AD
```

Log in as that admin, change the password on your profile, then add everyone else under **Staff** (ops managers and desk employees).
Staff is also where you reset a forgotten staff password or turn off someone who has left.

Then open **Settings** and check the rate, minimum payout, ID threshold, badges, prizes and group chat link.
Affiliates sign up themselves at `/join` (ops approves them) or ops registers them on **Affiliates and players**.

## 7. Nightly backups

```sh
crontab -e
# add:
15 3 * * * /opt/opengrowth/deploy/backup.sh >> /var/log/opengrowth-backup.log 2>&1
```

Run it once by hand to check it works: `/opt/opengrowth/deploy/backup.sh`.

Backups land in `/var/backups/opengrowth`: a dated database copy each night (30 days kept), and `uploads/`, a copy of
every payment screenshot and ID photo (skipped once uploads are in S3, which keeps its own copies).

These sit on the same disk as the app, so also keep a copy **off the server**: turn on Hostinger's VPS backups
(hPanel → VPS → Backups), and/or set `BACKUP_S3_URI` (with the AWS CLI installed) to copy each backup to S3.

**Restore** the database:

```sh
gunzip -c /var/backups/opengrowth/opengrowth-2026-10-19-0315.sql.gz | docker compose exec -T db psql -U opengrowth -d opengrowth
```

**Restore** the uploads: `docker compose cp /var/backups/opengrowth/uploads/. app:/app/storage/`

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

## 9. Turn on email (Resend)

Without this the app still works, but it can't send the 6-digit email confirmation codes or the "you're approved" emails.

1. Create a free account at [resend.com](https://resend.com) → **Domains** → **Add domain** → **`affiliate.opengrowthofficial.com`**.
   Use the subdomain, not the main domain: its records sit under `affiliate`, so any email the main domain already sends
   or receives (its MX and SPF records) is left alone.
2. Add the DNS records Resend shows (TXT/MX/CNAME) in the `opengrowthofficial.com` DNS and wait until Resend says **Verified**.
3. **API Keys** → **Create API key** (sending access) and copy it.
4. In `.env` set `RESEND_API_KEY=re_…` and `EMAIL_FROM=Opengrowth <no-reply@affiliate.opengrowthofficial.com>` (already in the example file), then `docker compose up -d`.
5. Test it: sign up at `/join` with an email you own; the code should arrive within a minute.
   Every email and its delivery status is recorded in the `email_messages` table.

## 10. Automatic deploys (CI/CD with GitHub Actions)

After this, every push to `main` is tested, built and (after your approval) put live. Nothing is built on the VPS.

| Workflow | Runs | Does |
| --- | --- | --- |
| **CI** (`.github/workflows/ci.yml`) | Every push and pull request | Lint, type check, unit tests, migration check, production build, all browser tests. On `main`, if green: builds the Docker image and pushes it to GitHub Packages, tagged with the commit. |
| **Deploy** (`.github/workflows/deploy.yml`) | After a green `main` build, or by hand | Copies `docker-compose.yml` and `deploy/` to the VPS, pulls that image, restarts, waits for the health check. |

**One-time setup**

1. On the VPS, make a deploy user that can run Docker and owns the app folder:
   ```sh
   adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy
   chown -R deploy:deploy /opt/opengrowth
   ```
2. On your computer, make a key just for deploys and allow it on the VPS:
   ```sh
   ssh-keygen -t ed25519 -f opengrowth-deploy -N "" -C "github-deploy"
   ssh-copy-id -i opengrowth-deploy.pub deploy@YOUR_VPS_IP     # or paste the .pub into /home/deploy/.ssh/authorized_keys
   ssh-keyscan YOUR_VPS_IP > known_hosts.txt
   ```
3. On GitHub: **Settings → Secrets and variables → Actions**.
   - Secrets: `VPS_HOST` (the VPS IP), `VPS_USER` (`deploy`), `VPS_SSH_KEY` (the whole `opengrowth-deploy` file, the private one),
     `VPS_KNOWN_HOSTS` (the contents of `known_hosts.txt`).
   - Variable: `APP_URL` (`https://affiliate.opengrowthofficial.com`), used for a public health check after each deploy.
   Then delete the key files from your computer, or keep the private one somewhere safe.
4. **Settings → Environments → New environment** named `production` → tick **Required reviewers** and add yourself.
   Every deploy now waits for your **Approve** click in the Actions tab. Also set **Deployment branches** to `main`.
5. **Settings → Branches → Add rule** for `main`: require the **CI / check** status to pass before merging.

**Rolling back**: Actions → **Deploy** → **Run workflow** → paste the commit SHA of an earlier green build.
Database migrations only go forward, so a rollback across a migration needs care; restore a backup if in doubt.

## Everyday operations

| Task | Command (in `/opt/opengrowth`) |
| --- | --- |
| Update to a new version | Push to `main`, then approve the deploy in GitHub Actions (or by hand: `git pull && docker compose up -d --build`) |
| Which version is live? | `grep APP_IMAGE .env` (the part after `:` is the commit) |
| See logs | `docker compose logs -f app` / `docker compose logs -f worker` |
| Restart | `docker compose restart app worker` |
| Is it healthy? | `curl https://affiliate.opengrowthofficial.com/api/health` |
| Database shell | `docker compose exec db psql -U opengrowth -d opengrowth` |

The worker closes each week after Sunday 23:59 New York time and settles each month's Top 3 race. If it was down,
ops can press **Close week now** on the payout run page.

## Using a PostgreSQL you installed yourself

If Postgres runs directly on the VPS instead of in Docker: delete the `db` service and its `depends_on` entries from
`docker-compose.yml`, and set `DATABASE_URL` in `.env` to `postgresql://USER:PASSWORD@host.docker.internal:5432/DBNAME`
(add `extra_hosts: ["host.docker.internal:host-gateway"]` to `app` and `worker`). Point `backup.sh` at it with `pg_dump` directly.
