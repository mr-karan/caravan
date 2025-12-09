// Package logger provides structured logging using Go's standard log/slog package.
package logger

import (
	"log/slog"
	"os"
	"runtime"
)

const (
	// LevelInfo is the info level.
	LevelInfo = iota
	// LevelWarn is the warn level.
	LevelWarn
	// LevelError is the error level.
	LevelError
)

// callerDepth is the depth of the caller in the stack.
const callerDepth = 2

var defaultLogger *slog.Logger

func init() {
	// Initialize with JSON handler for structured logging
	defaultLogger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		AddSource: false, // We add source manually for correct caller info
	}))
}

// SetLogger allows setting a custom logger (useful for testing).
func SetLogger(l *slog.Logger) {
	defaultLogger = l
}

// GetLogger returns the current logger instance.
func GetLogger() *slog.Logger {
	return defaultLogger
}

// Log logs the message at the specified level with optional attributes.
// This maintains backwards compatibility with the old logger interface.
func Log(level uint, attrs map[string]string, err interface{}, msg string) {
	// If a custom log function is set, use it instead
	if logFunc != nil {
		logFunc(level, attrs, err, msg)
		return
	}
	// Get caller info
	_, file, line, ok := runtime.Caller(callerDepth)

	// Build attributes slice
	slogAttrs := make([]any, 0, len(attrs)*2+4)

	// Add custom attributes
	for k, v := range attrs {
		slogAttrs = append(slogAttrs, k, v)
	}

	// Add source info
	if ok {
		slogAttrs = append(slogAttrs, "source", file, "line", line)
	}

	// Add error if present
	if err != nil {
		switch e := err.(type) {
		case error:
			slogAttrs = append(slogAttrs, "error", e.Error())
		case []error:
			errStrs := make([]string, len(e))
			for i, er := range e {
				errStrs[i] = er.Error()
			}
			slogAttrs = append(slogAttrs, "errors", errStrs)
		default:
			slogAttrs = append(slogAttrs, "error", e)
		}
	}

	// Log at appropriate level
	switch level {
	case LevelInfo:
		defaultLogger.Info(msg, slogAttrs...)
	case LevelWarn:
		defaultLogger.Warn(msg, slogAttrs...)
	case LevelError:
		defaultLogger.Error(msg, slogAttrs...)
	default:
		defaultLogger.Info(msg, slogAttrs...)
	}
}

// Info logs at info level.
func Info(msg string, args ...any) {
	defaultLogger.Info(msg, args...)
}

// Warn logs at warn level.
func Warn(msg string, args ...any) {
	defaultLogger.Warn(msg, args...)
}

// Error logs at error level.
func Error(msg string, args ...any) {
	defaultLogger.Error(msg, args...)
}

// Debug logs at debug level.
func Debug(msg string, args ...any) {
	defaultLogger.Debug(msg, args...)
}

// With returns a logger with the given attributes.
func With(args ...any) *slog.Logger {
	return defaultLogger.With(args...)
}

// LogFunc is a function signature for logging (backwards compatibility).
type LogFunc func(level uint, str map[string]string, err interface{}, msg string)

// logFunc holds the custom logging function (nil means use default slog).
var logFunc LogFunc

// SetLogFunc sets the logging function (backwards compatibility).
// Returns the previous log function.
func SetLogFunc(lf LogFunc) LogFunc {
	old := logFunc
	logFunc = lf
	return old
}
