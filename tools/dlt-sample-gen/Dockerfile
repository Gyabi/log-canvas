FROM ubuntu:22.04

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        dlt-daemon \
        dlt-tools \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
