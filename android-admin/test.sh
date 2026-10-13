#!/usr/bin/env bash
set -euo pipefail
app_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
output="$(mktemp -d)"
trap 'rm -rf -- "$output"' EXIT
javac --release 8 -d "$output" "$app_root/src/com/veltshop/admin/NavigationPolicy.java" "$app_root/tests/NavigationPolicyTest.java"
java -cp "$output" NavigationPolicyTest
