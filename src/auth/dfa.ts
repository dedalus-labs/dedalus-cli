// @custom start
/** Ordered OAuth observations. Unlisted transitions do not authorize an operation. */
export const authenticationTransitions = [
  ['idle', 'configuration_valid', 'listening', 'bind_loopback'],
  ['idle', 'configuration_failed', 'failed', 'report_error'],
  ['listening', 'browser_opened', 'awaiting_callback', 'wait_for_response'],
  ['listening', 'browser_failed', 'failed', 'close_listener'],
  ['awaiting_callback', 'state_and_issuer_match', 'exchanging', 'close_listener_then_exchange'],
  ['awaiting_callback', 'invalid_state', 'awaiting_callback', 'reject_local_request'],
  ['awaiting_callback', 'denied_timeout_or_cleanup_failed', 'failed', 'report_error'],
  ['exchanging', 'complete_tokens_and_bound_identity', 'persisting', 'write_keyring'],
  ['exchanging', 'provider_or_response_failed', 'failed', 'report_error'],
  ['persisting', 'credentials_written', 'authenticated', 'return_metadata'],
  ['persisting', 'storage_failed', 'failed', 'report_error'],
  ['authenticated', 'expires_within_sixty_seconds_or_first_401', 'refreshing', 'lock_then_refresh'],
  ['refreshing', 'same_identity_tokens_persisted', 'authenticated', 'send_request_once'],
  ['refreshing', 'provider_identity_or_storage_failed', 'failed', 'report_error'],
  ['authenticated', 'logout', 'revoking', 'revoke_refresh_then_access'],
  ['revoking', 'both_revocations_acknowledged', 'removing', 'remove_credentials'],
  ['revoking', 'revocation_failed', 'failed', 'retain_credentials_and_report'],
  ['removing', 'credentials_confirmed_absent', 'logged_out', 'clear_auth_cache'],
  ['removing', 'cleanup_failed', 'failed', 'report_error'],
] as const
// @custom end
