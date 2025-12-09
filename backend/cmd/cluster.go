package main

// Cluster represents a Nomad cluster configuration
type Cluster struct {
	Name     string                 `json:"name"`
	Server   string                 `json:"server,omitempty"`
	Region   string                 `json:"region,omitempty"`
	AuthType string                 `json:"auth_type"`
	Metadata map[string]interface{} `json:"meta_data"`
	Error    string                 `json:"error,omitempty"`
}

// ClusterReq represents a request to add a new Nomad cluster
type ClusterReq struct {
	Name      *string `json:"name"`
	Address   *string `json:"address"`
	Region    *string `json:"region"`
	Namespace *string `json:"namespace"`
	Token     *string `json:"token"`
	// InsecureSkipTLSVerify skips the validity check for the server's certificate.
	// +optional
	InsecureSkipTLSVerify bool                   `json:"insecure-skip-tls-verify,omitempty"`
	Metadata              map[string]interface{} `json:"meta_data"`
}

// RenameClusterRequest is the request body structure for renaming a cluster.
type RenameClusterRequest struct {
	NewClusterName string `json:"newClusterName"`
	Source         string `json:"source"`
}
