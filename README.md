# Opengrowth by Young Money — Affiliate System

Affiliates bring in players and earn **5% of the weekly gross profit** those players generate (verified deposits − verified cashouts).
Desk employees log every deposit and cashout, a second employee verifies it, and ops pays everyone out each Monday.
The top 3 affiliates each month also win a car, a dirt bike or an iPhone.

Built with Next.js (TypeScript) and PostgreSQL: one app holds the screens, the server logic and the background worker.

---

## Run the project on your computer

These steps take about 10 minutes the first time. Commands are for Ubuntu/Linux; macOS notes are in brackets.

### 1. Install the tools (once)

| Tool | Version | Check with |
| --- | --- | --- |
| Node.js | 22 or newer | `node -v` |
| PostgreSQL | 16 | `psql --version` |

```sh
# Node.js 22 (Ubuntu)            [macOS: brew install node@22]
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL 16 (Ubuntu)         [macOS: brew install postgresql@16 && brew services start postgresql@16]
sudo apt-get install -y postgresql
```

### 2. Create the database (once)

```sh
sudo -u postgres psql -c "CREATE USER opengrowth WITH PASSWORD 'opengrowth' CREATEDB;"
sudo -u postgres createdb -O opengrowth opengrowth_affiliate
```

[macOS with Homebrew: run the same two commands without `sudo -u postgres`.]

### 3. Install the app and its settings (once)

On a computer that doesn't have the project yet, download it first (run this in the folder where you keep projects,
not inside an existing copy). If you already have the project folder, skip the first two lines and just `cd` into it.

```sh
git clone https://github.com/Valentino-Junior/opengrowth-affiliate.git
cd opengrowth-affiliate
npm install
cp .env.example .env
```

Every command from here on runs inside this `opengrowth-affiliate` folder.

`.env` already points at the database from step 2. Only edit it if you used a different user, password or database name.

### 4. Create the tables and load sample data

```sh
npm run db:deploy     # creates every table and the money-safety rules in the database
npm run db:seed       # loads sample affiliates, players and 6 weeks of history (matches the original designs)
```

> `db:seed` **wipes the database** and reloads the sample data. Run it again any time you want a clean start.

### 5. Start the app

```sh
npm run dev
```

Open **http://localhost:3000**. Leave this terminal running; press `Ctrl+C` to stop.

### 6. Start the background worker (optional, second terminal)

```sh
cd opengrowth-affiliate
npm run worker
```

The worker closes each week after Sunday 23:59 (New York time) and settles each month's Top 3 race.
You don't need it to try things out: ops can press **Close week now** on the payout run page.

### 7. Log in

Every sample account uses the password **`opengrowth`**. Log in at http://localhost:3000/login.

| Role | Email | Where you land |
| --- | --- | --- |
| Admin (owner) | `admin@opengrowth.local` | Ops overview (Settings is the last tab) |
| Ops manager | `ops@opengrowth.local` | Ops overview (what needs you) |
| Desk employees | `a1@opengrowth.local`, `a2@opengrowth.local`, `a3@opengrowth.local` | Transaction desk |
| Affiliates | `affiliate01@opengrowth.local` … `affiliate06@opengrowth.local` | Affiliate dashboard |
| New signup waiting for approval | `newcomer@example.com` | Dashboard (pending) |

### 8. A 10-minute tour

1. **Affiliate** (`affiliate01@`): dashboard with this week's $71.00, payout history, the Top 3 race (you're #4) and your referral code.
2. **Desk employee** (`a2@`): on the Transaction desk, confirm `player22`, then press **Verify** on `player07`'s $200 deposit, tick the box, verify.
   Log back in as `affiliate01@`: "This week so far" went up to $81.00.
3. **Desk employee** (`a1@`): log a deposit with any PNG/JPG screenshot. You can't verify your own entry; it waits for a teammate.
4. **Ops** (`ops@`): Payout run → **Close week now**. The table shows $377.00 ready to pay.
   Try **Mark paid**, **Review** on Affiliate 05 (clear the flag) and **Export payout list**.
5. **Ops**: Verification → review Affiliate 06's ID, and release September's prize to Affiliate 02.
6. **Ops**: Affiliates and players → approve "Jordan Newcomer", or register a new affiliate.
7. **Admin** (`admin@`): Settings → change the minimum payout; the public page at http://localhost:3000 updates.
8. **Anyone**: open http://localhost:3000/r/OG-A01 to sign up as a player through Affiliate 01's link.

### Run it like production (faster, no hot reload)

```sh
npm run build
npm start             # http://localhost:3000
```

### Run the tests

```sh
npm test                                   # 21 rule tests: commission, carry-forward, weeks, money
```

The 64 browser tests run against a production build. Build it into its own folder and port, so a running
`npm run dev` isn't disturbed:

