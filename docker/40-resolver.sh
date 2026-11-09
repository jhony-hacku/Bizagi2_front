#!/bin/sh
# Toma el servidor DNS del contenedor para que nginx resuelva el backend en cada petición
NS=$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)
echo "resolver ${NS} valid=5s ipv6=off;" > /etc/nginx/conf.d/resolver.inc
