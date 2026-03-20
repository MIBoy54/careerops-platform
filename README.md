<h1 align="center">CareerOps Platform</h1>
<p align="center"><i>CI-Driven Quality Engineering | Operational Workflow Platform | Compliance-Aware Architecture</i></p>
<hr>
<p align="left">
A system-level Quality Engineering showcase demonstrating how CI-driven architectures, data design, and operational workflows integrate to enforce quality at scale.

This platform moves beyond traditional test automation to illustrate how engineering systems can be designed for:
<ul>
<li>End-to-end workflow validation</li>
<li>Real-time operational visibility</li>
<li>Auditability and compliance support</li>
<li>CI-integrated quality enforcement</li>
</ul>

Rather than focusing on tools alone, this project emphasizes how quality is embedded into the system architecture itself.
</p>

<hr>
<h2>Build Status</h2>
<p align="center">
<img src="https://github.com/MIBoy54/careerops-platform/actions/workflows/careerops-ci.yml/badge.svg"/>
<img src="https://img.shields.io/badge/node-20.x-green"/>
<img src="https://img.shields.io/badge/tests-vitest%20passing-brightgreen"/>
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
<h2>System Architecture Layers</h2>
<p>This platform is structured as a multi-layered quality engineering system:</p>

<ul>
<li><b>Data Layer</b> → Audit-ready MySQL schema supporting recruiter and opportunity tracking</li>
<li><b>API Layer</b> → Service layer enabling CI-integrated validation and workflow orchestration</li>
<li><b>UI Layer</b> → Recruiter contact management interface supporting operational workflows</li>
<li><b>Metrics Layer</b> → Dashboard providing pipeline visibility and performance insights</li>
<li><b>Compliance Layer</b> → Weekly unemployment reporting with audit and traceability support</li>
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
    <td>Playwright / Cypress</td>
    <td>Automation testing (planned)</td>
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
<h2 align="center">CI Pipeline Flow</h2>

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
│   ├── contactValidation.test.js
│   ├── dataValidation.test.js
│   └── weeklyReport.test.js
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
<h3>Phase 1</h3>
<ul>
<li>Repository setup</li>
<li>Vitest test framework</li>
<li>GitHub Actions CI pipeline</li>
<li>Documentation and project board</li>
 </ul>
<h3>Phase 2</h3>
<ul>
 <li>Playwright automation testing</li>
 <li>Expanded validation coverage</li>
 <li>Run history automation</li>
</ul>
<h3>Phase 3</h3>
<ul>
<li>MySQL schema</li>
<li>API service layer</li>
<li>Recruiter contact management</li>
  </ul>
<h3>Phase 4</h3>
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
Automation frameworks don’t scale.<br>
Engineering systems do.<br><br>
Quality is not something tested at the end —<br>
it is designed into the system.
</p>
<hr>