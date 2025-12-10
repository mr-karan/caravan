package spa

import (
	"bytes"
	"io"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"

	"github.com/caravan-nomad/caravan/backend/pkg/logger"
)

// embeddedSpaHandler serves the static files embedded in the binary.
type embeddedSpaHandler struct {
	// staticFS is the filesystem containing the static files.
	staticFS fs.FS
	// indexPath is the path to the index.html file.
	indexPath string
	// baseURL is the base URL of the application.
	baseURL string
}

// ServeHTTP serves the static files embedded in the binary.
func (h embeddedSpaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	urlPath := strings.TrimPrefix(r.URL.Path, h.baseURL)
	// Clean and normalize the path - remove leading slash for embed.FS compatibility
	urlPath = strings.TrimPrefix(urlPath, "/")

	if urlPath == "" {
		urlPath = h.indexPath
	}

	// Prepend "static" to the path as that's the root in our embed.FS
	// Use path.Join (not filepath.Join) because embed.FS always uses forward slashes
	fullPath := path.Join("static", urlPath)

	content, err := h.serveFile(fullPath)
	isServingIndex := false

	// Check if we're requesting a static asset (has a file extension)
	// Don't fall back to index.html for missing static assets - return 404 instead
	hasExtension := strings.Contains(path.Base(urlPath), ".")
	isStaticAsset := hasExtension && (strings.HasPrefix(urlPath, "assets/") ||
		strings.HasSuffix(urlPath, ".js") ||
		strings.HasSuffix(urlPath, ".css") ||
		strings.HasSuffix(urlPath, ".json") ||
		strings.HasSuffix(urlPath, ".map") ||
		strings.HasSuffix(urlPath, ".woff") ||
		strings.HasSuffix(urlPath, ".woff2") ||
		strings.HasSuffix(urlPath, ".png") ||
		strings.HasSuffix(urlPath, ".svg") ||
		strings.HasSuffix(urlPath, ".ico"))

	if err != nil {
		// For static assets, return 404 instead of falling back to index.html
		// This prevents the browser from caching HTML as JavaScript/CSS
		if isStaticAsset {
			logger.Log(logger.LevelError, map[string]string{
				"path":     urlPath,
				"fullPath": fullPath,
			}, err, "static asset not found in embedded files")
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}

		// For non-static routes, serve the index file (SPA routing)
		content, err = h.serveFile(path.Join("static", h.indexPath))
		if err != nil {
			http.Error(w, "Unable to read index file", http.StatusInternalServerError)
			return
		}

		isServingIndex = true
	} else {
		// Check if we're directly serving the index file
		isServingIndex = urlPath == h.indexPath
	}

	// if we're serving the index.html file and have a baseURL, replace the caravanBaseUrl with the baseURL
	if h.baseURL != "" && isServingIndex {
		// Replace the __baseUrl__ assignment to use the baseURL instead of './'
		oldPattern := "__baseUrl__ = './<%= BASE_URL %>'.replace('%BASE_' + 'URL%', '').replace('<' + '%= BASE_URL %>', '');"
		newPattern := "__baseUrl__ = '" + h.baseURL + "';"
		content = bytes.ReplaceAll(content, []byte(oldPattern), []byte(newPattern))
		// Replace any remaining './' patterns in the content
		content = bytes.ReplaceAll(content, []byte("'./'"), []byte(h.baseURL+"/"))
		// Replace url( patterns for CSS
		content = bytes.ReplaceAll(content, []byte("url("), []byte("url("+h.baseURL+"/"))
	}

	// Set the correct Content-Type header
	ext := path.Ext(fullPath)

	contentType := mime.TypeByExtension(ext)
	if contentType == "" {
		contentType = http.DetectContentType(content)
	}

	w.Header().Set("Content-Type", contentType)

	_, err = w.Write(content)
	if err != nil {
		logger.Log(logger.LevelError, nil, err, "writing content")
	}
}

func (h embeddedSpaHandler) serveFile(path string) ([]byte, error) {
	f, err := h.staticFS.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		return nil, err
	}

	if stat.IsDir() {
		return nil, fs.ErrNotExist
	}

	return io.ReadAll(f)
}

func NewEmbeddedHandler(staticFS fs.FS, indexPath, baseURL string) *embeddedSpaHandler {
	return &embeddedSpaHandler{
		staticFS:  staticFS,
		indexPath: indexPath,
		baseURL:   baseURL,
	}
}
