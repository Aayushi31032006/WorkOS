# Known Limitations

## Stage 1 (Current)
- Backend API not yet implemented (Stage 2)
- Frontend not yet implemented (Stage 3)
- Docker images for api/web are placeholder stubs
- No actual database migrations yet (Stage 2)

## Planned Improvements (Post-MVP)
- Redis pub/sub for multi-instance WebSocket fan-out at scale
- AV scanning integration (ClamAV or commercial)
- Message threading depth > 1 level
- Emoji reactions: full Unicode emoji set (currently limited to string)
- i18n / RTL support
- Message scheduling
- Channel discovery / browse
- Integration with WorkOS audit logs (if API becomes available)
