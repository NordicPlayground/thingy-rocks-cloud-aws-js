#!/bin/bash

# Enumerate all IPv4 network interfaces and get their assigned IP addresses
ipv4_interfaces=$(ip -o -4 addr show | awk '{print $2}' | cut -d':' -f1 | sort -u)
for interface in $ipv4_interfaces; do
    IP=$(ip -o -4 addr show $interface | awk '{print $4}' | cut -d'/' -f1)
    echo "Interface: $interface, Assigned IP: $IP"
    nohup /home/coap/coap-server -address $IP -network udp4 &
done

sleep infinity