```sh
NEXT_DIST_DIR=.next-test npm run build
LOGIN_LIMIT_PER_IP=5000 NEXT_DIST_DIR=.next-test npx next start -p 3100     # leave running, then in another terminal:
BASE_URL=http://localhost:3100 PW_CHANNEL=chrome npm run test:e2e
```

The browser tests **reset the database to the sample data** first. `LOGIN_LIMIT_PER_IP` lifts the
100-logins-per-15-minutes limit for the test run only. No Chrome? Run `npx playwright install chromium` once
and drop `PW_CHANNEL=chrome`.

### If something goes wrong

| Problem | Fix |
| --- | --- |
| `password authentication failed` or `Can't reach database server` | PostgreSQL isn't running (`sudo systemctl start postgresql`) or `DATABASE_URL` in `.env` doesn't match step 2. |
| `Port 3000 is already in use` | Another copy is running. Stop it, or run on another port: `npx next dev -p 3001`. |
| `@prisma/client did not initialize yet` | Run `npx prisma generate` in the project folder. |
| Fonts fail to download during `npm run build` | The build fetches the two Google Fonts once; it needs an internet connection. |
| Want a completely clean database | `npm run db:seed` (sample data) |

---

## Put it online

[`DEPLOY.md`](DEPLOY.md) walks through hosting on **one Hostinger VPS** with Docker:
PostgreSQL, the app, the worker and Caddy (automatic HTTPS), plus nightly backups and switching uploads to AWS S3.
On a real server you create the first admin with `npm run create-staff`, and the admin adds everyone else under **Staff**. The sample data refuses to load in production.

---

## How the business rules work

| Rule | In the app |
| --- | --- |
| **Commission** | 5% of net, never below $0. Net = this week's gross profit + any carried loss. |
| **Gross profit** | Verified deposits − verified cashouts, from referred players only. The affiliate's own play never counts. |
| **Week** | Monday 00:00 to Sunday 23:59, New York time. Paid the following Monday. |
| **Losing week** | Pays $0; the loss carries forward against future winning weeks and never resets. |
| **Minimum payout** | $10. Smaller amounts roll into the next payout. |
| **One person, one account** | Email and phone are unique across all affiliates and players. |
| **Self-referral flag** | A player whose email, phone or payment handle matches their affiliate's goes to ops for review. |
| **Two-person rule** | A second employee verifies every entry; nobody can verify their own (enforced by the database). Rejections need a reason. Only ops edits a verified entry, and the old values are kept. |
| **ID check** | Required before any payout over $500 and before any Top 3 prize. The name on the ID must match the account. |
| **Top 3 race** | Calendar month, ranked by gross profit. A flagged affiliate's prize is on hold; a disqualified one drops out and the next moves up. |
| **Status badges** | Recognition only, from last month's paid earnings: Builder $0 · Hustler $50 · Playmaker $150 · Contender $300 · Heavy Hitter $600 · Kingpin $1,000 · OG Status $2,000+. |
| **Signup** | Self-serve at `/join`; ops approves and the OG code is issued. Ops can also register affiliates directly. |

All amounts (rate, minimum, ID threshold, badges, prizes, group chat link) are editable by the admin under **Settings**.

---

## Where things live

| Path | What |
| --- | --- |
| `prisma/schema.prisma` | All database tables. Money is stored as whole cents. |
| `prisma/migrations/` | Table changes, including the database-level safety rules. |
| `prisma/seed.ts` | The sample data (closes and pays past weeks with the real payout engine). |
| `src/lib/commission.ts` | The weekly commission math (unit-tested against the original design's numbers). |
| `src/lib/payouts.ts` | Weekly close, held payouts (flag / ID), Mark paid, CSV export. |
| `src/lib/transactions.ts` | Log, verify, reject and edit deposits and cashouts. |
| `src/lib/people.ts` | Affiliate and player signup, uniqueness checks, self-referral flags. |
| `src/lib/race.ts` | Monthly Top 3 standings and prizes. |
| `src/lib/identity.ts` | ID upload and review. |
| `src/lib/storage.ts` | Private uploads: local disk or S3. |
| `src/app/` | The screens: `dashboard/` (affiliates), `desk/` (employees), `ops/` (management), `admin/`, and the public pages. |
| `scripts/worker.ts` | The background job (weekly close, race settle, cleanup). |
| `e2e/` | Browser tests. |

## Not built yet

- SMS codes to confirm phone numbers, and two-factor login for staff (needs a Twilio account). Phone numbers are checked for duplicates but not yet proven to belong to the person.
- Email confirmation is built: it uses Resend once `RESEND_API_KEY` is set (DEPLOY.md step 9). Until then emails appear in the dev mailbox at http://localhost:3000/dev/mailbox.
- Re-ranking a race month that was already settled if a winner is disqualified afterwards (ops handles it by hand).

