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
	address := flag.String("address", "localhost:8080",
		"The HTTP server listen address, e.g. `localhost:8080` or `0.0.0.0:8080`.")
	flag.Parse()

	http.HandleFunc("/health", healthHandler)
	fmt.Printf("Starting HTTP server on %s\n", *address)
	if err := http.ListenAndServe(*address, nil); err != nil {
		fmt.Println("Failed to start HTTP server:", err)
	}
}