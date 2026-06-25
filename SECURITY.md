# Security

`skillenv` is designed to run locally and avoid secret exposure.

## Reporting

Please report suspected security issues privately to the repository owner.

## Boundaries

- The CLI checks environment variable names only.
- The CLI does not print environment variable values.
- The CLI does not call external services.
- The CLI does not install dependencies or mutate reviewed skill directories.
