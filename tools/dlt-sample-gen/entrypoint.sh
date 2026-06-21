#!/bin/bash
set -e

OUTPUT_FILE="/output/sample.dlt"

echo "[dlt-sample-gen] Starting dlt-daemon..."
dlt-daemon &
DAEMON_PID=$!
sleep 1

echo "[dlt-sample-gen] Starting dlt-receive (output: ${OUTPUT_FILE})..."
dlt-receive -o "${OUTPUT_FILE}" localhost &
RECEIVE_PID=$!
sleep 1

echo "[dlt-sample-gen] Generating log messages via dlt-adaptor-stdin..."

# dlt-adaptor-stdin options:
#   -a <apid>           App ID (max 4 chars)
#   -c <ctid>           Context ID (max 4 chars)
#   -v <level>          Log level: FATAL | ERROR | WARN | INFO | DEBUG | VERBOSE
#   -b                  Flush buffer before unregistering

for i in $(seq 1 100); do
    echo "APP1 CTX1 message ${i}: Application started, processing request"
done | dlt-adaptor-stdin -a "APP1" -c "CTX1" -v INFO -b

for i in $(seq 1 100); do
    echo "APP2 CTX2 message ${i}: Warning - high memory usage detected"
done | dlt-adaptor-stdin -a "APP2" -c "CTX2" -v WARN -b

for i in $(seq 1 100); do
    echo "NET  RECV message ${i}: Received packet from 192.168.1.${i}"
done | dlt-adaptor-stdin -a "NET " -c "RECV" -v VERBOSE -b

for i in $(seq 1 100); do
    echo "NET  SEND message ${i}: Sending response to 192.168.1.$((i % 10 + 1))"
done | dlt-adaptor-stdin -a "NET " -c "SEND" -v DEBUG -b

for i in $(seq 1 100); do
    echo "SYS  INIT message ${i}: System initialization step ${i} complete"
done | dlt-adaptor-stdin -a "SYS " -c "INIT" -v INFO -b

for i in $(seq 1 50); do
    echo "APP1 ERR  message ${i}: Error occurred in module ${i}"
done | dlt-adaptor-stdin -a "APP1" -c "ERR " -v ERROR -b

for i in $(seq 1 50); do
    echo "SYS  DIAG message ${i}: Fatal system error in component ${i}"
done | dlt-adaptor-stdin -a "SYS " -c "DIAG" -v FATAL -b

sleep 1

echo "[dlt-sample-gen] Stopping dlt-receive..."
kill "${RECEIVE_PID}" 2>/dev/null || true
wait "${RECEIVE_PID}" 2>/dev/null || true

echo "[dlt-sample-gen] Stopping dlt-daemon..."
kill "${DAEMON_PID}" 2>/dev/null || true
wait "${DAEMON_PID}" 2>/dev/null || true

if [ -f "${OUTPUT_FILE}" ]; then
    SIZE=$(stat -c%s "${OUTPUT_FILE}")
    echo "[dlt-sample-gen] Done. Output: ${OUTPUT_FILE} (${SIZE} bytes)"
else
    echo "[dlt-sample-gen] ERROR: Output file not found." >&2
    exit 1
fi
