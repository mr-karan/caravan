package nomadconfig

import (
	"errors"
	"sync"
)

// ContextStore is an interface for managing Nomad contexts
type ContextStore interface {
	// AddContext adds a context to the store
	AddContext(ctx *Context) error
	// GetContext returns a context by name
	GetContext(name string) (*Context, error)
	// GetContexts returns all contexts in the store
	GetContexts() []*Context
	// RemoveContext removes a context by name
	RemoveContext(name string) error
	// UpdateContext updates an existing context
	UpdateContext(ctx *Context) error
	// HasContext returns true if a context with the given name exists
	HasContext(name string) bool
}

// InMemoryContextStore is an in-memory implementation of ContextStore
type InMemoryContextStore struct {
	contexts map[string]*Context
	mutex    sync.RWMutex
}

// NewInMemoryContextStore creates a new InMemoryContextStore
func NewInMemoryContextStore() *InMemoryContextStore {
	return &InMemoryContextStore{
		contexts: make(map[string]*Context),
	}
}

// AddContext adds a context to the store
func (s *InMemoryContextStore) AddContext(ctx *Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}
	if ctx.Name == "" {
		return errors.New("context name cannot be empty")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.contexts[ctx.Name] = ctx
	return nil
}

// GetContext returns a context by name
func (s *InMemoryContextStore) GetContext(name string) (*Context, error) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	ctx, exists := s.contexts[name]
	if !exists {
		return nil, errors.New("context not found: " + name)
	}
	return ctx, nil
}

// GetContexts returns all contexts in the store
func (s *InMemoryContextStore) GetContexts() []*Context {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	contexts := make([]*Context, 0, len(s.contexts))
	for _, ctx := range s.contexts {
		contexts = append(contexts, ctx)
	}
	return contexts
}

// RemoveContext removes a context by name
func (s *InMemoryContextStore) RemoveContext(name string) error {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, exists := s.contexts[name]; !exists {
		return errors.New("context not found: " + name)
	}

	delete(s.contexts, name)
	return nil
}

// UpdateContext updates an existing context
func (s *InMemoryContextStore) UpdateContext(ctx *Context) error {
	if ctx == nil {
		return errors.New("context cannot be nil")
	}
	if ctx.Name == "" {
		return errors.New("context name cannot be empty")
	}

	s.mutex.Lock()
	defer s.mutex.Unlock()

	if _, exists := s.contexts[ctx.Name]; !exists {
		return errors.New("context not found: " + ctx.Name)
	}

	s.contexts[ctx.Name] = ctx
	return nil
}

// HasContext returns true if a context with the given name exists
func (s *InMemoryContextStore) HasContext(name string) bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	_, exists := s.contexts[name]
	return exists
}

// LoadAndStoreContexts loads contexts from environment variables and stores them.
// If no clusters are configured via environment variables, this is not an error -
// users can add clusters dynamically via the UI.
func LoadAndStoreContexts(store ContextStore) error {
	contexts, err := LoadMultiClusterFromEnv()
	if err != nil {
		return err
	}

	// Empty list is valid - clusters can be added via UI
	if len(contexts) == 0 {
		return nil
	}

	var errs []error
	for _, ctx := range contexts {
		if err := store.AddContext(ctx); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return errors.Join(errs...)
	}
	return nil
}
