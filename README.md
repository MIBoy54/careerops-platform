<h1 align="center">CareerOps Platform</h1>

<p align="center">
<b><i>A CI-driven Quality Engineering system demonstrating how quality is enforced through architecture, not tooling.</i></b>
</p>

<p>
CareerOps is a system-level platform demonstrating how modern engineering practices embed validation, observability, and governance directly into workflows.
</p>

<p>
This is not a test automation project.<br>
It is a <b>multi-layered quality system</b>.
</p>
<hr>

<h2>Overview</h2>
<p>
CareerOps demonstrates how modern engineering practices can be applied to operational workflows, including:
</p>
<ul>
<li>Managing recruiter contacts</li>
<li>Tracking job opportunities</li>
<li>Generating unemployment compliance reports</li>
<li>Automating validation pipelines</li>
</ul>
<p>
The system is built around a CI-first architecture where validation occurs automatically through GitHub Actions.
</p>
<hr>

<h2>CI/CD Quality Gate Model</h2>
<ul>
  <li><b>DEV Gate</b> → Unit validation (Vitest)</li>
  <li><b>QA Gate</b> → Smoke validation (Playwright)</li>
  <li><b>DEMO Gate</b> → Full end-to-end validation</li>
  <li><b>LIVE Gate</b> → Production-safe deployment with enforced validation</li>
</ul>

<p>
Each stage enforces progressively deeper system validation, preventing unstable changes from progressing through the pipeline.
</p>
<hr>

<h2>Build Status</h2>
<p align="center">
  <img src="https://github.com/MIBoy54/careerops-platform/actions/workflows/careerops-ci.yml/badge.svg" />
  <img src="https://img.shields.io/badge/node-20.x-green" />
  <img src="https://img.shields.io/badge/unit%20tests-vitest%20passing-brightgreen" />
  <img src="https://img.shields.io/badge/e2e-playwright%20passing-blue" />
</p>
<hr>

<h3>Key Capabilities</h3>
<ul>
  <li>Multi-stage CI/CD quality gates (DEV → QA → DEMO → LIVE)</li>
  <li>End-to-end validation across UI, API, and data layers</li>
  <li>Deterministic test execution with controlled data seeding</li>
  <li>Run history tracking and audit-ready validation telemetry</li>
  <li>Role-based governance (Admin vs Read-Only)</li>
  <li>Demo-safe architecture preventing unintended system mutation</li>
</ul>
<p>
This platform demonstrates a shift from <b>test execution</b> to <b>quality system design</b>:
</p>

<ul>
<li>Quality is enforced through CI/CD pipelines</li>
<li>Validation is embedded across system layers</li>
<li>Execution is observable and measurable</li>
<li>Risk is surfaced early through structured quality gates</li>
</ul>
<hr>

<h2>System Architecture Layers</h2>
<p>This platform is structured as a multi-layered <b>quality engineering system</b>, designed to move from execution to observability and enforcement:</p>

