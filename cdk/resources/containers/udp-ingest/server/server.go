package main

import (
	"encoding/base64"
	"flag"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/sqs"
)

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func main() {
	awsRegion := os.Getenv("AWS_REGION")
	if awsRegion == "" {
		panic("AWS_REGION environment variable not set")
	}

	queueURL := os.Getenv("SQS_QUEUE_URL")
	if queueURL == "" {
		panic("SQS_QUEUE_URL environment variable not set")
	}

	conf := aws.NewConfig().WithRegion(awsRegion)
	sess := session.Must(session.NewSession(conf))

	sqsClient := sqs.New(sess)

	address := flag.String("address", "localhost:6666", "The UDP Server listen address, e.g. `localhost:6666` or `0.0.0.0:6666`.")
	flag.Parse()

	conn, err := net.ListenPacket("udp", *address)
	check(err)
	defer conn.Close()

	// Extract port from address
	addressParts := strings.Split(*address, ":")
	sourcePort := addressParts[len(addressParts)-1]

	fmt.Printf("Listening on %s (port %s)\n", *address, sourcePort)

	buffer := make([]byte, 1024)

	for {
		n, addr, err := conn.ReadFrom(buffer)
		if err != nil {
			fmt.Println("Error reading from connection:", err)
			continue
		}

		// Determine message body format based on port
		var messageBody string
		port, _ := strconv.Atoi(sourcePort)
		if port == 6667 {
			// For port 6667, encode binary CBOR data as base64
			messageBody = base64.StdEncoding.EncodeToString(buffer[:n])
			fmt.Printf("Received %d bytes (CBOR) from %s on port %s\n", n, addr, sourcePort)
		} else {
			// For other ports, treat as text
			messageBody = string(buffer[:n])
			fmt.Printf("Received %s from %s on port %s\n", messageBody, addr, sourcePort)
		}

		sendMessageInput := &sqs.SendMessageInput{
			MessageBody: aws.String(messageBody),
			QueueUrl:    aws.String(queueURL),
			MessageAttributes: map[string]*sqs.MessageAttributeValue{
				"sourcePort": {
					DataType:    aws.String("Number"),
					StringValue: aws.String(sourcePort),
				},
			},
		}

		_, err = sqsClient.SendMessage(sendMessageInput)
		if err != nil {
			fmt.Println("Error sending message to SQS:", err)
			continue
		}

		_, err = conn.WriteTo([]byte("OK\n"), addr)
		if err != nil {
			fmt.Println("Error writing to connection:", err)
			continue
		}
	}
}
