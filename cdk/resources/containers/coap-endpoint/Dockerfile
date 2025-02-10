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

RUN useradd -rm -d /home/coap -s /bin/bash -u 1002 coap
RUN chown -R coap:coap /var/log/hello.nrfcloud.com

COPY --chown=coap:coap ./server/coap-server         /home/coap/coap-server
COPY --chown=coap:coap ./server/start.sh            /home/coap/start.sh

USER coap
WORKDIR /home/coap

EXPOSE 5683/udp

CMD [ "/home/coap/start.sh" ]
