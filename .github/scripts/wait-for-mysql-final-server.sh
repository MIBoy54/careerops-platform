#!/usr/bin/env bash
set -euo pipefail

container="${1:?container name required}"
expected_version="${2:?expected MySQL version required}"
overall_timeout="${3:-120}"
probe_timeout=5
diagnostic_timeout=5
probe_log="$(mktemp)"
started_at=$SECONDS
initialization_server_rejected=0
uuid_sanitize_pattern='s/[[:xdigit:]]{8}(-[[:xdigit:]]{4}){3}-[[:xdigit:]]{12}/[uuid-redacted]/gI'

diagnose_failure() {
  local reason="$1"
  echo "MySQL final-server readiness failed: $reason" >&2
  echo "Container state:" >&2
  timeout --signal=TERM --kill-after=1s "${diagnostic_timeout}s" \
    docker inspect --format 'status={{.State.Status}} exit={{.State.ExitCode}} restarts={{.RestartCount}} image={{.Config.Image}}' "$container" 2>&1 || true
  echo "Recent MySQL fixture logs (sanitized):" >&2
  timeout --signal=TERM --kill-after=1s "${diagnostic_timeout}s" \
    docker logs --tail 80 "$container" 2>&1 |
    timeout --signal=TERM --kill-after=1s "${diagnostic_timeout}s" \
      sed -E "$uuid_sanitize_pattern" >&2 || true
  echo "Recent readiness probe errors (sanitized):" >&2
  timeout --signal=TERM --kill-after=1s "${diagnostic_timeout}s" \
    tail -n 40 "$probe_log" |
    timeout --signal=TERM --kill-after=1s "${diagnostic_timeout}s" \
      sed -E "$uuid_sanitize_pattern" >&2 || true
}

while (( SECONDS - started_at < overall_timeout )); do
  remaining=$((overall_timeout - (SECONDS - started_at)))
  current_probe_timeout=$probe_timeout
  if (( remaining < current_probe_timeout )); then
    current_probe_timeout=$remaining
  fi

  query_output=''
  if query_output="$(timeout --signal=TERM --kill-after=1s "${current_probe_timeout}s" \
    docker exec "$container" mysql --protocol=socket -uroot --batch --raw --skip-column-names \
      -e 'SELECT 1, @@GLOBAL.skip_networking, @@server_uuid, VERSION()' 2>>"$probe_log")"; then
    result=''
    skip_networking=''
    server_uuid=''
    server_version=''
    IFS=$'\t' read -r result skip_networking server_uuid server_version <<<"$query_output"
    if [[ "$result" == 1 &&
      "$skip_networking" == 0 &&
      -n "$server_uuid" &&
      "$server_uuid" != NULL &&
      "$server_version" == "$expected_version" ]]; then
      echo "MySQL final server ready: version=$server_version skip_networking=0 uuid_present=yes elapsed_seconds=$((SECONDS - started_at))"
      rm -f -- "$probe_log"
      exit 0
    fi
    if [[ "$result" == 1 && "$skip_networking" == 1 && "$initialization_server_rejected" == 0 ]]; then
      echo "Rejected MySQL temporary initialization server: skip_networking=1"
      initialization_server_rejected=1
    fi
    printf 'query returned non-final server signature: result=%s skip_networking=%s uuid_present=%s version=%s\n' \
      "${result:-missing}" "${skip_networking:-missing}" \
      "$([[ -n "$server_uuid" && "$server_uuid" != NULL ]] && echo yes || echo no)" \
      "${server_version:-missing}" >>"$probe_log"
  else
    probe_status=$?
    printf 'probe command failed or timed out: exit=%s timeout_seconds=%s\n' \
      "$probe_status" "$current_probe_timeout" >>"$probe_log"
  fi

  remaining=$((overall_timeout - (SECONDS - started_at)))
  if (( remaining > 0 )); then
    sleep_seconds=2
    if (( remaining < sleep_seconds )); then
      sleep_seconds=$remaining
    fi
    sleep "$sleep_seconds"
  fi
done

diagnose_failure "timed out after ${overall_timeout}s waiting for an authenticated SQL query against the final server"
rm -f -- "$probe_log"
exit 1
