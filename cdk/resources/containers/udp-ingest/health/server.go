package main

import (
	"flag"
	"fmt"
	"net/http"
)

type ServerFlags struct {
	Address  string
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "OK")
}

func main() {
	address := flag.String("address", "localhost",
		"The UDP Server listen address, e.g. `localhost` or `0.0.0.0`.")

	var flagValues = ServerFlags{
		Address:  *address,
	}

	http.HandleFunc("/health", healthHandler)
	fmt.Printf("Starting server on %s:80\n", flagValues.Address)
	if err := http.ListenAndServe(fmt.Sprintf("%s:80", flagValues.Address), nil); err != nil {
		fmt.Println("Failed to start server:", err)
	}
}