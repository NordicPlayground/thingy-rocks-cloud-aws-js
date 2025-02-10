package internal

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"time"

	"github.com/plgd-dev/go-coap/v3/message"
	"github.com/plgd-dev/go-coap/v3/message/codes"
	"github.com/plgd-dev/go-coap/v3/mux"
)

func loggingMiddleware(next mux.Handler) mux.Handler {
	return mux.HandlerFunc(func(w mux.ResponseWriter, r *mux.Message) {
		log.Printf("ClientAddress %v, %v\n", w.Conn().RemoteAddr(), r.String())
		next.ServeCOAP(w, r)
	})
}

func helloResource(w mux.ResponseWriter, r *mux.Message) {
	err := w.SetResponse(codes.Content, message.TextPlain, bytes.NewReader([]byte(fmt.Sprintf("Hello from the cloud! The time is: %s.", time.Now().Format(time.RFC3339)))))
	if err != nil {
		log.Printf("cannot set response: %v", err)
	}
}

func dynamicResource() func(mux.ResponseWriter, *mux.Message) {
	return func(w mux.ResponseWriter, r *mux.Message) {
		resp := w.Conn().AcquireMessage(r.Context())
		defer w.Conn().ReleaseMessage(resp)
		resp.SetToken(r.Token())
		resp.SetContentFormat(message.TextPlain)

		path, pErr := r.Path()
		if pErr != nil {
			resp.SetCode(codes.BadRequest)
			w.Conn().WriteMessage(resp)
			return
		}


		switch r.Code() {
		case codes.POST:
			payloadSize, err := r.BodySize()
			if err != nil {
				log.Fatal(err)
			}
			if (payloadSize > 100000) { // Max size 100 KB
				err := w.SetResponse(codes.RequestEntityTooLarge, message.TextPlain, bytes.NewReader([]byte("Maximum payload size is 100 KB!")))
				if err != nil {
					log.Printf("cannot set response: %v", err)
				}
				return 
			}
			data, err := io.ReadAll(r.Body())
			if err != nil {
				log.Fatal(err)
			}
			log.Printf("Received content: '%s' in '%s'\n", data, path)
		}

		err := w.Conn().WriteMessage(resp)
		if err != nil {
			log.Printf("cannot set response: %v", err)
		}
	}
}



func NewServer() *mux.Router {
	r := mux.NewRouter()
	r.Use(loggingMiddleware)
	r.Handle("/{res:[^\\/]+}", mux.HandlerFunc(dynamicResource()))
	return r
}