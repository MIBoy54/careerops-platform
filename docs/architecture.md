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

## graph TD

## A\[Developer Change] --> B\[Git Commit]

## B --> C\[Git Push]

## C --> D\[GitHub Actions CI]

## D --> E\[npm install]

## E --> F\[Run Vitest Tests]

## F --> G\[Pass / Fail]

## G --> H\[Update Run History]

```
