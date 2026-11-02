#!/usr/bin/env bash
set -euo pipefail
node_image='node@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0'
docker --host=unix:///var/run/docker.sock run --rm \
  --network container:careerops-trend-dev-test \
  --mount "type=bind,source=$PWD,target=/source,readonly" \
  -e WORKFLOW_TEST_MYSQL=1 "$node_image" sh -ec '
    mkdir -p /tmp/careerops
    cp -a /source/src /source/tests /source/node_modules /source/package.json /tmp/careerops/
    cd /tmp/careerops
    node node_modules/vitest/vitest.mjs run --config tests/workflowMigration.config.js
  '
