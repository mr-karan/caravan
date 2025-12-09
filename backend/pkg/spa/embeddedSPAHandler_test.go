package spa_test

import (
	"context"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/caravan-nomad/caravan/backend/pkg/spa"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper function to create test filesystem.
func createTestFS(files map[string]*fstest.MapFile) fs.FS {
	return fstest.MapFS(files)
}

// getTestHTML returns the test HTML content used across tests.
func getTestHTML() string {
	return `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Caravan</title>
    <script>
        // handles both webpack and rspack build systems
        __baseUrl__ = './<%= BASE_URL %>'.replace('%BASE_' + 'URL%', '').replace('<' + '%= BASE_URL %>', '');
        // the syntax of the following line is special - it will be matched and replaced by the server
        // if a base URL is set by the server
        caravanBaseUrl = __baseUrl__;
    </script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
}

func TestEmbeddedSpaHandler(t *testing.T) {
	testHTML := getTestHTML()

	t.Run("check_caravanBaseUrl_is_set_to_baseURL", func(t *testing.T) {
		testCaravanBaseURLWithBaseURL(t, testHTML)
	})

	t.Run("check_empty_path_returns_index.html", func(t *testing.T) {
		testEmptyPathReturnsIndex(t, testHTML)
	})

	t.Run("file_not_found", func(t *testing.T) {
		testFileNotFound(t, testHTML)
	})
}

func testCaravanBaseURLWithBaseURL(t *testing.T, testHTML string) {
	handler := spa.NewEmbeddedHandler(createTestFS(map[string]*fstest.MapFile{
		"static/index.html": {Data: []byte(testHTML)},
	}), "index.html", "/caravan")

	req, err := http.NewRequestWithContext(context.Background(), "GET", "/caravan/index.html", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	// Check that the __baseUrl__ assignment was replaced
	assert.Contains(t, rr.Body.String(), "__baseUrl__ = '/caravan';")
	assert.Contains(t, rr.Body.String(), "caravanBaseUrl = __baseUrl__;")
}

func testEmptyPathReturnsIndex(t *testing.T, testHTML string) {
	handler := spa.NewEmbeddedHandler(createTestFS(map[string]*fstest.MapFile{
		"static/index.html": {Data: []byte(testHTML)},
	}), "index.html", "/")

	req, err := http.NewRequestWithContext(context.Background(), "GET", "/caravan/", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	// When baseURL is "/", the replacement should happen and __baseUrl__ should be set to "/"
	assert.Contains(t, rr.Body.String(), "__baseUrl__ = '/';")
	assert.Contains(t, rr.Body.String(), "caravanBaseUrl = __baseUrl__;")
}

func testFileNotFound(t *testing.T, testHTML string) {
	handler := spa.NewEmbeddedHandler(createTestFS(map[string]*fstest.MapFile{
		"static/index.html": {Data: []byte(testHTML)},
	}), "index.html", "/caravan")

	req, err := http.NewRequestWithContext(context.Background(), "GET", "/caravan/not-found.html", nil)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	// Check that the __baseUrl__ assignment was replaced in fallback case
	assert.Contains(t, rr.Body.String(), "__baseUrl__ = '/caravan';")
	assert.Contains(t, rr.Body.String(), "caravanBaseUrl = __baseUrl__;")
}
