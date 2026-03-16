# Architecture

## Current Stack

| Component | Purpose |

| --- | --- |

| GitHub | Source control and backlog management |

| GitHub Actions | Continuous Integration pipeline |

| Vitest | Unit testing |

| Playwright / Cypress | Automation testing (planned) |

| MySQL | Data persistence layer |

| Visual Studio Code | Development environment |

## Current Flow

```mermaid
graph TD
A[Developer Change] --> B[Git Commit]
B --> C[Git Push]
C --> D[GitHub Actions Trigger]
D --> E[npm install Dependencies]
E --> F[Run Vitest Unit Tests]
F --> G{Tests Pass?}
G -->|Yes| H[Record Success]
G -->|No| I[Record Failure]
```
