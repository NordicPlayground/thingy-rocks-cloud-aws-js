FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN <<EOT
  apt-get -y update
  apt-get -y install iproute2
  apt-get -y install ca-certificates
  update-ca-certificates
  apt-get -y clean
  rm -rf /var/lib/apt/lists/*
  mkdir /var/log/hello.nrfcloud.com
EOT

RUN useradd -rm -d /home/udp-ingest -s /bin/bash -u 1002 udp-ingest
RUN chown -R udp-ingest:udp-ingest /var/log/hello.nrfcloud.com

COPY --chown=udp-ingest:udp-ingest ./server/udp-ingest          /home/udp-ingest/udp-ingest
COPY --chown=udp-ingest:udp-ingest ./health/health              /home/udp-ingest/health
COPY --chown=udp-ingest:udp-ingest ./start.sh                   /home/udp-ingest/start.sh

USER udp-ingest
WORKDIR /home/udp-ingest

EXPOSE 5683/udp
EXPOSE 8080/udp

CMD [ "/home/udp-ingest/start.sh" ]
