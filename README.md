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

### Therapy experience reports

Users can search for a provider and browse reports by therapy type, visit
format, rating, and recommendation. Each provider displays an average rating
and report count calculated through MongoDB aggregation.

Users can submit, edit, and delete their own reports. The **View your reports** button provides
quick access to reports created from the current browser.

## How to use

1. Open **Experiences** from the navigation.
2. Search for a provider by name and select a result.
3. Browse reports or apply the available filters.
4. Complete the form to submit an experience report.
5. Use **View your reports** to edit or delete reports submitted from the
   current browser.

Do not include diagnoses, medications, treatment outcomes, client names,
personal health information, medical claims, or accusations in reports.

## Screenshot

Yet to add screenshot here

## Instructions to build

1. Install Node.js 20.6 or later.
2. Clone the repository and run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGO_URL` and `DB_NAME`.
4. Seed the database with `npm run seed`.
5. Start the server with `npm run dev`.
6. Open http://localhost:3000.

To run the seed scripts separately:

````bash
npm run seed:providers
npm run seed:experiences

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
````

### Demo experience data

The experience-report seed creates 20 clearly labeled fictional demo providers
and 1,000 synthetic reports for testing filters, pagination, ratings, and
recommendations. Generated reports are stored only under providers whose names
begin with `[DEMO]`, they are never attached to real CMS clinicians.

The application displays a **Demo data** badge on generated reports. Demo
records are fictional and do not describe real therapists or real patient
experiences.

## License

[MIT LICENSE](LICENSE)
