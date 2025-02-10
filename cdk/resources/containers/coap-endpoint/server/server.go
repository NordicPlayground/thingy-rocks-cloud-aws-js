package main

import (
	"coap-server/launch"
	"flag"

	"coap-server/internal"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	address := flag.String("address", "localhost",
		"The UDP Server listen address, e.g. `localhost` or `0.0.0.0`.")

	var flagValues = launch.ServerFlags{
		Address:  *address,
	}

	r := internal.NewServer()

	launch.Server(flagValues, 5683, r)

}
