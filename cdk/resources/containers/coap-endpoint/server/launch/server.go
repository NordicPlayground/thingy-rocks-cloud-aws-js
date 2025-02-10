package launch

import (
	"fmt"
	"log"

	"github.com/plgd-dev/go-coap/v3"
	"github.com/plgd-dev/go-coap/v3/mux"
)

type ServerFlags struct {
	Address  string
}

func Server(flagValues ServerFlags, udpPort int, r *mux.Router) {
	udpAddr := fmt.Sprintf("%s:%d", flagValues.Address, udpPort)

		log.Printf("Server listening on: %s\n", udpAddr)
		log.Fatal(coap.ListenAndServe("udp4", udpAddr, r))
}
