export function ageAwaitingContacts(pool) {
  return pool.query(
    'UPDATE recruiter_tracker SET position_status = ? WHERE position_status = ? AND (' +
    '(hiring_stage = ? AND stage_entered_at <= UTC_TIMESTAMP() - INTERVAL 60 DAY) OR ' +
    '(hiring_stage = ? AND stage_entered_at <= UTC_TIMESTAMP() - INTERVAL 45 DAY))',
    ['Ghosted', 'Awaiting Decision', 'Applied', 'Submitted']
  );
}
