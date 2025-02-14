package main

import (
	"flag"
	"fmt"
	"net"
	"os"

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
	address := flag.String("address", "localhost:6666", "The UDP Server listen address, e.g. `localhost:6666` or `0.0.0.0:6666`.")
	flag.Parse()

	conn, err := net.ListenPacket("udp", *address)
	check(err)
	defer conn.Close()

	fmt.Printf("Listening on %s\n", *address)

	buffer := make([]byte, 1024)

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
	check(err)

	sqsClient := sqs.New(sess)

	for {
		n, addr, err := conn.ReadFrom(buffer)
		if err != nil {
			fmt.Println("Error reading from connection:", err)
			continue
		}

		fmt.Printf("Received %s from %s\n", string(buffer[:n]), addr)

		messageBody := string(buffer[:n])

		sendMessageInput := &sqs.SendMessageInput{
			MessageBody: aws.String(messageBody),
			QueueUrl:    aws.String(queueURL),
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
