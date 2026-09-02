# Licence tools — the easy way

Two double-click files in this folder, so you don't have to type commands.
They just run the same Node scripts for you.

## setup-keys.bat  — run ONCE, ever

Double-click it the very first time you set up licensing. It:
- creates your signing key (`iss-private.pem`)
- prints your public key to paste into `license.js`

Then, as it reminds you on screen:
1. paste the public key into `license.js`
2. change `FP_SALT` in `license.js` to your own phrase
3. back up `iss-private.pem` twice, offline

It refuses to run a second time if a key already exists, so you can't wipe
out licences you've issued by clicking it again by accident.

## issue-licence.bat  — run for each customer

When a customer sends you their Install ID, double-click this. It asks you:
- their Install ID / request (paste it)
- their company name
- site name (optional — press Enter to skip)
- expiry (optional — press Enter for a licence that never expires, or type
  a date like 2027-12-31 for an annual subscription)

It writes a `.isslic` file into this folder, named after the company and
machine, e.g. `promnatic-scales-ISS-4F2A-9C11-8E30.isslic`. Send that file
to the customer. It only works on their PC.

### If it says something went wrong

The usual cause is the pasted request getting cut off. Ask the customer to
use **Save request to file** in the app instead of copying, send you the
`.issreq` file, and run `issue-licence.bat` again — this time paste the full
path to that file when it asks for the Install ID.

## Keep these together

Both `.bat` files must stay in this `tools` folder, next to
`iss-keygen.js`, `iss-genkeys.js`, `license.js`, and (when you're issuing)
`iss-private.pem`. They won't work moved out on their own.

## Security reminder

`iss-private.pem` is the whole business. Keep it on your PC, backed up
offline. Never commit it to GitHub, never put it in the installer, never
leave it on a customer's machine. Everything else here is safe to keep in
your project.
