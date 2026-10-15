# OpenSlots: Therapist Availability & Experience Guide

**Authors:** Ankita Mandalam and Agilan Balaraman

**Class:** [CS 5610 Web Development](https://johnguerra.co/classes/webDevelopment_online_fall_2026/)

**Live site:** [https://openslots.onrender.com/](https://openslots.onrender.com/)

**Demo video:** yet to add video link

**Design document:** yet to add link

## Project objective

OpenSlots helps people looking for mental health care find therapists who are
actually accepting new patients, and read community experience reports about
those providers.

## Screenshot

Yet to add screenshot here

## Instructions to build

1. Install Node.js 20.6 or later.
2. Clone the repository and run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGO_URL` and `DB_NAME`.
4. Seed the database with `npm run seed`.
5. Start the server with `npm run dev`.
6. Open http://localhost:3000.

## Data source

The provider directory contains about 9,000 Massachusetts mental health
providers from the
[CMS Doctors and Clinicians National Downloadable File](https://data.cms.gov/provider-data/dataset/mj5m-pzi6).
It includes clinical social workers, mental health counselors, clinical
psychologists, psychiatrists, and marriage and family therapists enrolled in
Medicare.

The filtered data is already included in `db/seed/data/providers.json`, so you
don't need to download anything to run the project. To rebuild it from a newer
CMS file, download the CSV, keep it outside the project folder, and run:

```bash
node db/seed/buildProviders.js "<path to the CSV>"
```

OpenSlots is community-maintained and is not medical advice. Confirm details
with the provider.

## License

[MIT LICENSE](LICENSE)
