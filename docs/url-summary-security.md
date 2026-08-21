# AXIS `/url` Summarization Security Notes

AXIS processes `/url https://…` only on the server, never in the browser. The implementation accepts only normalized HTTP(S) URLs with no embedded credentials and standard public web ports. It resolves the destination, rejects non-public address ranges, disables automatic redirects, enforces an eight-second deadline, limits downloaded bytes, and reduces supported HTML or plain text to a bounded text-only reference. The model is explicitly told that extracted page text is untrusted reference material, not instructions.

The implementation follows OWASP guidance that user-controlled server fetches require URL normalization, protocol restriction, destination/IP classification, redirect-chain validation, and bounded network behavior. [1] [2]

## References

[1]: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html "OWASP SSRF Prevention Cheat Sheet"
[2]: https://owasp.org/www-community/pages/controls/SSRF_Prevention_in_Nodejs "OWASP SSRF Prevention in Node.js"
