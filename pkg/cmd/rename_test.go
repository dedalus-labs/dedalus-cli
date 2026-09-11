package cmd

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dedalus-labs/dedalus-go"
	"github.com/dedalus-labs/dedalus-go/option"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRenameMachine(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		assert.Equal(t, http.MethodPatch, request.Method)
		assert.Equal(t, "/v1/machines/hotel-california", request.URL.Path)

		var body map[string]string
		require.NoError(t, json.NewDecoder(request.Body).Decode(&body))
		assert.Equal(t, map[string]string{"name": "breakfast"}, body)

		response.Header().Set("Content-Type", "application/json")
		_, _ = response.Write([]byte(`{"machine_id":"dm-0198abc123","name":"breakfast"}`))
	}))
	defer server.Close()

	client := dedalus.NewClient(option.WithBaseURL(server.URL))
	result, err := renameMachine(context.Background(), &client, "hotel-california", "breakfast")

	require.NoError(t, err)
	assert.Equal(t, "dm-0198abc123", result.MachineID)
	assert.Equal(t, "breakfast", result.Name)
}

func TestRenameMachineSurfacesServerMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		response.WriteHeader(http.StatusUnprocessableEntity)
		_ = json.NewEncoder(response).Encode(map[string]string{
			"error_code": "MACHINE_NAME_INVALID",
			"message":    `invalid name "My Box": names are lowercase with no spaces`,
		})
	}))
	defer server.Close()

	client := dedalus.NewClient(option.WithBaseURL(server.URL))
	_, err := renameMachine(context.Background(), &client, "dm-0198abc123", "My Box")

	require.Error(t, err)
	assert.Contains(t, err.Error(), "MACHINE_NAME_INVALID")
	assert.Contains(t, err.Error(), "names are lowercase with no spaces")
}
