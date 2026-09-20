# Security

Do not include secrets or private content in public issues. Report suspected vulnerabilities through GitHub private vulnerability reporting when available, or ask for a private contact without disclosing the vulnerability itself.

This server forwards only explicit tool arguments to the fixed TypeSafe API endpoint. It does not read project files, fetch document URLs, or act on evaluated content. The host application remains responsible for deciding which data may be sent and whether any resulting action is authorized.

Keep the API key outside the repository and restrict access to its environment file. Client conversation histories may contain evaluated data even though the server does not persist it.
