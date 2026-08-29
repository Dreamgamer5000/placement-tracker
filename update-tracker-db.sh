#!/bin/bash
set -e

# [DEPRECATED] Please use pull-db-from-vm.sh instead.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/pull-db-from-vm.sh" "$@"

