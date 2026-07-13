# Catalogue import workspace

Place carefully reviewed CSV or JSON import files here and run:

```bash
npm run catalog:import -- --slug <profile> --input <path>
```

The command is a dry run unless `--apply` is supplied. Generated source snapshots must identify their provider and fetch date. Do not commit copyrighted audio, lyrics, scraped pages, access tokens, or private credentials.
