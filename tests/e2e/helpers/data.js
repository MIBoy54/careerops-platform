export async function seedContacts(page) {
  for (let i = 1; i <= 4; i++) {
    await page.evaluate(async (i) => {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_contacted: '2026-04-13',
          recruiter_name: `Test Recruiter ${i}`,
          company: `Test Company ${i}`,
          role_level: 'QA Engineer',
          role_type: 'QA Operations',
          location: 'Remote',
          comp_range: '$100K-$120K',
          status: 'Applied',
          relationship_status: 'Active',
          reported_unemployment: 'No'
        })
      });
    }, i);
  }
}