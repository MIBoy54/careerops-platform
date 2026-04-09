export async function seedContacts(page) {
  await page.goto('http://localhost:3000');

  // Go to Saved Contacts (assumes already logged in)
  await page.click('button[data-target="savedContactsSection"]');

  // Create 4 contacts via API (fast + deterministic)
  for (let i = 1; i <= 4; i++) {
    await page.evaluate(async (i) => {
      await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiter_name: `Test Recruiter ${i}`,
          company: `Test Company ${i}`,
          status: 'Applied',
          relationship_status: 'Active'
        })
      });
    }, i);
  }

  // Refresh table
  await page.reload();
}