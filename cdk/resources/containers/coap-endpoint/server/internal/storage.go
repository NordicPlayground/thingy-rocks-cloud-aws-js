package internal

import (
	"context"
	"io"
	"bytes"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

func Store(client *azblob.Client, containerName string, key string, data []byte) (*azblob.UploadStreamResponse, error) {
	uploadResp, err := client.UploadStream(context.TODO(),
		containerName,
		key,
		bytes.NewReader(data), nil)
	return &uploadResp, err
}

func Retrieve(client *azblob.Client, containerName string, key string) ([]byte, error) {
	blobDownloadResponse, err := client.DownloadStream(context.TODO(), containerName, key, nil)
	if err != nil {
		return nil, err
	}
	reader := blobDownloadResponse.Body
	downloadData, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	err = reader.Close()
	if err != nil {
		return nil, err
	}

	return downloadData, nil
}
