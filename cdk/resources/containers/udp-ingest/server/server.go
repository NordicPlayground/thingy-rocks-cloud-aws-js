package main

import (
	"flag"
	"fmt"
	"net"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	address := flag.String("address", "localhost:5683", "The UDP Server listen address, e.g. `localhost:5683` or `0.0.0.0:5683`.")
	flag.Parse()

	conn, err := net.ListenPacket("udp", *address)
	check(err)
	defer conn.Close()

	fmt.Printf("Listening on %s\n", *address)

	buffer := make([]byte, 1024)

	for {
		n, addr, err := conn.ReadFrom(buffer)
		if err != nil {
			fmt.Println("Error reading from connection:", err)
			continue
		}

		fmt.Printf("Received %s from %s\n", string(buffer[:n]), addr)

		_, err = conn.WriteTo(buffer[:n], addr)
		if err != nil {
			fmt.Println("Error writing to connection:", err)
			continue
		}
	}
}