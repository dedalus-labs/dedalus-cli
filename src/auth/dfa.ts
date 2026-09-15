// @custom start
/** Ordered OAuth observations. Unlisted transitions do not authorize an operation. */
export const AUTHENTICATION_TRANSITIONS = [
	["idle", "configuration_valid", "listening", "bind_loopback"],
	["idle", "configuration_or_listener_failed", "failed", "report_error"],
	["listening", "browser_opened", "awaiting_callback", "wait_for_response"],
	["listening", "browser_failed", "failed", "close_listener"],
	["awaiting_callback", "state_and_issuer_match", "exchanging", "close_listener_then_exchange"],
	["awaiting_callback", "invalid_state", "awaiting_callback", "reject_local_request"],
	["awaiting_callback", "denied_timeout_or_cleanup_failed", "failed", "report_error"],
	["exchanging", "complete_tokens_received", "validating_identity", "fetch_userinfo"],
	["exchanging", "provider_or_response_failed", "failed", "report_error"],
	["validating_identity", "bound_identity_validated", "persisting", "write_keyring"],
	["validating_identity", "identity_failed", "grant_cleanup", "revoke_refresh_then_access"],
	["persisting", "credentials_written", "authenticated", "return_metadata"],
	["persisting", "storage_failed", "grant_cleanup", "revoke_refresh_then_access"],
	["grant_cleanup", "both_revocations_acknowledged", "failed", "report_original_error"],
	["grant_cleanup", "revocation_failed", "failed", "report_original_and_cleanup_errors"],
	["authenticated", "expires_within_sixty_seconds_or_first_401", "refreshing", "lock_then_refresh"],
	["refreshing", "same_identity_tokens_persisted", "authenticated", "send_request_once"],
	["refreshing", "provider_or_identity_failed", "failed", "report_error"],
	["refreshing", "storage_failed", "grant_cleanup", "revoke_refresh_then_access"],
	["authenticated", "logout", "revoking", "revoke_refresh_then_access"],
	["revoking", "both_revocations_acknowledged", "removing", "remove_credentials"],
	["revoking", "revocation_failed", "failed", "retain_credentials_and_report"],
	["removing", "credentials_confirmed_absent", "logged_out", "clear_auth_cache"],
	["removing", "cleanup_failed", "failed", "report_error"],
] as const;
// @custom end
