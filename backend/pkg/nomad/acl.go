package nomad

import (
	"net/http"
)

// ListACLTokens handles GET /clusters/{cluster}/v1/acl/tokens
func (h *Handler) ListACLTokens(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	tokens, _, err := client.ACLTokens().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, tokens)
}

// GetACLToken handles GET /clusters/{cluster}/v1/acl/token/{tokenID}
func (h *Handler) GetACLToken(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	tokenID := r.PathValue("tokenID")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	aclToken, _, err := client.ACLTokens().Info(tokenID, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, aclToken)
}

// GetSelfToken handles GET /clusters/{cluster}/v1/acl/token/self
func (h *Handler) GetSelfToken(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	aclToken, _, err := client.ACLTokens().Self(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, aclToken)
}

// ListACLPolicies handles GET /clusters/{cluster}/v1/acl/policies
func (h *Handler) ListACLPolicies(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	policies, _, err := client.ACLPolicies().List(opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, policies)
}

// GetACLPolicy handles GET /clusters/{cluster}/v1/acl/policy/{policyName}
func (h *Handler) GetACLPolicy(w http.ResponseWriter, r *http.Request) {
	clusterName := getClusterName(r)
	token := getToken(r)
	policyName := r.PathValue("policyName")

	client, err := h.GetClientWithToken(clusterName, token)
	if err != nil {
		writeError(w, err, http.StatusInternalServerError)
		return
	}

	opts := getQueryOptions(r)
	policy, _, err := client.ACLPolicies().Info(policyName, opts)
	if err != nil {
		writeNomadError(w, err)
		return
	}

	writeJSON(w, policy)
}
