# Security Notice

## ⚠️ IMPORTANT: Credentials Exposure

The `config.env` file previously contained exposed MongoDB credentials and JWT secrets that were committed to version control.

### Action Required

1. **Rotate all exposed credentials immediately:**
   - Change MongoDB database password
   - Generate a new JWT_SECRET (minimum 32 characters)
   - Update all environment variables in production

2. **The `config.env` file has been:**
   - Removed from git tracking
   - Added to `.gitignore` (already done)
   - Credentials replaced with placeholders

3. **For local development:**
   - Copy `config.env.example` to `config.env`
   - Fill in your actual credentials (they will not be committed)

4. **For production:**
   - Use environment variables or secrets management (AWS Secrets Manager, etc.)
   - Never commit credentials to version control

### Verification

The `config.env` file is now properly ignored by git and will not be committed in future changes.