<ul>
<li><b>Data Layer</b> → Audit-ready MySQL schema supporting recruiter and opportunity tracking, enabling traceability across workflows</li>
<li><b>API Layer</b> → Service layer enabling CI-integrated validation, orchestration, and system-level data flow</li>
<li><b>Validation Layer</b> → Structured validation execution with run history tracking and audit capability (#14)</li>
<li><b>Observability Layer</b> → Metrics and dashboarding providing CI/CD pipeline visibility, execution trends, and system stability insights (#7)</li>
<li><b>Enforcement Layer</b> → CI/CD-aligned quality gates ensuring validation standards are met before deployment (#26)</li>
<li><b>UI Layer</b> → Operational interface supporting recruiter workflows, data interaction, and validation visibility</li>
<li><b>Compliance Layer</b> → Weekly unemployment reporting with audit and traceability support</li>
</ul>
<hr>
<h2>System Design Principles</h2>
<ul>
  <li>Validation is continuous, not point-in-time</li>
  <li>Visibility drives confidence</li>
  <li>Quality is enforced, not assumed</li>
  <li>Systems scale quality—not tools alone</li>
</ul>
<hr>

<h2>System Capabilities</h2>
<h3>Core System</h3>
<ul>
  <li>Recruiter Contact Management System (UI + API + Validation)</li>
  <li>API Layer with Validation + CI Integration (Vitest + GitHub Actions)</li>
  <li>MySQL Data Model for Recruiter & Reporting Workflows</li>
</ul>
<h3>Workflow Engine</h3>
<ul>
  <li>Weekly Compliance Reporting Engine (Selection → Persist → Export)</li>
  <li>End-to-End Workflow Automation (Contact → Report → History → Export)</li>
</ul>
<h3>Reporting & Visibility</h3>
<ul>
  <li>Weekly Report History & Detail Viewer</li>
  <li>CSV Export for Compliance Reporting</li>
</ul>
<h3>Enhancements</h3>
<ul>
  <li>Company/Agency Search-as-you-type</li>
  <li>Role Type dropdown standardization</li>
  <li>Email validation improvements</li>
  <li>Follow-up date field standardization</li>
</ul>

<hr>
<h2>What This Demonstrates</h2>
<ul>
<li>End-to-end workflow design from UI → API → database</li>
<li>Relational data modeling for audit and traceability</li>
<li>CI-enforced validation integrated into development lifecycle</li>
<li>Separation of concerns across UI, service, and data layers</li>
<li>Compliance-aware system design with historical reconstruction</li>
</ul>

<hr>

<h2>Architecture</h2>
<table>
  <tr>
    <th>Component</th>
    <th>Purpose</th>
  </tr>
  <tr>
    <td>GitHub</td>
    <td>Source control and project management</td>
  </tr>
  <tr>
    <td>GitHub Actions</td>
    <td>Continuous Integration pipeline</td>
  </tr>
  <tr>
    <td>Vitest</td>
    <td>Unit testing framework</td>
  </tr>
  <tr>
    <td>Playwright</td>
    <td>CI-validated smoke and end-to-end testing</td>
  </tr>
  <tr>
    <td>MySQL</td>
    <td>Data persistence layer</td>
  </tr>
  <tr>
    <td>Visual Studio Code</td>
    <td>Development environment</td>
  </tr>
</table>
<hr>

<h2>Quality Engineering Approach: Deterministic UI Automation with System-Aware Design</h2>

<p>
  This project demonstrates a modern approach to UI automation that goes beyond tool usage
  and focuses on system reliability, deterministic execution, and maintainable test architecture.
</p>

<h3>Problem Statement</h3>

<p>Most automation efforts fail not because of tooling limitations, but because:</p>

<ul>
  <li>Tests depend on inconsistent or pre-existing data</li>
  <li>UI interactions break due to hidden elements or async rendering</li>
  <li>Navigation logic is duplicated and brittle</li>
  <li>Tests validate actions, not system behavior</li>
</ul>

<p>The result:</p>

<ul>
  <li>Flaky tests</li>
  <li>Low confidence in automation</li>
  <li>High maintenance overhead</li>
</ul>

<h3>Approach</h3>

<p>
  This framework addresses those issues by treating automation as part of a quality system,
  not just test execution.
</p>

<h4>1. Deterministic Test Data</h4>

<pre><code>await seedContacts(page);</code></pre>

<ul>
  <li>Ensures required data exists before execution</li>
  <li>Eliminates dependency on environment state</li>
  <li>Makes tests repeatable and reliable</li>
</ul>

<h4>2. Centralized Navigation Contract</h4>

<pre><code>helpers/navigation.js</code></pre>

<ul>
  <li>Encapsulates all UI navigation logic</li>
  <li>Prevents duplication across tests</li>
  <li>Ensures consistent interaction patterns</li>
</ul>

<h4>3. UI-State-Aware Interaction Handling</h4>

<p>Modern UIs introduce challenges such as:</p>

<ul>
  <li>Hidden elements (checkboxes, buttons)</li>
  <li>Disabled controls based on state</li>
  <li>Dynamic rendering</li>
</ul>

<p>Solution:</p>

<pre><code>await locator.evaluate((el) =&gt; el.click());</code></pre>

<ul>
  <li>Bypasses visibility constraints when appropriate</li>
  <li>Triggers real application behavior</li>
  <li>Aligns automation with how the UI actually functions</li>
</ul>

<h4>4. System-State Validation (Not Just Actions)</h4>

<p>Example:</p>

<pre><code>await expect(page.locator('#viewButton')).toBeEnabled();</code></pre>

<ul>
  <li>Validates system readiness before actions</li>
  <li>Prevents false positives</li>
  <li>Improves test reliability</li>
</ul>

<h4>5. Clean Test Design (Single Responsibility)</h4>

<p>Each test validates one outcome:</p>

<ul>
  <li>End-to-end user flow</li>
  <li>Data mutation and persistence</li>
  <li>Negative state validation</li>
</ul>

<p>
  No fallback logic. No branching.<br>
  Tests either pass or fail based on system behavior.
</p>

<h3>Example Coverage</h3>

<ul>
  <li>Detail Viewer end-to-end workflow</li>
  <li>Weekly Report generation and persistence</li>
  <li>Validation of required user actions (selection gating)</li>
</ul>

<h3>Outcome</h3>

<p>This approach results in:</p>

<ul>
  <li>Stable, repeatable test execution</li>
  <li>Reduced flakiness</li>
  <li>Clear separation of concerns</li>
  <li>Scalable automation architecture</li>
</ul>

<h3>Key Principle</h3>

<p>
  Sustainable quality engineering is not a tooling decision — it is a system design decision.
</p>

<h2 style="text-align: center;">CI Pipeline Flow</h2>

<pre><code>graph TD
A[Developer Change] --&gt; B[Git Commit]
B --&gt; C[Git Push]
C --&gt; D[GitHub Actions Trigger]
D --&gt; E[npm install Dependencies]
E --&gt; F[Run Vitest Unit Tests]
F --&gt; G{Tests Pass?}
G --&gt;|Yes| H[Record Success]
G --&gt;|No| I[Record Failure]</code></pre>

<hr>

<h2>Project Structure</h2>
<pre><code>
careerops-platform/
│
├── .github/
│   └── workflows/
│       └── careerops-ci.yml
│
├── docs/
│   ├── architecture.md
│   ├── roadmap.md
│   └── run-history.md
│
├── src/
│   ├── components/
│   │   ├── App.jsx
│   │   └── EmployerContactForm.jsx
│   │
│   ├── server.js
│   ├── validateContact.js
│   └── validateWeeklyReport.js
│
├── tests/
│   ├── unit/
│   ├── smoke/
│   └── e2e/
│
├── ui/
│   ├── app.js
│   ├── index.html
│   └── styles.css
│
├── .gitignore
├── LICENSE
├── package.json
├── package-lock.json
└── README.md
</code></pre>

<hr>
<h3>Structure Overview</h3>
<ul>
<li><b>CI/CD</b> → GitHub Actions pipeline enforcing validation and build quality</li>
<li><b>docs/</b> → Architecture, roadmap, and execution history documentation</li>
<li><b>src/</b> → Backend services and validation logic</li>
<li><b>src/components/</b> → React-based UI components</li>
<li><b>tests/</b> → Vitest unit tests validating business rules and data integrity</li>
<li><b>ui/</b> → Frontend interface (HTML, JS, CSS)</li>
<li><b>Root</b> → Configuration, dependencies, and project metadata</li>
</ul>

<hr>
<h2>API Endpoints</h2>
<p>
The CareerOps platform exposes RESTful endpoints to support operational workflows, validation enforcement, and data management.
</p>

<table>
  <tr>
    <th>Endpoint</th>
    <th>Method</th>
    <th>Purpose</th>
  </tr>

  <tr>
    <td>/api/contacts</td>
    <td>GET</td>
    <td>Retrieve all recruiter contact records</td>
  </tr>

  <tr>
    <td>/api/contacts</td>
    <td>POST</td>
    <td>Create a new recruiter contact</td>
  </tr>

  <tr>
    <td>/validate-weekly-report</td>
    <td>POST</td>
    <td>Validate weekly unemployment report data against business rules</td>
  </tr>
</table>

<hr>
<h3>Validation Integration</h3>
<ul>
<li>All validation logic is enforced server-side to ensure consistency and reliability</li>
<li>Endpoints are designed to support both UI workflows and external system integration</li>
<li>Invalid data is rejected prior to persistence, ensuring data integrity and auditability</li>
</ul>

<hr>
<h3>Sample Request Payload</h3>
<p>
Example request for validating a weekly unemployment report:
</p>

<pre><code>
POST /validate-weekly-report

{
  "week_start": "2026-03-01",
  "week_end": "2026-03-07",
  "job_contacts": [
    { "id": 1 }
  ]
}
</code></pre>

<h3>Expected Behavior</h3>

<ul>
<li>Validates reporting window does not exceed 7 days</li>
<li>Ensures at least one associated job contact exists</li>
<li>Returns structured validation response indicating pass/fail</li>
</ul>

<hr>
<h2>Roadmap</h2>

<h3>Phase 1 — Foundation (Completed ✅)</h3>
<p><b>Result:</b> CI pipeline actively validating business rules with automated test enforcement.</p>
<ul>
<li>Repository setup</li>
<li>Vitest test framework</li>
<li>GitHub Actions CI pipeline</li>
<li>Documentation and project board</li>
</ul>

<h3>Phase 2 — Validation Expansion (In Progress 🚧)</h3>
<ul>
<li>Playwright / Cypress → End-to-end automation (framework integration in progress)</li>
<li>Expanded validation coverage</li>
<li>Run history automation</li>
</ul>

<h3>Phase 3 — System Integration (Planned 🔜)</h3>
<ul>
<li>MySQL schema</li>
<li>API service layer</li>
<li>Recruiter contact management</li>
</ul>

<h3>Phase 4 — Reporting & Compliance (Planned 🔜)</h3>
<ul>
<li>Reporting dashboard</li>
<li>Compliance automation workflows</li>
</ul>

<hr>
<h2>Engineering Goals</h2>
<ul>
<li>CI-driven validation embedded into the development lifecycle</li>  
<li>Automation as a system capability, not a standalone function</li>  
<li>Data integrity and auditability for real-world compliance scenarios</li>
<li>Observability and metrics for operational decision-making</li>  
<li>Reproducible, scalable quality architecture aligned with DevOps practices</li> 
</ul>

<hr>
<h2>Validation Example (Working Proof)</h2>
<p>
This platform enforces business rules through automated validation and testing.
</p>

<h3>Current Proof Points</h3>
<ul>
<li>Weekly unemployment reports must include a valid reporting window and at least one associated job contact</li>
<li>Recruiter records must contain required fields such as name, company, and email</li>
</ul>

<h3>Enforcement</h3>
<ul>
<li>Validation logic implemented in <code>src/validateWeeklyReport.js</code></li>
<li>Verified with automated tests using Vitest</li>
<li>Invalid reports and incomplete data are rejected before submission</li>
<li>Exposed via API endpoint /validate-weekly-report for real-time validation and system integration</li>
</ul>

<h3>Result</h3>
<pre><code>✓ 4 automated tests passed (CI-validated)</code></pre>

<p>
This demonstrates how compliance rules and data quality requirements are programmatically enforced and continuously verified through CI pipelines.
</p>

<hr>
<h2>Perspective</h2>
<p>
Quality is not achieved through more tests.<br>
It is achieved through better system design.<br><br>

Automation does not create quality — systems do.<br><br>

CareerOps demonstrates how engineering discipline, CI/CD pipelines, and structured validation models transform quality from a reactive function into an enforced system capability.
</p>

<p align="center">
<b>CI-Driven Quality Engineering | System-Level Validation | Architecture-Led Quality</b>
</p>

The future of Quality Engineering is not more tests.<br>
It is better system design.
</p>
<hr>
