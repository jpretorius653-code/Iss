# ISS Weighbridge — install call-home (optional)

A best-effort ping that reports, once a PC has internet, that a copy is
running on a given machine fingerprint. It gives you a list of where
installs are live.

**It is not a lock.** A copy with no internet, or one where `callhome.js`
was deleted, never pings and still runs. The machine-bound licence
(`license.js` / `iss-keygen.js`) is what actually stops unpaid installs.
This is a notification layer on top of it.

## Files

| File | Goes where | Ships? |
|---|---|---|
| `callhome.js` | next to `main.js` | yes |
| `main.js` | already wired | yes |

While `ENDPOINT` and `ANON_KEY` in `callhome.js` are blank, the module
no-ops — the build behaves exactly as if the feature weren't there. So you
can ship it dark and switch it on later.

## What it sends

Only: Install ID (already a salted hash — never raw hardware serials), app
version, licence state, licensed-to company, hostname, and a timestamp. No
weighbridge data, no tickets, no customer records.

## Setup (Supabase)

1. Create a table `installs`:

```sql
create table installs (
  install_id  text primary key,
  host        text,
  app_version text,
  lic_state   text,
  lic_company text,
  seen_at     timestamptz,
  first_seen  timestamptz default now()
);
```

2. Enable RLS and allow anon insert/upsert:

```sql
alter table installs enable row level security;
create policy anon_upsert on installs
  for insert to anon with check (true);
create policy anon_update on installs
  for update to anon using (true) with check (true);
```

3. Put your REST endpoint and anon key in `callhome.js`:

```
const ENDPOINT = 'https://YOURPROJECT.supabase.co/rest/v1/installs';
const ANON_KEY = 'eyJ...';   // the anon/public key
```

The ping upserts on `install_id`, so repeated check-ins just refresh
`seen_at` rather than piling up rows. It fires at most once a day per
machine.

## Be straight with buyers

Tell customers the software checks in. A hidden phone-home that a customer
discovers themselves costs you more trust than the feature is worth — and
for a competitor buying your software, "it reports installs to ISS" is a
feature, not a problem.
